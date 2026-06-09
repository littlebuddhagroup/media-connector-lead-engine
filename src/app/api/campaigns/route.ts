import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!campaigns || campaigns.length === 0) return NextResponse.json({ data: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Camp = Record<string, any>
  const campaignIds = (campaigns as Camp[]).map((c: Camp) => c.id as string)

  // ── Conteo y estado de leads ─────────────────────────────────────────────
  // Problema: PostgREST max-rows (default 1000) limita filas incluso con admin
  // client. La solución es usar count:'exact' (devuelve el total real en el
  // header Content-Range) y, para los estados, hacer queries paginadas.
  //
  // Estrategia:
  //  • total exacto   → { count:'exact', head:true } por campaña (parallel)
  //  • breakdown de estado → primera página de leads (hasta 1000) por campaña;
  //    suficiente para tasas y métricas en la mayoría de campañas reales
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type LeadRow = { status: string; score: number }
  type CampStats = { total: number; rows: LeadRow[] }

  const perCampStats = await Promise.all(
    campaignIds.map(async (cId): Promise<[string, CampStats]> => {
      // COUNT exacto desde junction (no limitado por max-rows)
      const { count } = await admin
        .from('campaign_leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', cId)

      // Primera página de leads para calcular tasas de contacto/respuesta
      const { data: rows } = await admin
        .from('campaign_leads')
        .select('leads!inner(status, score)')
        .eq('campaign_id', cId)
        .limit(1000)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leadRows: LeadRow[] = (rows ?? []).map((r: any) => ({
        status: r.leads?.status ?? 'new',
        score: r.leads?.score ?? 0,
      }))

      return [cId, { total: count ?? 0, rows: leadRows }]
    })
  )

  const campStatsMap = new Map<string, CampStats>(perCampStats)

  // Array plano de leads con campaign_id para reutilizar el mismo build de stats
  const leads: Array<{ campaign_id: string; status: string; score: number }> = []
  for (const [cId, { rows }] of campStatsMap.entries()) {
    for (const r of rows) leads.push({ campaign_id: cId, ...r })
  }

  // Email stats per campaign
  const { data: emails } = await supabase
    .from('emails')
    .select('campaign_id, status, opened_at')
    .in('campaign_id', campaignIds)

  // Last activity per campaign
  const { data: activities } = await supabase
    .from('activity_logs')
    .select('campaign_id, created_at')
    .in('campaign_id', campaignIds)
    .order('created_at', { ascending: false })

  // Active sequences per campaign
  const { data: sequences } = await supabase
    .from('sequences')
    .select('campaign_id, status')
    .in('campaign_id', campaignIds)

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
    // Total exacto del COUNT real; los rates se calculan sobre la muestra
    const exactTotal = campStatsMap.get(c.id)?.total ?? ls.total
    const sampleTotal = ls.total  // puede ser < exactTotal si >1000 leads
    const contact_rate = sampleTotal > 0 ? Math.round((ls.contacted / sampleTotal) * 100) : 0
    const open_rate = es.sent > 0 ? Math.round((es.opened / es.sent) * 100) : 0
    const reply_rate = es.sent > 0 ? Math.round((es.replied / es.sent) * 100) : 0

    return {
      ...c,
      stats: {
        leads: exactTotal,
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
