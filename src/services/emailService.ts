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

export async function sendEmail(
  input: SendEmailInput,
  userId: string,
  campaignId?: string,
  messageId?: string
): Promise<EmailSendResult> {
  const supabase = createAdminClient()

  // Verificar límite diario
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('sent_at', today.toISOString())
    .eq('status', 'sent')

  const dailyLimit = parseInt(process.env.DAILY_EMAIL_LIMIT ?? '50')
  if ((count ?? 0) >= dailyLimit) {
    throw new Error(`Límite diario de ${dailyLimit} emails alcanzado`)
  }

  // Obtener settings del usuario
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  const fromEmail = settings?.email_from_address || process.env.RESEND_FROM_EMAIL || ''
  const fromName = settings?.email_from_name || process.env.RESEND_FROM_NAME || 'Media Connector'

  // Añadir firma si existe
  let body = input.body
  if (settings?.email_signature) {
    body += `\n\n--\n${settings.email_signature}`
  }

  try {
    const resend = getResendClient()
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: input.to_name ? `${input.to_name} <${input.to_email}>` : input.to_email,
      subject: input.subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
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
      body: body,
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
      body: body,
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
