import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

// ============================================================
// CRON JOB — Envío automático de follow-ups programados
// Ejecutar diariamente: vercel.json → crons
// ============================================================

export async function GET(request: Request) {
  // Verificar token de cron para seguridad
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Obtener follow-ups pendientes cuya fecha ya ha llegado
  const { data: pendingFollowUps, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(50) // Procesar en lotes de 50

  if (error) {
    console.error('Error fetching follow-ups:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pendingFollowUps || pendingFollowUps.length === 0) {
    return NextResponse.json({ message: 'No hay follow-ups pendientes', processed: 0 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? ''
  const fromName = process.env.RESEND_FROM_NAME ?? 'Media Connector'

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const followUp of pendingFollowUps) {
    try {
      // ¿Ha contestado el lead desde que se programó el follow-up?
      const { data: lead } = await supabase
        .from('leads')
        .select('status, email, company_name')
        .eq('id', followUp.lead_id)
        .single()

      if (lead?.status === 'replied' || lead?.status === 'interested' || lead?.status === 'meeting_scheduled') {
        // Lead ya contestó o está interesado — cancelar follow-up
        await supabase
          .from('follow_ups')
          .update({ status: 'cancelled' })
          .eq('id', followUp.id)
        skipped++
        continue
      }

      // Obtener el email destino (del lead o del follow-up original)
      const toEmail = lead?.email
      if (!toEmail) {
        await supabase
          .from('follow_ups')
          .update({ status: 'failed' })
          .eq('id', followUp.id)
        failed++
        continue
      }

      // Obtener settings del usuario para el from
      const { data: settings } = await supabase
        .from('settings')
        .select('email_from_address, email_from_name, email_signature')
        .eq('user_id', followUp.user_id)
        .single()

      const from = settings?.email_from_address || fromEmail
      const name = settings?.email_from_name || fromName
      let body = followUp.body
      if (settings?.email_signature) {
        body += `\n\n--\n${settings.email_signature}`
      }

      // Enviar el email
      const result = await resend.emails.send({
        from: `${name} <${from}>`,
        to: toEmail,
        subject: followUp.subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
      })

      // Guardar en tabla emails
      const { data: emailRecord } = await supabase
        .from('emails')
        .insert({
          lead_id: followUp.lead_id,
          user_id: followUp.user_id,
          campaign_id: followUp.campaign_id,
          to_email: toEmail,
          from_email: from,
          from_name: name,
          subject: followUp.subject,
          body: body,
          status: 'sent',
          provider: 'resend',
          provider_id: result.data?.id,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      // Actualizar estado del follow-up
      await supabase
        .from('follow_ups')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', followUp.id)

      // Registrar actividad
      await supabase.from('activity_logs').insert({
        lead_id: followUp.lead_id,
        user_id: followUp.user_id,
        campaign_id: followUp.campaign_id,
        type: 'email_sent',
        title: `Follow-up automático enviado: "${followUp.subject}"`,
        description: `Para: ${toEmail}`,
        metadata: { provider_id: result.data?.id, email_id: emailRecord?.id },
      })

      // Actualizar estado del lead a 'contacted' si estaba en 'new'
      await supabase
        .from('leads')
        .update({ status: 'contacted' })
        .eq('id', followUp.lead_id)
        .eq('status', 'new')

      sent++
    } catch (err) {
      console.error(`Error sending follow-up ${followUp.id}:`, err)
      await supabase
        .from('follow_ups')
        .update({ status: 'failed' })
        .eq('id', followUp.id)
      failed++
    }

    // Pausa entre envíos para evitar rate limits
    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({
    message: 'Follow-ups procesados',
    processed: pendingFollowUps.length,
    sent,
    skipped,
    failed,
  })
}
