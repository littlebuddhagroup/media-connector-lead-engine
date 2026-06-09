import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// Límite alto para evitar el cap de 1000 filas de PostgREST
const BIG_LIMIT = 50000

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // RLS en campaigns filtra por equipo (migration 006)
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!campaigns || campaigns.length === 0) return NextResponse.json({ data: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Camp = Record<string, any>
  const campaignIds = (campaigns as Camp[]).map((c: Camp) => c.id as string)

  // ── Paso 1: recopilar todos los lead_id por campaña (ambas fuentes) ──────
  // Mapa: campaignId → Set<leadId>
  const campLeadIds = new Map<string, Set<string>>()
  campaignIds.forEach(id => campLeadIds.set(id, new Set()))

  // Fuente 1: leads con campaign_id directo
  const directLeadsRes = await admin
    .from('leads')
    .select('id, campaign_id')
    .in('campaign_id', campaignIds)
    .limit(BIG_LIMIT)

  for (const l of (directLeadsRes.data ?? [])) {
    campLeadIds.get(l.campaign_id)?.add(l.id)
  }

  // Fuente 2: campaign_leads junction (sin join — solo IDs)
  try {
    const junctionRes = await admin
      .from('campaign_leads')
      .select('campaign_id, lead_id')
      .in('campaign_id', campaignIds)
      .limit(BIG_LIMIT)
    if (!junctionRes.error) {
      for (const row of (junctionRes.data ?? [])) {
        campLeadIds.get(row.campaign_id)?.add(row.lead_id)
      }
    }
  } catch { /* tabla campaign_leads aún no existe */ }

  // ── Paso 2: obtener status/score de TODOS los leads únicos en una sola query
  const allLeadIds = [...new Set([...campLeadIds.values()].flatMap(s => [...s]))]

  // Mapa leadId → { campaign_id (para reconstruir), status, score }
  // Nota: un lead puede estar en varias campañas vía junction, así que usamos
  // campLeadIds como referencia de autoridad en lugar del campaign_id del lead.
  type LeadMeta = { status: string; score: number }
  const leadMeta = new Map<string, LeadMeta>()

  if (allLeadIds.length > 0) {
    // Procesar en chunks de 500 para no superar el límite de .in()
    const CHUNK = 500
    for (let i = 0; i < allLeadIds.length; i += CHUNK) {
      const chunk = allLeadIds.slice(i, i + CHUNK)
      const { data: leadsData } = await admin
        .from('leads')
        .select('id, status, score')
        .in('id', chunk)
        .limit(CHUNK)
      for (const l of (leadsData ?? [])) {
        leadMeta.set(l.id, { status: l.status ?? 'new', score: l.score ?? 0 })
      }
    }
  }

  // ── Paso 3: construir leads[] con campaign_id para el map de stats ────────
  const leads: Array<{ campaign_id: string; status: string; score: number }> = []
  for (const [cId, ids] of campLeadIds.entries()) {
    for (const lid of ids) {
      const meta = leadMeta.get(lid)
      if (meta) leads.push({ campaign_id: cId, status: meta.status, score: meta.score })
    }
  }

  // Email stats per campaign
  const { data: emails } = await supabase
    .from('emails')
    .select('campaign_id, status, opened_at')
    .in('campaign_id', campaignIds)
    .limit(BIG_LIMIT)

  // Last activity per campaign
  const { data: activities } = await supabase
    .from('activity_logs')
    .select('campaign_id, created_at')
    .in('campaign_id', campaignIds)
    .order('created_at', { ascending: false })
    .limit(BIG_LIMIT)

  // Active sequences per campaign
  const { data: sequences } = await supabase
    .from('sequences')
    .select('campaign_id, status')
    .in('campaign_id', campaignIds)
    .limit(BIG_LIMIT)

  // Build stats map
  const leadMap: Record<string, { total: number; contacted: number; replied: number; meetings: number; closed: number; avg_score: number }> = {}
  const emailMap: Record<string, { sent: number; opened: number; replied: number }> = {}
  const lastActivityMap: Record<string, string> = {}
  const seqMap: Record<string, number> = {}

  for (const lead of (leads ?? [])) {
    if (!lead.campaign_id) continue
    if (!leadMap[lead.campaign_id]) leadMap[lead.campaign_id] = { total: 0, contacted: 0, replied: 0, meetings: 0, closed: 0, avg_score: 0 }
    const m = leadMap[lead.campaign_id]
    m.total++
    if (['contacted', 'replied', 'interested', 'meeting_scheduled', 'closed'].includes(lead.status)) m.contacted++
    if (['replied', 'interested', 'meeting_scheduled', 'closed'].includes(lead.status)) m.replied++
    if (lead.status === 'meeting_scheduled') m.meetings++
    if (lead.status === 'closed') m.closed++
    m.avg_score += lead.score ?? 0
  }
  // Finalize avg_score
  for (const id of campaignIds) {
    if (leadMap[id] && leadMap[id].total > 0) {
      leadMap[id].avg_score = Math.round(leadMap[id].avg_score / leadMap[id].total)
    }
  }

  for (const email of (emails ?? [])) {
    if (!email.campaign_id) continue
    if (!emailMap[email.campaign_id]) emailMap[email.campaign_id] = { sent: 0, opened: 0, replied: 0 }
    const m = emailMap[email.campaign_id]
    m.sent++
    if (email.opened_at || email.status === 'opened') m.opened++
    if (email.status === 'replied') m.replied++
  }

  // Last activity (activities already ordered desc, first match wins)
  for (const act of (activities ?? [])) {
    if (act.campaign_id && !lastActivityMap[act.campaign_id]) {
      lastActivityMap[act.campaign_id] = act.created_at
    }
  }

  for (const seq of (sequences ?? [])) {
    if (!seq.campaign_id) continue
    if (!seqMap[seq.campaign_id]) seqMap[seq.campaign_id] = 0
    if (seq.status === 'active') seqMap[seq.campaign_id]++
  }

  const enriched = (campaigns as Camp[]).map((c: Camp) => {
    const ls = leadMap[c.id] ?? { total: 0, contacted: 0, replied: 0, meetings: 0, closed: 0, avg_score: 0 }
    const es = emailMap[c.id] ?? { sent: 0, opened: 0, replied: 0 }
    const contact_rate = ls.total > 0 ? Math.round((ls.contacted / ls.total) * 100) : 0
    const open_rate = es.sent > 0 ? Math.round((es.opened / es.sent) * 100) : 0
    const reply_rate = es.sent > 0 ? Math.round((es.replied / es.sent) * 100) : 0

    return {
      ...c,
      stats: {
        leads: ls.total,
        contacted: ls.contacted,
        replied: ls.replied,
        meetings: ls.meetings,
        closed: ls.closed,
        avg_score: ls.avg_score,
        contact_rate,
        emails_sent: es.sent,
        open_rate,
        reply_rate,
        active_sequences: seqMap[c.id] ?? 0,
        last_activity: lastActivityMap[c.id] ?? null,
      }
    }
  })

  return NextResponse.json({ data: enriched })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { name, description, country, sector, language, keywords, target_type, target_size, status } = body

  if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description,
      country,
      sector,
      language: language ?? 'es',
      keywords: Array.isArray(keywords) ? keywords : [],
      target_type,
      target_size,
      status: status ?? 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
