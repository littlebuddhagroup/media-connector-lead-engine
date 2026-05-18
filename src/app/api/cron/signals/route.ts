import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

// ============================================================
// CRON JOB — Artwork & Packaging Signal Detector — MyMediaConnect
// Schedule: 0 6 * * *  (06:00 every day)
//
// Monitors active leads looking for:
//   · New packaging / artwork manager hired
//   · Product launch or SKU expansion
//   · New market or geographic expansion
//   · Funding / investment round
//   · Regulatory compliance issue (labelling, FSSC, ISO)
// ============================================================

const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? ''
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = `${process.env.RESEND_FROM_NAME ?? 'MyMediaConnect'} <${process.env.RESEND_FROM_EMAIL ?? 'hello@mymediaconnect.com'}>`

const SIGNAL_QUERIES = [
  {
    type: 'new_packaging_lead',
    label: 'New packaging or artwork manager hired',
    emoji: '👤',
    templates: [
      '{company} new packaging manager',
      '{company} artwork manager hired',
      '{company} nuevo responsable packaging',
    ],
    scoreBoost: 25,
    urgency: 'high' as const,
    angle: 'New packaging managers typically audit existing workflows in their first 90 days. This is the ideal moment to present a proofing platform — they want to establish process, not inherit chaos.',
  },
  {
    type: 'product_launch',
    label: 'New product or SKU expansion',
    emoji: '🚀',
    templates: [
      '{company} new product launch',
      '{company} lanzamiento nuevo producto',
      '{company} nueva gama',
    ],
    scoreBoost: 30,
    urgency: 'critical' as const,
    angle: 'A product launch means new artwork files, new approvals, new labelling versions. If their current proofing process is manual or email-based, this surge in volume is where errors happen — and errors delay time-to-market.',
  },
  {
    type: 'market_expansion',
    label: 'Geographic expansion or new market entry',
    emoji: '🌍',
    templates: [
      '{company} expansion international',
      '{company} new market launch',
      '{company} expansion europa',
    ],
    scoreBoost: 20,
    urgency: 'high' as const,
    angle: 'Multi-market expansion means multi-language packaging, local regulatory variants, and multiple approval chains. This complexity breaks manual processes. MyMediaConnect centralises all versions and approvals in one platform.',
  },
  {
    type: 'funding',
    label: 'Investment round or funding',
    emoji: '💰',
    templates: [
      '{company} ronda inversión',
      '{company} funding round',
      '{company} investment series',
    ],
    scoreBoost: 20,
    urgency: 'high' as const,
    angle: 'Post-funding companies scale fast — more SKUs, faster launches, more markets. Investors pressure for speed and error-free execution. The window to introduce process tooling is right now, before the chaos scales.',
  },
  {
    type: 'compliance_issue',
    label: 'Regulatory or labelling compliance issue',
    emoji: '⚠️',
    templates: [
      '{company} regulatory recall',
      '{company} labelling error',
      '{company} product recall packaging',
    ],
    scoreBoost: 35,
    urgency: 'critical' as const,
    angle: 'A labelling recall is the most powerful proof point for MyMediaConnect. They have just experienced the cost of inadequate proofing first-hand. The buying decision is emotional and immediate — act fast.',
  },
]

const URGENCY_COLORS: Record<string, string> = {
  'critical': '#ef4444',
  'high':     '#f59e0b',
  'medium':   '#3b82f6',
}

