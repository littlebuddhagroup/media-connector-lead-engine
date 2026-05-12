import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getTeamUserIds } from '@/lib/teams'

// GET — Exporta todos los eventos de actividad (sin paginación) para PDF/Excel
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const filter = url.searchParams.get('filter') ?? ''
  const days = parseInt(url.searchParams.get('days') ?? '90', 10)

  const admin = createAdminClient()
  const teamUserIds = await getTeamUserIds(user.id)

  const since = new Date()
  since.setDate(since.getDate() - days)

  let query = admin
    .from('activity_logs')
    .select('id, type, title, description, created_at, lead_id, campaign_id, user_id')
    .in('user_id', teamUserIds)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000)

  if (filter === 'email') {
    query = query.in('type', ['email_sent', 'email_opened', 'email_clicked', 'email_bounced', 'email_replied'])
  } else if (filter === 'reply') {
    query = query.in('type', ['email_replied', 'reply_detected', 'sequence_replied'])
  } else if (filter === 'lead') {
    query = query.in('type', ['lead_created', 'imported', 'status_changed', 'note_added'])
  } else if (filter === 'enriched') {
    query = query.eq('type', 'enriched')
  } else if (filter === 'campaign') {
    query = query.in('type', ['campaign_assigned', 'email_sent'])
  }

  const { data: activities, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolver nombres de leads
  const leadIds = [...new Set((activities ?? []).map((a: { lead_id?: string }) => a.lead_id).filter(Boolean))] as string[]
  const leadNames: Record<string, string> = {}
  if (leadIds.length > 0) {
    const { data: leadsData } = await admin
      .from('leads')
      .select('id, company_name')
      .in('id', leadIds)
    ;(leadsData ?? []).forEach((l: { id: string; company_name: string }) => {
      leadNames[l.id] = l.company_name
    })
  }

  // Resolver nombres de campañas
  const campaignIds = [...new Set((activities ?? []).map((a: { campaign_id?: string }) => a.campaign_id).filter(Boolean))] as string[]
  const campaignNames: Record<string, string> = {}
  if (campaignIds.length > 0) {
    const { data: campsData } = await admin
      .from('campaigns')
      .select('id, name')
      .in('id', campaignIds)
    ;(campsData ?? []).forEach((c: { id: string; name: string }) => {
      campaignNames[c.id] = c.name
    })
  }

  type ActRow = { id: string; type: string; title: string; description?: string; created_at: string; lead_id?: string; campaign_id?: string; user_id: string }

  // Calcular resumen por tipo de evento
  const summary: Record<string, number> = {}
  for (const act of (activities ?? []) as ActRow[]) {
    summary[act.type] = (summary[act.type] ?? 0) + 1
  }

  const rows = ((activities ?? []) as ActRow[]).map((act: ActRow) => ({
    ...act,
    lead_name: act.lead_id ? (leadNames[act.lead_id] ?? '') : '',
    campaign_name: act.campaign_id ? (campaignNames[act.campaign_id] ?? '') : '',
  }))

  return NextResponse.json({ data: rows, summary, total: rows.length, days })
}
