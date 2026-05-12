import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

// ============================================================
// CRON — Procesa newsletters programados cuya hora ha llegado
// GET /api/cron/newsletters
//
// Vercel llama a este endpoint según vercel.json → crons.
// Autenticación: Authorization: Bearer <CRON_SECRET>
// Frecuencia recomendada: cada hora (0 * * * *)
//
// Flujo:
//   1. Busca newsletters con status='scheduled' y scheduled_for <= now
//   2. Por cada uno: marca como 'sending', envía, marca como 'sent'
//   3. Usa round-robin de cuentas igual que el envío manual
// ============================================================

const SENDER_ACCOUNTS = [
  { email: 'guillaume@mymediaconnect.com',   name: 'Guillaume — MyMediaConnect' },
  { email: 'guillaume@gomymediaconnect.com', name: 'Guillaume — MyMediaConnect' },
  { email: 'guillaume@mymediaconnectgo.com', name: 'Guillaume — MyMediaConnect' },
  { email: 'guillaume@mymediaconnect.es',    name: 'Guillaume — MyMediaConnect' },
]

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://media-connector-lead-engine.vercel.app'

export async function GET(request: Request) {
  // Verificar secret de Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // 1. Buscar newsletters listos para enviar
  const { data: dueNewsletters, error } = await admin
    .from('newsletters')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)

  if (error) {
    console.error('[cron/newsletters] Error buscando newsletters:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!dueNewsletters || dueNewsletters.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No hay newsletters pendientes de envío' })
  }

  console.log(`[cron/newsletters] ${dueNewsletters.length} newsletter(s) listos para enviar`)

  const results: Array<{ id: string; name: string; sent: number; failed: number; skipped: number; error?: string }> = []

  for (const newsletter of dueNewsletters) {
    try {
      const result = await sendNewsletter(newsletter, admin)
      results.push({ id: newsletter.id, name: newsletter.name, ...result })
    } catch (err) {
      console.error(`[cron/newsletters] Error enviando newsletter ${newsletter.id}:`, err)
      results.push({
        id: newsletter.id,
        name: newsletter.name,
        sent: 0, failed: 0, skipped: 0,
        error: err instanceof Error ? err.message : 'Error desconocido',
      })
      // Revertir a scheduled para reintentar en el próximo ciclo
      await admin.from('newsletters')
        .update({ status: 'scheduled' })
        .eq('id', newsletter.id)
    }
  }

  return NextResponse.json({
    ok: true,
    processed: dueNewsletters.length,
    results,
    timestamp: now,
  })
}

// ── Lógica de envío (sin dependencia de sesión de usuario) ─────────────────

type NewsletterRow = Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

