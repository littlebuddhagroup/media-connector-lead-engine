import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

// ============================================================
// CRON JOB — Briefing ejecutivo diario — MyMediaConnect
// Schedule: 0 8 * * *  (08:00 cada día)
// Envía a cada usuario un resumen del estado de su CRM y
// de las acciones previstas para las próximas 24h.
// ============================================================

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = `${process.env.RESEND_FROM_NAME ?? 'MyMediaConnect'} <${process.env.RESEND_FROM_EMAIL ?? 'hello@mymediaconnect.com'}>`

function buildBriefingHtml(data: {
  userEmail: string
  totalLeads: number
  activeSequences: number
  emailsSentYesterday: number
  emailsOpenedYesterday: number
  upcomingToday: { company: string; step: number; scheduledFor: string }[]
  hotLeads: { company: string; reason: string }[]
  date: string
}): string {
  const openRate = data.emailsSentYesterday > 0
    ? Math.round((data.emailsOpenedYesterday / data.emailsSentYesterday) * 100)
    : 0

  const upcomingRows = data.upcomingToday.length
    ? data.upcomingToday.map(u => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#1e293b;">${u.company}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;text-align:center;">Touch ${u.step}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#6366f1;text-align:right;">${u.scheduledFor}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="padding:16px 12px;font-size:12px;color:#94a3b8;text-align:center;">No scheduled sends for today</td></tr>`

  const hotRows = data.hotLeads.length
    ? data.hotLeads.map(h => `
        <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${h.company}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">${h.reason}</p>
        </div>`).join('')
    : `<p style="font-size:12px;color:#94a3b8;margin:0;">No hot leads detected</p>`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#1e1b4b;border-radius:16px 16px 0 0;padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#818cf8;">
                  MYMEDIACONNECT INTELLIGENCE
                </p>
                <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
                  Daily Briefing
                </h1>
                <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">${data.date}</p>
              </td>
              <td align="right" style="vertical-align:top;">
                <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:99px;padding:6px 12px;">
                  <span style="width:6px;height:6px;background:#6366f1;border-radius:50%;box-shadow:0 0 6px #6366f1;display:inline-block;"></span>
                  <span style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#818cf8;">System active</span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- KPIs -->
        <tr><td style="background:#fff;padding:24px 32px;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="25%" style="text-align:center;padding:12px;">
                <p style="margin:0;font-size:28px;font-weight:800;color:#1e293b;">${data.totalLeads}</p>
                <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">CRM Leads</p>
              </td>
              <td width="25%" style="text-align:center;padding:12px;border-left:1px solid #f1f5f9;">
                <p style="margin:0;font-size:28px;font-weight:800;color:#6366f1;">${data.activeSequences}</p>
                <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">Active sequences</p>
              </td>
              <td width="25%" style="text-align:center;padding:12px;border-left:1px solid #f1f5f9;">
                <p style="margin:0;font-size:28px;font-weight:800;color:#1e293b;">${data.emailsSentYesterday}</p>
                <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">Emails yesterday</p>
              </td>
              <td width="25%" style="text-align:center;padding:12px;border-left:1px solid #f1f5f9;">
                <p style="margin:0;font-size:28px;font-weight:800;color:${openRate > 30 ? '#10b981' : '#1e293b'};">${openRate}%</p>
                <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">Open rate</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Scheduled today -->
        <tr><td style="background:#fff;padding:0 32px 24px;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9;">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">
            Scheduled sends today
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;">
            ${upcomingRows}
          </table>
        </td></tr>

        <!-- Hot leads -->
        <tr><td style="background:#fff;padding:0 32px 28px;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9;">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">
            Hot leads
          </p>
          <div style="border:1px solid #f1f5f9;border-radius:10px;padding:12px 16px;">
            ${hotRows}
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #f1f5f9;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            Automatically generated by <strong style="color:#1e293b;">MyMediaConnect Intelligence</strong>
          </p>
          <p style="margin:6px 0 0;font-size:10px;color:#cbd5e1;">
            To stop receiving this briefing, disable it in Settings → Notifications
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: users } = await admin.auth.admin.listUsers()
  if (!users?.users?.length) return NextResponse.json({ sent: 0 })

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setHours(23, 59, 59, 999)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  let sent = 0

  for (const authUser of users.users) {
    if (!authUser.email) continue

    const { data: settings } = await admin
      .from('settings')
      .select('briefing_enabled, notification_emails')
      .eq('user_id', authUser.id)
      .single()
    if (settings?.briefing_enabled === false) continue

    const recipients: string[] = settings?.notification_emails
      ? settings.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [authUser.email]
    if (!recipients.length) continue

    try {
      const [
        { count: totalLeads },
        { count: activeSequences },
        { count: emailsSentYesterday },
        { count: emailsOpenedYesterday },
        { data: upcomingSteps },
        { data: hotLeadsData },
      ] = await Promise.all([
        admin.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', authUser.id),
        admin.from('sequences').select('*', { count: 'exact', head: true }).eq('user_id', authUser.id).eq('status', 'active'),
        admin.from('activity_logs').select('*', { count: 'exact', head: true })
          .eq('user_id', authUser.id).eq('type', 'email_sent')
          .gte('created_at', yesterday.toISOString())
          .lte('created_at', yesterdayEnd.toISOString()),
        admin.from('activity_logs').select('*', { count: 'exact', head: true })
          .eq('user_id', authUser.id).eq('type', 'email_opened')
          .gte('created_at', yesterday.toISOString())
          .lte('created_at', yesterdayEnd.toISOString()),
        admin.from('sequence_steps')
          .select('step_number, scheduled_for, sequence:sequences(lead:leads(company_name))')
          .eq('user_id', authUser.id)
          .eq('status', 'pending')
          .gte('scheduled_for', todayStart.toISOString())
          .lte('scheduled_for', todayEnd.toISOString())
          .order('scheduled_for')
          .limit(8),
        admin.from('leads')
          .select('company_name, status')
          .eq('user_id', authUser.id)
          .in('status', ['interested', 'replied', 'meeting_scheduled'])
          .order('updated_at', { ascending: false })
          .limit(5),
      ])

      const upcoming = (upcomingSteps ?? []).map((s: Record<string, unknown>) => {
        const seq = s.sequence as { lead?: { company_name?: string } } | null
        return {
          company: seq?.lead?.company_name ?? '—',
          step: s.step_number as number,
          scheduledFor: s.scheduled_for
            ? new Date(s.scheduled_for as string).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : '—',
        }
      })

      const hotLeads = (hotLeadsData ?? []).map((l: { company_name: string; status: string }) => ({
        company: l.company_name,
        reason: l.status === 'replied' ? 'Replied to an email'
          : l.status === 'interested' ? 'Marked as interested'
          : 'Meeting scheduled',
      }))

      const dateStr = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })

      const html = buildBriefingHtml({
        userEmail: authUser.email,
        totalLeads: totalLeads ?? 0,
        activeSequences: activeSequences ?? 0,
        emailsSentYesterday: emailsSentYesterday ?? 0,
        emailsOpenedYesterday: emailsOpenedYesterday ?? 0,
        upcomingToday: upcoming,
        hotLeads,
        date: dateStr,
      })

      await resend.emails.send({
        from: FROM,
        to: recipients,
        subject: `MyMediaConnect Briefing · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`,
        html,
      })

      await admin.from('activity_logs').insert({
        user_id: authUser.id,
        type: 'briefing_sent',
        title: 'Daily briefing sent',
        description: `${totalLeads ?? 0} leads · ${activeSequences ?? 0} active sequences · ${emailsSentYesterday ?? 0} emails yesterday`,
      })

      sent++
    } catch {
      // Continue with next user
    }
  }

  return NextResponse.json({ sent, timestamp: new Date().toISOString() })
}