function buildSignalEmailHtml(signals: {
  company: string
  leadId: string
  signalLabel: string
  signalEmoji: string
  urgency: 'critical' | 'high' | 'medium'
  angle: string
  snippet: string
  newScore: number
  link?: string
  sector?: string
}[]): string {
  const rows = signals.map(s => `
    <div style="margin-bottom:20px;padding:20px;background:#fff;border:1px solid #f1f5f9;border-radius:12px;border-left:4px solid ${URGENCY_COLORS[s.urgency]};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 2px;font-size:18px;">${s.signalEmoji}</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${s.company}</p>
            ${s.sector ? `<p style="margin:2px 0 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">${s.sector}</p>` : ''}
          </td>
          <td align="right" style="vertical-align:top;">
            <span style="display:inline-block;padding:4px 10px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;background:${URGENCY_COLORS[s.urgency]}18;color:${URGENCY_COLORS[s.urgency]};">
              ${s.urgency === 'critical' ? '🔴 Critical' : s.urgency === 'high' ? '🟡 High' : '🔵 Medium'}
            </span>
          </td>
        </tr>
      </table>

      <div style="margin:12px 0;padding:10px 12px;background:#f8fafc;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">Signal detected</p>
        <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${s.signalLabel}</p>
        ${s.snippet ? `<p style="margin:6px 0 0;font-size:12px;color:#64748b;font-style:italic;">"${s.snippet.slice(0, 180)}..."</p>` : ''}
        ${s.link ? `<a href="${s.link}" style="display:inline-block;margin-top:6px;font-size:11px;color:#6366f1;">View source →</a>` : ''}
      </div>

      <div style="margin:12px 0 0;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#16a34a;">Recommended angle</p>
        <p style="margin:0;font-size:12px;color:#15803d;line-height:1.6;">${s.angle}</p>
      </div>

      <div style="margin:12px 0 0;">
        <span style="font-size:11px;color:#94a3b8;">Score updated to <strong style="color:#1e293b;">${s.newScore}/100</strong></span>
      </div>
    </div>
  `).join('')

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
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#a5b4fc;">
            MYMEDIACONNECT · SIGNAL DETECTOR
          </p>
          <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
            🎯 ${signals.length === 1 ? 'New buying signal detected' : `${signals.length} buying signals detected`}
          </h1>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">
            ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </td></tr>

        <!-- Intro -->
        <tr><td style="background:#fff;padding:20px 32px 8px;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9;">
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
            The system has detected ${signals.length === 1 ? 'a high-value signal' : 'high-value signals'} in ${signals.length === 1 ? 'an active CRM lead' : 'active CRM leads'}.
            Review the recommended angle and act while the window is open.
          </p>
        </td></tr>

        <!-- Signals -->
        <tr><td style="background:#fff;padding:16px 32px 28px;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9;">
          ${rows}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #f1f5f9;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            Automatically generated by <strong style="color:#1e293b;">MyMediaConnect Intelligence</strong>
          </p>
          <p style="margin:6px 0 0;font-size:10px;color:#cbd5e1;">
            Disable these alerts in Settings → Notifications
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function searchSignal(query: string): Promise<{ found: boolean; snippet?: string; link?: string }> {
  try {
    const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&engine=google&num=3&gl=gb&hl=en&api_key=${SERPAPI_KEY}&tbs=qdr:m`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { found: false }
    const data = await res.json()
    const results = data.organic_results ?? []
    const relevant = results.filter((r: { link: string }) =>
      !r.link?.includes('wikipedia') &&
      !r.link?.includes('linkedin.com/company') &&
      !r.link?.includes('instagram.com') &&
      !r.link?.includes('facebook.com')
    )
    if (!relevant.length) return { found: false }
    return { found: true, snippet: relevant[0].snippet, link: relevant[0].link }
  } catch {
    return { found: false }
  }
}

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SERPAPI_KEY) return NextResponse.json({ error: 'SERPAPI_API_KEY not configured' }, { status: 400 })

  const admin = createAdminClient()

  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data: leads } = await admin
    .from('leads')
    .select('id, company_name, domain, sector, user_id, campaign_id, score, signal_checked_at')
    .in('status', ['new', 'contacted', 'interested'])
    .or(`signal_checked_at.is.null,signal_checked_at.lt.${twoDaysAgo.toISOString()}`)
    .order('score', { ascending: false })
    .limit(20)

  if (!leads?.length) return NextResponse.json({ message: 'No leads pending analysis', detected: 0 })

  let detected = 0

  const signalsByUser: Record<string, {
    company: string; leadId: string; signalLabel: string; signalEmoji: string
    urgency: 'critical' | 'high' | 'medium'; angle: string; snippet: string
    newScore: number; link?: string; sector?: string
  }[]> = {}

  for (const lead of leads) {
    const companyName = lead.company_name
    if (!companyName) continue

    await admin.from('leads').update({ signal_checked_at: new Date().toISOString() }).eq('id', lead.id)

    let foundSignal = false
    for (const signal of SIGNAL_QUERIES) {
      if (foundSignal) break
      for (const template of signal.templates) {
        const query = template.replace('{company}', companyName)
        const result = await searchSignal(query)

        if (result.found) {
          foundSignal = true
          detected++
          const newScore = Math.min(100, (lead.score ?? 50) + signal.scoreBoost)

          await Promise.all([
            admin.from('leads').update({ score: newScore }).eq('id', lead.id),
            admin.from('activity_logs').insert({
              lead_id: lead.id,
              user_id: lead.user_id,
              campaign_id: lead.campaign_id ?? null,
              type: 'signal_detected',
              title: `🎯 Signal at ${companyName}: ${signal.label}`,
              description: result.snippet
                ? `${result.snippet.slice(0, 200)} · Urgency: ${signal.urgency} · Score → ${newScore}`
                : `Urgency ${signal.urgency} · Score updated to ${newScore}`,
            }),
          ])

          if (!signalsByUser[lead.user_id]) signalsByUser[lead.user_id] = []
          signalsByUser[lead.user_id].push({
            company: companyName,
            leadId: lead.id,
            signalLabel: signal.label,
            signalEmoji: signal.emoji,
            urgency: signal.urgency,
            angle: signal.angle,
            snippet: result.snippet ?? '',
            newScore,
            link: result.link,
            sector: lead.sector ?? undefined,
          })
          break
        }
      }
    }

    await new Promise(r => setTimeout(r, 500))
  }

  for (const [userId, signals] of Object.entries(signalsByUser)) {
    try {
      const { data: settings } = await admin
        .from('settings')
        .select('notification_emails, signal_alerts_enabled')
        .eq('user_id', userId)
        .single()

      if (settings?.signal_alerts_enabled === false) continue

      let recipients: string[] = []
      if (settings?.notification_emails) {
        recipients = settings.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
      }
      if (!recipients.length) {
        const { data: authUser } = await admin.auth.admin.getUserById(userId)
        if (authUser?.user?.email) recipients = [authUser.user.email]
      }
      if (!recipients.length) continue

      const html = buildSignalEmailHtml(signals)
      const urgencyOrder: Record<string, number> = { 'critical': 0, 'high': 1, 'medium': 2 }
      const topSignal = [...signals].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])[0]

      await resend.emails.send({
        from: FROM,
        to: recipients,
        subject: `🎯 ${topSignal.signalEmoji} Signal at ${topSignal.company}: ${topSignal.signalLabel}${signals.length > 1 ? ` (+${signals.length - 1} more)` : ''}`,
        html,
      })
    } catch {
      // Continue with next user
    }
  }

  return NextResponse.json({
    message: 'Signal analysis complete',
    leadsAnalyzed: leads.length,
    detected,
    timestamp: new Date().toISOString(),
  })
}
