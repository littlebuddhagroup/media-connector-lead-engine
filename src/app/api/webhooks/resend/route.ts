import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// RESEND WEBHOOK — Tracking de aperturas, clics y bounces
//
// Configurar en Resend Dashboard → Webhooks → Add endpoint:
//   URL: https://TU-DOMINIO/api/webhooks/resend
//   Events: email.opened, email.clicked, email.bounced,
//           email.delivery_delayed, email.complained
// ============================================================

const EVENT_STATUS_MAP: Record<string, string> = {
  'email.sent':             'sent',
  'email.delivered':        'delivered',
  'email.opened':           'opened',
  'email.clicked':          'clicked',
  'email.bounced':          'bounced',
  'email.complained':       'spam',
  'email.delivery_delayed': 'delayed',
}

const EVENT_ACTIVITY_MAP: Record<string, { type: string; title: string }> = {
  'email.opened':    { type: 'email_opened',    title: 'Email abierto' },
  'email.clicked':   { type: 'email_clicked',   title: 'Enlace clicado en email' },
  'email.bounced':   { type: 'email_bounced',   title: 'Email rebotado (bounce)' },
  'email.complained':{ type: 'email_spam',      title: 'Email marcado como spam' },
  'email.delivered': { type: 'email_delivered', title: 'Email entregado' },
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (webhookSecret) {
    const svixId        = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = payload.type as string
  const data = payload.data as Record<string, unknown> | undefined

  if (!eventType || !data) return NextResponse.json({ ok: true })

  const resendId   = data.email_id as string | undefined
  const toEmail    = data.to as string[] | string | undefined
  const toEmailStr = Array.isArray(toEmail) ? toEmail[0] : toEmail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clickedUrl = (data.click as any)?.link as string | undefined

  if (!resendId) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()

  const { data: emailRecord } = await supabase
    .from('emails')
    .select('id, lead_id, user_id, campaign_id, status, open_count, click_count, opened_at')
    .eq('provider_id', resendId)
    .single()

  // ── Si no es un email de secuencia/campaña, buscar en newsletter_recipients ──
  if (!emailRecord) {
    const { data: nr } = await supabase
      .from('newsletter_recipients')
      .select('id, email, user_id, newsletter_id, open_count, click_count, opened_at, status')
      .eq('provider_id', resendId)
      .maybeSingle()

    if (nr) {
      const nrUpdate: Record<string, unknown> = {}
      const statusPriorityNr = ['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'spam', 'unsubscribed']
      const newStatusNr = EVENT_STATUS_MAP[eventType]
      if (newStatusNr && statusPriorityNr.indexOf(newStatusNr) > statusPriorityNr.indexOf(nr.status ?? 'sent')) {
        nrUpdate.status = newStatusNr
      }
      if (eventType === 'email.opened') {
        nrUpdate.opened_at  = new Date().toISOString()
        nrUpdate.open_count = (nr.open_count ?? 0) + 1
      }
      if (eventType === 'email.clicked') {
        nrUpdate.clicked_at  = new Date().toISOString()
        nrUpdate.click_count = (nr.click_count ?? 0) + 1
        if (clickedUrl) nrUpdate.last_clicked_url = clickedUrl
        if (!nr.opened_at) nrUpdate.opened_at = new Date().toISOString()
      }
      if (Object.keys(nrUpdate).length > 0) {
        await supabase.from('newsletter_recipients').update(nrUpdate).eq('id', nr.id)
      }
      // Actualizar contadores agregados del newsletter
      if (nr.newsletter_id && (eventType === 'email.opened' || eventType === 'email.bounced')) {
        const field = eventType === 'email.opened' ? 'total_opened' : 'total_bounced'
        const { data: nl } = await supabase.from('newsletters').select(field).eq('id', nr.newsletter_id).single()
        if (nl) {
          await supabase.from('newsletters').update({
            [field]: ((nl as Record<string, number>)[field] ?? 0) + 1,
          }).eq('id', nr.newsletter_id)
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  const statusPriority = ['sent', 'delayed', 'delivered', 'opened', 'clicked', 'bounced', 'spam']
  const newStatus       = EVENT_STATUS_MAP[eventType]
  const currentPriority = statusPriority.indexOf(emailRecord.status ?? 'sent')
  const newPriority     = statusPriority.indexOf(newStatus ?? '')

  const emailUpdate: Record<string, unknown> = {}

  if (newPriority > currentPriority && newStatus) {
    emailUpdate.status = newStatus
  }

  if (eventType === 'email.opened') {
    emailUpdate.opened_at  = new Date().toISOString()
    emailUpdate.open_count = (emailRecord.open_count ?? 0) + 1
  }

  if (eventType === 'email.clicked') {
    emailUpdate.clicked_at  = new Date().toISOString()
    emailUpdate.click_count = (emailRecord.click_count ?? 0) + 1
    if (clickedUrl) emailUpdate.last_clicked_url = clickedUrl
    if (!emailRecord.opened_at) {
      emailUpdate.opened_at = new Date().toISOString()
    }
  }

  if (Object.keys(emailUpdate).length > 0) {
    await supabase.from('emails').update(emailUpdate).eq('id', emailRecord.id)
  }

  const activity = EVENT_ACTIVITY_MAP[eventType]
  if (activity) {
    await supabase.from('activity_logs').insert({
      lead_id:     emailRecord.lead_id,
      user_id:     emailRecord.user_id,
      campaign_id: emailRecord.campaign_id,
      type:        activity.type,
      title:       activity.title,
      description: toEmailStr
        ? `${toEmailStr}${clickedUrl ? ` — Enlace: ${clickedUrl}` : ''}`
        : undefined,
      metadata: {
        email_id:    emailRecord.id,
        provider_id: resendId,
        event:       eventType,
        ...(clickedUrl ? { clicked_url: clickedUrl } : {}),
      },
    })
  }

  if (eventType === 'email.opened' && emailRecord.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('status')
      .eq('id', emailRecord.lead_id)
      .single()

    if (lead && ['new', 'contacted'].includes(lead.status ?? '')) {
      await supabase
        .from('leads')
        .update({ status: 'opened' })
        .eq('id', emailRecord.lead_id)
    }
  }

  return NextResponse.json({ ok: true })
}
