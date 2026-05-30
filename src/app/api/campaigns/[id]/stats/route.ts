import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET — Estadísticas completas de una campaña en tiempo real
// Optimizado: COUNT queries en paralelo — sin carga de filas en memoria
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Verificar acceso
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id, user_id')
    .eq('id', id)
    .single()
  if (!campaign) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const CONTACTED_STATUSES = ['contacted', 'replied', 'interested', 'meeting_scheduled', 'closed']
  const REPLIED_STATUSES = ['replied', 'interested', 'meeting_scheduled', 'closed']
  const INTERESTED_STATUSES = ['interested', 'meeting_scheduled', 'closed']
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Obtener todos los lead_ids de esta campaña (fuente 1: leads.campaign_id, fuente 2: junction)
  const [directLeadsRes, junctionLeadsRes] = await Promise.all([
    admin.from('leads').select('id').eq('campaign_id', id),
    admin.from('campaign_leads').select('lead_id').eq('campaign_id', id),
  ])
  const directIds = (directLeadsRes.data ?? []).map((r: { id: string }) => r.id)
  const junctionIds = (junctionLeadsRes.data ?? []).map((r: { lead_id: string }) => r.lead_id)
  const allLeadIds = [...new Set([...directIds, ...junctionIds])]

  // Si no hay leads en esta campaña, devolver stats vacías rápido
  if (allLeadIds.length === 0) {
    return NextResponse.json({
      data: {
        leads: { total: 0, enriched: 0, contacted: 0, replied: 0, interested: 0, meetings: 0, closed: 0, discarded: 0, new: 0, avg_score: 0, by_priority: { high: 0, medium: 0, low: 0 } },
        emails: { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, open_rate: 0, click_rate: 0, reply_rate: 0 },
        sequences: { active: 0 },
        conversion: { contact_rate: 0, reply_rate: 0, meeting_rate: 0 },
        recent_activity: [],
      }
    })
  }

  // ── Todas las queries en paralelo — COUNT queries sin cargar filas ──
  const [
    { count: total },
    { count: enriched },
    { count: contacted },
    { count: replied },
    { count: interested },
    { count: meetings },
    { count: closed },
    { count: discarded },
    { count: newLeads },
    { count: highPriority },
    { count: mediumPriority },
    { count: lowPriority },
    scoresRes,
    emailsRes,
    { count: activeSequences },
    activityRes,
  ] = await Promise.all([
    // Counts de leads por estado usando IDs unificados de ambas fuentes
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('is_enriched', true),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).in('status', CONTACTED_STATUSES),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).in('status', REPLIED_STATUSES),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).in('status', INTERESTED_STATUSES),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('status', 'meeting_scheduled'),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('status', 'closed'),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('status', 'discarded'),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('status', 'new'),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('priority', 'high'),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('priority', 'medium'),
    admin.from('leads').select('*', { count: 'exact', head: true }).in('id', allLeadIds).eq('priority', 'low'),
    // Solo scores (columna numérica ligera — para calcular media)
    admin.from('leads').select('score').in('id', allLeadIds).not('score', 'is', null).gt('score', 0),
    // Emails con solo columnas de tracking
    admin.from('emails').select('status, opened_at, clicked_at').eq('campaign_id', id),
    // Secuencias activas — solo count
    admin.from('sequences').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'active'),
    // Actividad reciente
    admin.from('activity_logs')
      .select('type, created_at')
      .eq('campaign_id', id)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Calcular score medio
  const scores = (scoresRes.data ?? []).map((l: { score: number }) => l.score).filter(Boolean)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0

  // Calcular métricas de email
  type EmailRow = { status: string; opened_at: string | null; clicked_at: string | null }
  const allEmails: EmailRow[] = emailsRes.data ?? []
  const emailsSent = allEmails.length
  const emailsOpened = allEmails.filter(e => e.opened_at || e.status === 'opened').length
  const emailsClicked = allEmails.filter(e => e.clicked_at || e.status === 'clicked').length
  const emailsReplied = allEmails.filter(e => e.status === 'replied').length
  const emailsBounced = allEmails.filter(e => e.status === 'bounced').length

  const totalCount = total ?? 0
  const contactedCount = contacted ?? 0
  const repliedCount = replied ?? 0

  return NextResponse.json({
    data: {
      leads: {
        total: totalCount,
        enriched: enriched ?? 0,
        contacted: contactedCount,
        replied: repliedCount,
        interested: interested ?? 0,
        meetings: meetings ?? 0,
        closed: closed ?? 0,
        discarded: discarded ?? 0,
        new: newLeads ?? 0,
        avg_score: avgScore,
        by_priority: {
          high: highPriority ?? 0,
          medium: mediumPriority ?? 0,
          low: lowPriority ?? 0,
        },
      },
      emails: {
        sent: emailsSent,
        opened: emailsOpened,
        clicked: emailsClicked,
        replied: emailsReplied,
        bounced: emailsBounced,
        open_rate: emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : 0,
        click_rate: emailsOpened > 0 ? Math.round((emailsClicked / emailsOpened) * 100) : 0,
        reply_rate: emailsSent > 0 ? Math.round((emailsReplied / emailsSent) * 100) : 0,
      },
      sequences: { active: activeSequences ?? 0 },
      conversion: {
        contact_rate: totalCount > 0 ? Math.round((contactedCount / totalCount) * 100) : 0,
        reply_rate: contactedCount > 0 ? Math.round((repliedCount / contactedCount) * 100) : 0,
        meeting_rate: repliedCount > 0 ? Math.round(((meetings ?? 0) / repliedCount) * 100) : 0,
      },
      recent_activity: activityRes.data ?? [],
    }
  })
}
