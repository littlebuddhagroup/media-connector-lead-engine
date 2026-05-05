import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getTeamUserIds } from '@/lib/teams'

// ============================================================
// ANALYTICS — Métricas de emails, campañas y secuencias
// GET /api/analytics?days=30
// ============================================================

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const teamUserIds = await getTeamUserIds(user.id)

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()

  // ─── 1. Todos los emails en el período ────────────────────
  const { data: emails } = await admin
    .from('emails')
    .select('id, status, sent_at, opened_at, replied_at, clicked_at, from_email, campaign_id, subject, to_email, to_name, lead_id, open_count, click_count')
    .in('user_id', teamUserIds)
    .gte('sent_at', sinceStr)
    .order('sent_at', { ascending: false })

  type EmailRec = {
    id: string; status: string | null; sent_at: string | null; opened_at: string | null
    replied_at: string | null; clicked_at: string | null; from_email: string | null
    campaign_id: string | null; subject: string | null; to_email: string | null
    to_name: string | null; lead_id: string | null; open_count: number | null; click_count: number | null
  }
  const allEmails = (emails ?? []) as EmailRec[]

  const totalSent = allEmails.length
  const totalDelivered = allEmails.filter(e => e.status !== 'bounced' && e.status !== 'failed').length
  const totalOpened = allEmails.filter(e => e.opened_at || e.status === 'opened' || e.status === 'replied' || e.status === 'clicked').length
  const totalClicked = allEmails.filter(e => e.clicked_at || e.status === 'clicked').length
  const totalReplied = allEmails.filter(e => e.replied_at || e.status === 'replied').length
  const totalBounced = allEmails.filter(e => e.status === 'bounced').length
  const totalFailed = allEmails.filter(e => e.status === 'failed').length
  const totalSpam = allEmails.filter(e => e.status === 'spam').length

  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0
  const bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0

  // ─── 2. Desglose por cuenta de envío ─────────────────────
  const byAccount: Record<string, { sent: number; opened: number; clicked: number; replied: number; bounced: number }> = {}
  for (const email of allEmails) {
    const acc = email.from_email || 'Sin cuenta'
    if (!byAccount[acc]) byAccount[acc] = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
    byAccount[acc].sent++
    if (email.opened_at || email.status === 'opened' || email.status === 'replied' || email.status === 'clicked') byAccount[acc].opened++
    if ((email as Record<string,unknown>).clicked_at || email.status === 'clicked') byAccount[acc].clicked++
    if (email.replied_at || email.status === 'replied') byAccount[acc].replied++
    if (email.status === 'bounced') byAccount[acc].bounced++
  }

  // ─── 3. Evolución diaria (últimos N días) ─────────────────
  const dailyMap: Record<string, { sent: number; opened: number; clicked: number; replied: number; bounced: number }> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
  }
  for (const email of allEmails) {
    const key = email.sent_at?.slice(0, 10)
    if (key && dailyMap[key]) {
      dailyMap[key].sent++
      if (email.opened_at || email.status === 'opened' || email.status === 'replied' || email.status === 'clicked') dailyMap[key].opened++
      if ((email as Record<string,unknown>).clicked_at || email.status === 'clicked') dailyMap[key].clicked++
      if (email.replied_at || email.status === 'replied') dailyMap[key].replied++
      if (email.status === 'bounced') dailyMap[key].bounced++
    }
  }
  const daily = Object.entries(dailyMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ─── 4. Por campaña ───────────────────────────────────────
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, name')
    .in('user_id', teamUserIds)

  const campaignMap = new Map<string, string>((campaigns ?? []).map((c: { id: string; name: string }) => [c.id, c.name] as [string, string]))

  const byCampaign: Record<string, { name: string; sent: number; opened: number; clicked: number; replied: number; bounced: number }> = {}
  for (const email of allEmails) {
    const cid = email.campaign_id || '_sin_campaña'
    const cname = (email.campaign_id ? campaignMap.get(email.campaign_id) : null) ?? 'Sin campaña'
    if (!byCampaign[cid]) byCampaign[cid] = { name: cname, sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
    byCampaign[cid].sent++
    if (email.opened_at || email.status === 'opened' || email.status === 'replied' || email.status === 'clicked') byCampaign[cid].opened++
    if (email.clicked_at || email.status === 'clicked') byCampaign[cid].clicked++
    if (email.replied_at || email.status === 'replied') byCampaign[cid].replied++
    if (email.status === 'bounced') byCampaign[cid].bounced++
  }

  // ─── 5. Leads para drill-down (enriquecer emails con nombre empresa) ────────
  const leadIds = [...new Set(allEmails.map(e => (e as Record<string,unknown>).lead_id as string).filter(Boolean))]
  let leadMap: Record<string, { company_name: string; email: string }> = {}
  if (leadIds.length > 0) {
    const { data: leadsData } = await admin
      .from('leads')
      .select('id, company_name, email')
      .in('id', leadIds)
    ;(leadsData ?? []).forEach((l: { id: string; company_name: string; email: string }) => {
      leadMap[l.id] = { company_name: l.company_name, email: l.email }
    })
  }

  // ─── 6. Emails recientes con info de lead ────────────────────────────────
  const mapEmail = (e: typeof allEmails[0]) => ({
    id: e.id,
    subject: e.subject,
    from_email: e.from_email,
    to_email: (e as Record<string, unknown>).to_email as string | null,
    to_name: (e as Record<string, unknown>).to_name as string | null,
    lead_id: (e as Record<string, unknown>).lead_id as string | null,
    company_name: (e as Record<string, unknown>).lead_id
      ? (leadMap[(e as Record<string, unknown>).lead_id as string]?.company_name ?? null)
      : null,
    status: e.status,
    sent_at: e.sent_at,
    opened_at: e.opened_at,
    clicked_at: (e as Record<string, unknown>).clicked_at as string | null ?? null,
    replied_at: e.replied_at,
    open_count: (e as Record<string, unknown>).open_count as number | null ?? null,
    click_count: (e as Record<string, unknown>).click_count as number | null ?? null,
    campaign_id: e.campaign_id,
    campaign_name: (e.campaign_id && campaignMap.get(e.campaign_id)) || null,
  })

  const recentEmails = allEmails.slice(0, 100).map(mapEmail)

  // ─── 7. Drill-down por estado (bounced, opened, replied, clicked, spam) ─────────────────
  const bouncedEmails = allEmails.filter(e => e.status === 'bounced').map(mapEmail)
  const openedEmails  = allEmails.filter(e => e.opened_at || e.status === 'opened' || e.status === 'replied' || e.status === 'clicked').map(mapEmail)
  const clickedEmails = allEmails.filter(e => e.clicked_at || e.status === 'clicked').map(mapEmail)
  const repliedEmails = allEmails.filter(e => e.replied_at || e.status === 'replied').map(mapEmail)
  const failedEmails  = allEmails.filter(e => e.status === 'failed').map(mapEmail)
  const spamEmails    = allEmails.filter(e => e.status === 'spam').map(mapEmail)

  return NextResponse.json({
    data: {
      period_days: days,
      summary: {
        total_sent: totalSent,
        total_delivered: totalDelivered,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        total_replied: totalReplied,
        total_bounced: totalBounced,
        total_failed: totalFailed,
        total_spam: totalSpam,
        open_rate: openRate,
        click_rate: clickRate,
        reply_rate: replyRate,
        bounce_rate: bounceRate,
        delivery_rate: deliveryRate,
      },
      by_account: Object.entries(byAccount).map(([account, v]) => ({
        account,
        ...v,
        open_rate:   v.sent > 0 ? Math.round((v.opened  / v.sent) * 100) : 0,
        click_rate:  v.sent > 0 ? Math.round((v.clicked / v.sent) * 100) : 0,
        reply_rate:  v.sent > 0 ? Math.round((v.replied / v.sent) * 100) : 0,
        bounce_rate: v.sent > 0 ? Math.round((v.bounced / v.sent) * 100) : 0,
      })),
      by_campaign: Object.values(byCampaign).sort((a, b) => b.sent - a.sent).map(c => ({
        ...c,
        open_rate:   c.sent > 0 ? Math.round((c.opened  / c.sent) * 100) : 0,
        click_rate:  c.sent > 0 ? Math.round((c.clicked / c.sent) * 100) : 0,
        reply_rate:  c.sent > 0 ? Math.round((c.replied / c.sent) * 100) : 0,
        bounce_rate: c.sent > 0 ? Math.round((c.bounced / c.sent) * 100) : 0,
      })),
      daily,
      recent_emails: recentEmails,
      // Drill-down por estado — para el panel expandible de analytics
      drill_down: {
        bounced: bouncedEmails,
        opened: openedEmails,
        clicked: clickedEmails,
        replied: repliedEmails,
        failed: failedEmails,
        spam: spamEmails,
      },
    }
  })
}
