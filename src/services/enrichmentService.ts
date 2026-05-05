import { createAdminClient } from '@/lib/supabase/server'
import { enrichLeadWithAI } from './aiService'
import { scrapeWebContent, findEmailWithHunter } from './scrapingService'
import { runConcurrently } from '@/lib/concurrency'
import type { Lead } from '@/types'

// ============================================================
// ENRICHMENT SERVICE — Orquesta scraping + AI + guardado
// ============================================================

export async function enrichLead(leadId: string, userId: string) {
  const supabase = createAdminClient()

  // 1. Obtener el lead (columnas necesarias para enriquecimiento + contexto IA)
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, company_name, website, domain, email, campaign_id, sector, country, description, first_name, last_name, department')
    .eq('id', leadId)
    .eq('user_id', userId)
    .single()

  if (leadError || !lead) throw new Error('Lead no encontrado')

  // 1b. Leer configuración de IA del usuario (proveedor + modelo)
  const { data: userSettings } = await supabase
    .from('settings')
    .select('ai_provider, ai_model')
    .eq('user_id', userId)
    .single()
  const aiProvider = (userSettings?.ai_provider as string) ?? 'gemini'
  const aiModel = (userSettings?.ai_model as string) ?? 'gemini-2.5-flash'

  // 2. Scraping de la web + búsqueda Hunter en paralelo (si aplican)
  const [scrapedResult, hunterResult] = await Promise.all([
    lead.website
      ? scrapeWebContent(lead.website).catch(e => {
          console.warn(`Scraping failed for ${lead.website}:`, e)
          return null
        })
      : Promise.resolve(null),
    !lead.email && lead.domain
      ? findEmailWithHunter(lead.domain).catch(() => null)
      : Promise.resolve(null),
  ])

  const scrapedContent = scrapedResult?.content
  const scrapedTitle = scrapedResult?.title
  const scrapedDescription = scrapedResult?.description
  const emailFound = hunterResult?.email

  // 3. Análisis IA — usando proveedor y modelo del usuario
  const aiResult = await enrichLeadWithAI(lead as Lead, scrapedContent, aiProvider, aiModel)

  // 4. Upsert del enrichment (una sola query en vez de select+branch)
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
    raw_ai_response: aiResult,
    model_used: aiProvider === 'groq'
      ? (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile')
      : aiModel,
  }

  // Upsert con fallback: primero intentamos upsert (requiere UNIQUE constraint en lead_id,
  // ver migración 002_feature_updates.sql). Si falla, hacemos delete+insert como fallback.
  let enrichment: Record<string, unknown> | null = null
  const { data: upsertData, error: enrichError } = await supabase
    .from('lead_enrichments')
    .upsert(enrichmentData, { onConflict: 'lead_id' })
    .select()
    .single()

  if (enrichError) {
    // Fallback: borrar fila existente e insertar nueva
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

  // 5. Actualizar lead + activity log en paralelo
  const priority = aiResult.fit_score >= 70 ? 'high' : aiResult.fit_score >= 40 ? 'medium' : 'low'
  const updateData: Record<string, unknown> = {
    score: aiResult.fit_score,
    priority,
    is_enriched: true,
    enriched_at: new Date().toISOString(),
    status: 'enriched',
    tags: aiResult.auto_tags,
  }
  if (emailFound) updateData.email = emailFound

  await Promise.all([
    supabase.from('leads').update(updateData).eq('id', leadId),
    supabase.from('activity_logs').insert({
      lead_id: leadId,
      user_id: userId,
      campaign_id: lead.campaign_id,
      type: 'enriched',
      title: 'Lead enriquecido con IA',
      description: `Score: ${aiResult.fit_score}/100 | Prioridad: ${priority}`,
      metadata: { fit_score: aiResult.fit_score, priority },
    }),
  ])

  return { lead, enrichment, score: aiResult.fit_score, priority }
}

// Enriquecimiento masivo — concurrencia controlada (5 simultáneos, sin delays)
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
