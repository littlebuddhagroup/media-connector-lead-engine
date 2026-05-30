import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import type { SendEmailInput } from '@/types'

// ============================================================
// EMAIL SERVICE — Resend como proveedor principal
// ============================================================

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY no configurada')
  return new Resend(apiKey)
}

export interface EmailSendResult {
  success: boolean
  provider_id?: string
  error?: string
}

// Cuentas de envío disponibles
export const SENDER_ACCOUNTS = [
  { email: 'guillaume@mymediaconnect.com',   name: 'Guillaume — MyMediaConnect' },
  { email: 'guillaume@gomymediaconnect.com', name: 'Guillaume — MyMediaConnect' },
  { email: 'guillaume@mymediaconnectgo.com', name: 'Guillaume — MyMediaConnect' },
  { email: 'guillaume@mymediaconnect.es',    name: 'Guillaume — MyMediaConnect' },
]

export async function sendEmail(
  input: SendEmailInput,
  userId: string,
  campaignId?: string,
  messageId?: string,
  overrideFromEmail?: string
): Promise<EmailSendResult> {
  const supabase = createAdminClient()

  // Obtener settings del usuario primero (necesario para el límite diario)
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Verificar límite diario (0 = sin límite)
  const dailyLimit = settings?.email_daily_limit ?? 50
  if (dailyLimit > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('sent_at', today.toISOString())
      .eq('status', 'sent')
    if ((count ?? 0) >= dailyLimit) {
      throw new Error(`Límite diario de ${dailyLimit} emails alcanzado`)
    }
  }

  // Si se especifica una cuenta de envío concreta, usarla; si no, usar la configurada en settings
  const fromEmail = overrideFromEmail
    || settings?.sender_email
    || settings?.email_from_address
    || process.env.RESEND_FROM_EMAIL
    || ''
  const senderAccount = SENDER_ACCOUNTS.find(a => a.email === fromEmail)
  const fromName = senderAccount?.name
    || settings?.email_from_name
    || process.env.RESEND_FROM_NAME
    || 'Guillaume — MyMediaConnect'

  // Detectar si el cuerpo ya es HTML o texto plano
  const bodyIsHtml = /<[a-z][\s\S]*>/i.test(input.body)

  // Convertir texto plano a HTML con párrafos correctos
  let htmlBody: string
  if (bodyIsHtml) {
    htmlBody = input.body
  } else {
    htmlBody = input.body
      .split(/\n\n+/)
      .filter(p => p.trim())
      .map(p => `<p style="margin:0 0 14px 0">${p.trim().replace(/\n/g, '<br>')}</p>`)
      .join('\n')
  }
  let textBody = input.body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

  if (settings?.email_signature) {
    const sigIsHtml = /<[a-z][\s\S]*>/i.test(settings.email_signature)
    const sigHtml = sigIsHtml
      ? settings.email_signature
      : settings.email_signature.replace(/\n/g, '<br>')
    htmlBody += `<br><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><div style="font-size:13px;color:#6b7280;">${sigHtml}</div>`
    textBody += `\n\n--\n${settings.email_signature.replace(/<[^>]+>/g, '')}`
  }

  try {
    const resend = getResendClient()
    // Asegurar que el body tiene estructura HTML completa para que Resend inyecte el píxel de tracking
    const fullHtmlBody = htmlBody.startsWith('<!DOCTYPE') || htmlBody.startsWith('<html')
      ? htmlBody
      : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222;">${htmlBody}</body></html>`

    // Reply-to doble:
    // 1. Sistema: captura respuesta automáticamente vía inbound webhook
    // 2. Guillaume: recibe la respuesta en su bandeja de entrada
    const replySubdomain = process.env.REPLY_SUBDOMAIN ?? 'reply.mymediaconnect.com'
    const forwardReplyTo = process.env.REPLY_FORWARD_EMAIL ?? 'guillaume@mymediaconnect.com'
    const replyTo: string[] = []
    if (input.lead_id) replyTo.push(`reply+${input.lead_id}@${replySubdomain}`)
    if (forwardReplyTo) replyTo.push(forwardReplyTo)

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: input.to_name ? `${input.to_name} <${input.to_email}>` : input.to_email,
      replyTo,
      bcc: 'mymediaconnect@pipedrivemail.com',
      subject: input.subject,
      text: textBody,
      html: fullHtmlBody,
    })

    // Guardar en BD
    await supabase.from('emails').insert({
      lead_id: input.lead_id,
      user_id: userId,
      campaign_id: campaignId,
      message_id: messageId,
      to_email: input.to_email,
      to_name: input.to_name,
      from_email: fromEmail,
      from_name: fromName,
      subject: input.subject,
      body: htmlBody,
      status: 'sent',
      provider: 'resend',
      provider_id: result.data?.id,
      sent_at: new Date().toISOString(),
    })

    // Actualizar estado del lead a "contactado"
    await supabase
      .from('leads')
      .update({ status: 'contacted' })
      .eq('id', input.lead_id)
      .eq('status', 'new')  // Solo si estaba en "new" o similar

    // Registrar actividad
    await supabase.from('activity_logs').insert({
      lead_id: input.lead_id,
      user_id: userId,
      campaign_id: campaignId,
      type: 'email_sent',
      title: `Email enviado: ${input.subject}`,
      description: `Para: ${input.to_email}`,
      metadata: { provider_id: result.data?.id },
    })

    // Actualizar counter de campaña
    if (campaignId) {
      await supabase.rpc('increment_campaign_emails', { campaign_id: campaignId })
    }

    return { success: true, provider_id: result.data?.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'

    // Guardar email fallido
    await supabase.from('emails').insert({
      lead_id: input.lead_id,
      user_id: userId,
      campaign_id: campaignId,
      message_id: messageId,
      to_email: input.to_email,
      to_name: input.to_name,
      from_email: fromEmail,
      from_name: fromName,
      subject: input.subject,
      body: htmlBody,
      status: 'failed',
      provider: 'resend',
      error_message: message,
    })

    return { success: false, error: message }
  }
}

// Envío en lote (con revisión previa, el usuario ya aprobó)
export async function sendBulkEmails(
  emails: SendEmailInput[],
  userId: string,
  campaignId?: string
): Promise<{ sent: number; errors: number; results: EmailSendResult[] }> {
  const results: EmailSendResult[] = []
  let sent = 0
  let errors = 0

  for (const email of emails) {
    const result = await sendEmail(email, userId, campaignId)
    results.push(result)
    if (result.success) sent++
    else errors++
    // Pausa entre envíos
    await new Promise(r => setTimeout(r, 300))
  }

  return { sent, errors, results }
}
