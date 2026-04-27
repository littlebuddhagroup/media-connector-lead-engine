import { createAdminClient } from '@/lib/supabase/server'
import { enrichLeadWithAI } from './aiService'
import { scrapeWebContent, findEmailWithHunter } from './scrapingService'
import type { Lead } from '@/types'

// ============================================================
// ENRICHMENT SERVICE — Orquesta scraping + AI + guardado
// ============================================================

export async function enrichLead(leadId: string, userId: string) {
  const supabase = createAdminClient()

  // 1. Obtener el lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('user_id', userId)
    .single()

  if (leadError || !lead) throw new Error('Lead no encontrado')

  // 2. Scraping de la web (si hay URL)
  let scrapedContent: string | undefined
  let scrapedTitle: string | undefined
  let scrapedDescription: string | undefined

  if (lead.website) {
    try {
      const scraped = await scrapeWebContent(lead.website)
      scrapedContent = scraped.content
      scrapedTitle = scraped.title
      scrapedDescription = scraped.description
    } catch (e) {
      console.warn(`Scraping failed for ${lead.website}:`, e)
    }
  }

  // 3. Buscar email si no tiene (Hunter.io)
  let emailFound: string | undefined
  if (!lead.email && lead.domain) {
    try {
      const { email } = await findEmailWithHunter(lead.domain)
      emailFound = email
    } catch { /* ignorar */ }
  }

  // 4. Análisis IA
  const aiResult = await enrichLeadWithAI(lead as Lead, scrapedContent)

  // 5. Guardar enrichment
  const { data: enrichment, error: enrichError } = await supabase
    .from('lead_enrichments')
    .upsert({
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
      model_used: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    }, { onConflict: 'lead_id' })
    .select()
    .single()

  if (enrichError) throw new Error('Error guardando enrichment: ' + enrichError.message)

  // 6. Actualizar lead con score y prioridad
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

  await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId)

  // 7. Registrar actividad
  await supabase.from('activity_logs').insert({
    lead_id: leadId,
    user_id: userId,
    campaign_id: lead.campaign_id,
    type: 'enriched',
    title: 'Lead enriquecido con IA',
    description: `Score: ${aiResult.fit_score}/100 | Prioridad: ${priority}`,
    metadata: { fit_score: aiResult.fit_score, priority },
  })

  return { lead, enrichment, score: aiResult.fit_score, priority }
}

// Enriquecimiento masivo por campaña
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

  let enriched = 0
  let errors = 0

  for (const lead of leads) {
    try {
      await enrichLead(lead.id, userId)
      enriched++
      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(`Error enriching lead ${lead.id}:`, e)
      errors++
    }
  }

  return { enriched, errors }
}
