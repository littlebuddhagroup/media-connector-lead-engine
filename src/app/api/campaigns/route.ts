import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // RLS en campaigns ya filtra por equipo (migration 006)
  // No se necesita filtro manual de user_id
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!campaigns || campaigns.length === 0) return NextResponse.json({ data: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Camp = Record<string, any>
  const campaignIds = (campaigns as Camp[]).map((c: Camp) => c.id as string)

  // Lead stats per campaign — fuente 1: leads.campaign_id (siempre disponible)
  const directLeadsRes = await supabase
    .from('leads')
    .select('id, campaign_id, status, score')
    .in('campaign_id', campaignIds)

  const seen = new Set<string>()
  const leads: Array<{ campaign_id: string; status: string; score: number }> = []

  for (const l of (directLeadsRes.data ?? [])) {
    const key = `${l.campaign_id}:${l.id}`
    if (!seen.has(key)) {
      seen.add(key)
      leads.push({ campaign_id: l.campaign_id, status: l.status, score: l.score ?? 0 })
    }
  }

  // Fuente 2: campaign_leads junction (solo si la tabla existe)
  try {
    const junctionRes = await supabase
      .from('campaign_leads')
      .select('campaign_id, lead_id, lead:leads(id, status, score)')
      .in('campaign_id', campaignIds)
    if (!junctionRes.error) {
      for (const row of (junctionRes.data ?? [])) {
        const r = row as { campaign_id: string; lead_id: string; lead: { id: string; status: string; score: number } | null }
        if (!r.lead) continue
        const key = `${r.campaign_id}:${r.lead_id}`
        if (!seen.has(key)) {
          seen.add(key)
          leads.push({ campaign_id: r.campaign_id, status: r.lead.status, score: r.lead.score ?? 0 })
        }
      }
    }
  } catch { /* tabla campaign_leads aún no existe en Supabase */ }

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
