import { createAdminClient } from '@/lib/supabase/server'
import { enrichLeadWithAI } from './aiService'
import { scrapeWebContent, findEmailWithHunter, searchArtworkSignals } from './scrapingService'
import { runConcurrently } from '@/lib/concurrency'
import { LushaClient } from './lushaService'
import type { Lead } from '@/types'

// ============================================================
// ENRICHMENT SERVICE — Orquesta scraping + Lusha + Hunter + AI + guardado
//
// FLUJO EN CADENA (todo suma, nada se sustituye):
//   1. Lusha  → email, teléfono, LinkedIn (si está conectado)
//   2. Web scraping (SerpAPI)  → contenido del sitio web
//   3. Hunter.io → email verificado (solo si Lusha no lo encontró)
//   4. SerpAPI artwork signals → señales de compra activas
//   5. IA (Gemini/Groq) → análisis completo + score
// ============================================================

export async function enrichLead(leadId: string, userId: string) {
  const supabase = createAdminClient()

  // 1. Obtener el lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, company_name, website, domain, email, phone, linkedin_url, campaign_id, sector, country, description, first_name, last_name, department')
    .eq('id', leadId)
    .eq('user_id', userId)
    .single()

  if (leadError || !lead) throw new Error('Lead no encontrado')

  // 1b. Leer configuración del usuario: IA + API keys
  const [{ data: userSettings }, { data: lushaIntegration }] = await Promise.all([
    supabase
      .from('settings')
      .select('ai_provider, ai_model')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('api_integrations')
      .select('api_key')
      .eq('user_id', userId)
      .eq('provider', 'lusha')
      .single(),
  ])

  const aiProvider = (userSettings?.ai_provider as string) ?? 'gemini'
  const aiModel = (userSettings?.ai_model as string) ?? 'gemini-2.5-flash'
  const lushaApiKey = lushaIntegration?.api_key as string | undefined

  // ─────────────────────────────────────────────────────────
  // PASO 1 — LUSHA: busca email, teléfono y LinkedIn si está conectado
  //   - Solo actúa sobre campos vacíos (no sobreescribe)
  //   - Si encuentra email, marcamos lushaFoundEmail=true para no llamar a Hunter
  // ─────────────────────────────────────────────────────────
  const lushaUpdates: Record<string, string> = {}
  let lushaFoundEmail = false

  if (lushaApiKey && (lead.first_name || lead.last_name)) {
    try {
      const lushaClient = new LushaClient(lushaApiKey)
      const lushaResult = await lushaClient.enrichPerson({
        firstName: lead.first_name ?? undefined,
        lastName: lead.last_name ?? undefined,
        company: lead.company_name ?? undefined,
        linkedinUrl: lead.linkedin_url ?? undefined,
      })

      if (lushaResult.found) {
        if (!lead.email && lushaResult.email) {
          lushaUpdates.email = lushaResult.email
          lushaFoundEmail = true
        }
        if (!lead.phone && lushaResult.phone) {
          lushaUpdates.phone = lushaResult.phone
        }
        if (!lead.linkedin_url && lushaResult.linkedin) {
          lushaUpdates.linkedin_url = lushaResult.linkedin
        }

        // Guardar datos de Lusha en el lead inmediatamente para que la IA los use
        if (Object.keys(lushaUpdates).length > 0) {
          await supabase
            .from('leads')
            .update({ ...lushaUpdates, updated_at: new Date().toISOString() })
            .eq('id', leadId)

          // Reflejar los cambios en el objeto lead para los pasos siguientes
          Object.assign(lead, lushaUpdates)
        }
      }
    } catch (e) {
      console.warn('Lusha enrichment failed (non-blocking):', e)
    }
  }

  // ─────────────────────────────────────────────────────────
  // PASO 2+3+4 — Web Scraping + Hunter (si no email ya) + Artwork Signals
  //   Todo en paralelo para maximizar velocidad
  // ─────────────────────────────────────────────────────────
  const [scrapedResult, hunterResult, artworkSignals] = await Promise.all([
    // Web scraping del sitio
    lead.website
      ? scrapeWebContent(lead.website).catch(e => {
          console.warn(`Scraping failed for ${lead.website}:`, e)
          return null
        })
      : Promise.resolve(null),

    // Hunter.io solo si aún no tenemos email (ni original ni de Lusha)
    !lead.email && !lushaFoundEmail && lead.domain
      ? findEmailWithHunter(lead.domain).catch(() => null)
      : Promise.resolve(null),

    // SerpAPI: 3 búsquedas de señales de artwork/packaging
    searchArtworkSignals(
      lead.company_name,
      lead.domain ?? undefined,
      lead.country ?? 'es'
    ).catch(e => {
      console.warn(`Artwork signal search failed for ${lead.company_name}:`, e)
      return []
    }),
  ])

  const scrapedContent = scrapedResult?.content
  const scrapedTitle = scrapedResult?.title
  const scrapedDescription = scrapedResult?.description
  const emailFound = hunterResult?.email  // solo si Hunter lo encontró (Lusha no lo había)

  // ─────────────────────────────────────────────────────────
  // PASO 5 — IA (Gemini o Groq): análisis completo de la empresa
  //   Recibe el lead ya actualizado con datos de Lusha/Hunter
  // ─────────────────────────────────────────────────────────
  const leadForAI: Lead = {
    ...lead as unknown as Lead,
    email: lead.email ?? emailFound ?? undefined,
  }
  const aiResult = await enrichLeadWithAI(leadForAI, scrapedContent, aiProvider, aiModel)

  // ─────────────────────────────────────────────────────────
  // PASO 6 — Guardar enrichment en BD
  // ─────────────────────────────────────────────────────────
  const enrichmentData = {
    lead_id: leadId,
    user_id: userId,
    company_summary: aiResult.company_summary,
    what_they_do: aiResult.what_they_do,
    detected_needs: aiResult.detected_needs,
    detected_problems: aiResult.detected_problems,
    media_connector_fit: aiResult.media_connector_fit,
    fit_score: aiResult.fit_score,
    priority_reason: aiResult.priority_reason,
    auto_tags: aiResult.auto_tags,
    scraped_title: scrapedTitle,
    scraped_description: scrapedDescription,
    scraped_content: scrapedContent?.slice(0, 2000),
    raw_ai_response: {
      ...aiResult,
      brand_signals: artworkSignals,
      // Trazabilidad: qué fuentes aportaron datos de contacto
      contact_sources: {
        email: lead.email ? 'original' : lushaFoundEmail ? 'lusha' : emailFound ? 'hunter' : null,
        phone: lushaUpdates.phone ? 'lusha' : null,
        linkedin: lushaUpdates.linkedin_url ? 'lusha' : null,
      },
    },
    model_used: aiProvider === 'groq'
      ? (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile')
      : aiModel,
  }

  let enrichment: Record<string, unknown> | null = null
  const { data: upsertData, error: enrichError } = await supabase
    .from('lead_enrichments')
    .upsert(enrichmentData, { onConflict: 'lead_id' })
    .select()
    .single()

  if (enrichError) {
    console.warn('Upsert failed, trying delete+insert fallback:', enrichError.message)
    await supabase.from('lead_enrichments').delete().eq('lead_id', leadId)
    const { data: insertData, error: insertError } = await supabase
      .from('lead_enrichments')
      .insert(enrichmentData)
      .select()
      .single()
    if (insertError) throw new Error('Error guardando enrichment: ' + insertError.message)
    enrichment = insertData
  } else {
    enrichment = upsertData
  }

  // ─────────────────────────────────────────────────────────
  // PASO 7 — Actualizar lead + activity log en paralelo
  // ─────────────────────────────────────────────────────────
  const priority = aiResult.fit_score >= 70 ? 'high' : aiResult.fit_score >= 40 ? 'medium' : 'low'
  const updateData: Record<string, unknown> = {
    score: aiResult.fit_score,
    priority,
    is_enriched: true,
    enriched_at: new Date().toISOString(),
    status: 'enriched',
    tags: aiResult.auto_tags,
  }
  // Email de Hunter (Lusha ya se guardó en el paso 1)
  if (emailFound && !lead.email) updateData.email = emailFound

  // Descripción del log con trazabilidad de fuentes
  const contactSources: string[] = []
  if (lushaFoundEmail) contactSources.push('email vía Lusha')
  else if (emailFound) contactSources.push('email vía Hunter')
  if (lushaUpdates.phone) contactSources.push('teléfono vía Lusha')
  if (lushaUpdates.linkedin_url) contactSources.push('LinkedIn vía Lusha')
  const sourcesNote = contactSources.length ? ` | Contacto: ${contactSources.join(', ')}` : ''

  await Promise.all([
    supabase.from('leads').update(updateData).eq('id', leadId),
    supabase.from('activity_logs').insert({
      lead_id: leadId,
      user_id: userId,
      campaign_id: lead.campaign_id,
      type: 'enriched',
      title: 'Lead enriquecido',
      description: `Score: ${aiResult.fit_score}/100 | Prioridad: ${priority}${sourcesNote}`,
      metadata: { fit_score: aiResult.fit_score, priority, contact_sources: enrichmentData.raw_ai_response.contact_sources },
    }),
  ])

  return { lead, enrichment, score: aiResult.fit_score, priority }
}

// ─────────────────────────────────────────────────────────────
// Enriquecimiento masivo — concurrencia controlada (5 simultáneos)
// ─────────────────────────────────────────────────────────────
export async function enrichCampaignLeads(
  campaignId: string,
  userId: string,
  limit = 10
): Promise<{ enriched: number; errors: number }> {
  const supabase = createAdminClient()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .eq('is_enriched', false)
    .limit(limit)

  if (error || !leads) throw new Error('Error obteniendo leads')

  const results = await runConcurrently<{ id: string }, { success: boolean }>(
    leads as { id: string }[],
    async (lead) => {
      try {
        await enrichLead(lead.id, userId)
        return { success: true }
      } catch (e) {
        console.error(`Error enriching lead ${lead.id}:`, e)
        return { success: false }
      }
    },
    5
  )

  return {
    enriched: results.filter(r => r.success).length,
    errors: results.filter(r => !r.success).length,
  }
}