async function sendNewsletter(newsletter: NewsletterRow, admin: AdminClient) {
  const newsletterId = newsletter.id as string
  const userId       = newsletter.user_id as string

  // Marcar como enviando para evitar doble disparo si el cron se solapa
  await admin.from('newsletters')
    .update({ status: 'sending' })
    .eq('id', newsletterId)
    .eq('status', 'scheduled') // guard — solo si sigue en scheduled

  // Obtener API key de Resend — primero api_integrations, luego env var
  const { data: integration } = await admin
    .from('api_integrations')
    .select('api_key')
    .eq('user_id', userId)
    .eq('provider', 'resend')
    .eq('is_active', true)
    .maybeSingle()

  const resendApiKey = integration?.api_key ?? process.env.RESEND_API_KEY
  if (!resendApiKey) {
    throw new Error(`Usuario ${userId} sin API key de Resend`)
  }

  // Obtener firma del usuario
  const { data: settings } = await admin
    .from('settings')
    .select('email_signature, email_from_name')
    .eq('user_id', userId)
    .maybeSingle()

  // Resolver destinatarios — SOLO desde listas seleccionadas manualmente
  type LeadRow = { id?: string; email: string; company_name?: string; first_name?: string; last_name?: string }
  let recipientLeads: LeadRow[] = []

  // Usar target_list_ids (nuevo) con fallback a target_list_id (legacy)
  const listIds: string[] = Array.isArray(newsletter.target_list_ids) && (newsletter.target_list_ids as string[]).length > 0
    ? newsletter.target_list_ids as string[]
    : newsletter.target_list_id ? [newsletter.target_list_id as string] : []

  if (listIds.length === 0) {
    console.warn(`[cron/newsletters] Newsletter ${newsletterId} no tiene listas asignadas — omitido`)
    await admin.from('newsletters').update({ status: 'sent', sent_at: new Date().toISOString(), total_sent: 0 }).eq('id', newsletterId)
    return { sent: 0, failed: 0, skipped: 0 }
  }

  const { data: members } = await admin
    .from('lead_list_members')
    .select('lead:leads(id, email, company_name, first_name, last_name)')
    .in('list_id', listIds)

  // Deduplicar por email (un lead puede estar en varias listas seleccionadas)
  const seenEmails = new Set<string>()
  recipientLeads = (members ?? [])
    .map((m: Record<string, unknown>) => m.lead as LeadRow | null)
    .filter((l: LeadRow | null): l is LeadRow => {
      if (!l?.email) return false
      const key = l.email.toLowerCase()
      if (seenEmails.has(key)) return false
      seenEmails.add(key)
      return true
    })

  if (recipientLeads.length === 0) {
    await admin.from('newsletters').update({ status: 'sent', sent_at: new Date().toISOString(), total_sent: 0 }).eq('id', newsletterId)
    return { sent: 0, failed: 0, skipped: 0 }
  }

  // Filtrar dados de baja
  const { data: unsubscribed } = await admin
    .from('newsletter_unsubscribes')
    .select('email')
    .eq('user_id', userId)
  const unsubscribedSet = new Set((unsubscribed ?? []).map((u: { email: string }) => u.email.toLowerCase()))
  const filteredLeads  = recipientLeads.filter(l => !unsubscribedSet.has(l.email.toLowerCase()))
  const skippedCount   = recipientLeads.length - filteredLeads.length

  if (filteredLeads.length === 0) {
    await admin.from('newsletters').update({ status: 'sent', sent_at: new Date().toISOString(), total_sent: 0, total_recipients: skippedCount }).eq('id', newsletterId)
    return { sent: 0, failed: 0, skipped: skippedCount }
  }

  // Crear recipients en BD con cuenta asignada
  const fixedFromEmail = (newsletter.from_email as string) || null
  const fixedFromName  = (newsletter.from_name as string) || settings?.email_from_name || 'Guillaume — MyMediaConnect'

  const recipientInserts = filteredLeads.map((lead, idx) => {
    const account = fixedFromEmail
      ? { email: fixedFromEmail, name: fixedFromName }
      : SENDER_ACCOUNTS[idx % SENDER_ACCOUNTS.length]
    return {
      newsletter_id: newsletterId,
      user_id:       userId,
      lead_id:       lead.id ?? null,
      email:         lead.email,
      name: lead.first_name
        ? `${lead.first_name} ${lead.last_name ?? ''}`.trim()
        : lead.company_name ?? '',
      from_email: account.email,
      from_name:  account.name,
      status: 'pending' as const,
    }
  })

  const { data: recipients } = await admin
    .from('newsletter_recipients')
    .insert(recipientInserts)
    .select('id, email, name, from_email, from_name')

  // Enviar en batches de 10
  const resend = new Resend(resendApiKey)
  let sent = 0, failed = 0

  const BATCH_SIZE = 10
  for (let i = 0; i < (recipients ?? []).length; i += BATCH_SIZE) {
    const batch = (recipients ?? []).slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(async (recipient: { id: string; email: string; name?: string; from_email: string; from_name?: string }) => {
      try {
        const unsubscribeUrl = `${APP_URL}/api/newsletters/unsubscribe?token=${recipient.id}`

        // Personalizar + reemplazar placeholder unsubscribe + tracking de clicks
        let html = (newsletter.body_html as string)
          .replace(/\{\{nombre\}\}/gi, recipient.name || 'estimado cliente')
          .replace(/\{\{name\}\}/gi,   recipient.name || 'valued customer')
          .replace(/\{\{prénom\}\}/gi, recipient.name || 'cher client')
          // Reemplazar el placeholder de unsubscribe en la plantilla
          .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl)
          // Catch-all: href="#" cerca de texto de baja (HTML personalizado)
          .replace(/href="#"([^>]*>(?:[^<]*(?:baja|unsubscrib|désabonn|cancelar|suscripci)[^<]*)<\/a>)/gi,
            `href="${unsubscribeUrl}"$1`)

        html = html.replace(/href="(https?:\/\/[^"]+)"/gi, (match: string, url: string) => {
          if (url.includes('/api/newsletters/unsubscribe')) return match
          return `href="${APP_URL}/api/newsletters/track/click?r=${recipient.id}&url=${encodeURIComponent(url)}"`
        })

        // Pixel de apertura
        const pixel = `<img src="${APP_URL}/api/newsletters/track/open?r=${recipient.id}" width="1" height="1" style="display:none;border:0" alt="" />`

        // Footer de fallback solo si la plantilla no tiene enlace de baja propio
        const hasUnsubLink = html.includes('/api/newsletters/unsubscribe')
        const detectedLang = /vous avez|désabonn|Bonjour|désabonner/i.test(html) ? 'fr'
          : /you received|unsubscrib|Hi |Hello /i.test(html) ? 'en' : 'es'
        const unsubLabel = detectedLang === 'fr' ? 'Se désabonner'
          : detectedLang === 'en' ? 'Unsubscribe' : 'Darse de baja'
        const unsubNote = detectedLang === 'fr'
          ? 'Vous avez reçu cet email car nous avons une relation commerciale.'
          : detectedLang === 'en'
          ? 'You received this email because we have a business relationship.'
          : 'Has recibido este email porque tenemos una relación comercial.'
        const footer = hasUnsubLink ? '' : `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;font-family:sans-serif;line-height:1.6;">${unsubNote}<br><a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">${unsubLabel}</a> &nbsp;·&nbsp; mymediaconnect.com</div>`

        const fullHtml = html.includes('</body>')
          ? html.replace('</body>', `${footer}${pixel}</body>`)
          : html + footer + pixel

        const { data: emailData, error: emailErr } = await resend.emails.send({
          from:    `${recipient.from_name || fixedFromName} <${recipient.from_email}>`,
          to:      recipient.email,
          subject: newsletter.subject as string,
          html:    fullHtml,
          replyTo: (newsletter.reply_to as string) || recipient.from_email,
          headers: {
            'List-Unsubscribe':      `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })

        if (emailErr || !emailData?.id) {
          failed++
          await admin.from('newsletter_recipients').update({ status: 'failed', sent_at: new Date().toISOString() }).eq('id', recipient.id)
        } else {
          sent++
          await admin.from('newsletter_recipients').update({ status: 'sent', provider_id: emailData.id, sent_at: new Date().toISOString() }).eq('id', recipient.id)
        }
      } catch {
        failed++
        await admin.from('newsletter_recipients').update({ status: 'failed' }).eq('id', recipient.id)
      }
    }))

    if (i + BATCH_SIZE < (recipients ?? []).length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  // Actualizar stats finales
  await admin.from('newsletters').update({
    status:            'sent',
    sent_at:           new Date().toISOString(),
    total_sent:        sent,
    total_recipients:  recipientLeads.length,
  }).eq('id', newsletterId)

  console.log(`[cron/newsletters] Newsletter "${newsletter.name}" → ${sent} enviados, ${failed} fallidos, ${skippedCount} omitidos`)
  return { sent, failed, skipped: skippedCount }
}
