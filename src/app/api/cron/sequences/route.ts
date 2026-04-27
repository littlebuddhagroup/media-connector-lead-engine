import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

// ============================================================
// CRON JOB — Procesa y envía pasos pendientes de secuencias
// Ejecutar diariamente: vercel.json → crons
// ============================================================

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Obtener pasos pendientes cuya fecha ya ha llegado
  const { data: pendingSteps, error } = await supabase
    .from('sequence_steps')
    .select(`
      *,
      sequence:sequences(id, status, lead_id, user_id, campaign_id, current_step)
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(100)

  if (error) {
    console.error('Error fetching sequence steps:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pendingSteps || pendingSteps.length === 0) {
    return NextResponse.json({ message: 'No hay pasos pendientes', processed: 0 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmailDefault = process.env.RESEND_FROM_EMAIL ?? ''
  const fromNameDefault = process.env.RESEND_FROM_NAME ?? 'Media Connector'

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const step of pendingSteps) {
    const sequence = step.sequence as { id: string; status: string; lead_id: string; user_id: string; campaign_id?: string; current_step: number }

    try {
      // ¿La secuencia sigue activa?
      if (!sequence || sequence.status !== 'active') {
        await supabase.from('sequence_steps').update({ status: 'skipped' }).eq('id', step.id)
        skipped++
        continue
      }

      // ¿El lead ha respondido?
      const { data: lead } = await supabase
        .from('leads')
        .select('status, email, company_name')
        .eq('id', sequence.lead_id)
        .single()

      if (lead?.status === 'replied' || lead?.status === 'interested' || lead?.status === 'meeting_scheduled') {
        // Pausar la secuencia automáticamente
        await supabase.from('sequences').update({
          status: 'paused',
          paused_reason: 'replied',
          updated_at: new Date().toISOString(),
        }).eq('id', sequence.id)

        await supabase.from('sequence_steps').update({ status: 'skipped' }).eq('id', step.id)
        skipped++
        continue
      }

      const toEmail = lead?.email
      if (!toEmail) {
        await supabase.from('sequence_steps').update({ status: 'skipped' }).eq('id', step.id)
        skipped++
        continue
      }

      // Obtener settings del usuario
      const { data: settings } = await supabase
        .from('settings')
        .select('email_from_address, email_from_name, email_signature')
        .eq('user_id', sequence.user_id)
        .single()

      const from = settings?.email_from_address || fromEmailDefault
      const name = settings?.email_from_name || fromNameDefault
      let body = step.body
      if (settings?.email_signature) {
        body += `\n\n--\n${settings.email_signature}`
      }

      // Enviar
      const result = await resend.emails.send({
        from: `${name} <${from}>`,
        to: toEmail,
        subject: step.subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
      })

      // Guardar en tabla emails
      const { data: emailRecord } = await supabase
        .from('emails')
        .insert({
          lead_id: sequence.lead_id,
          user_id: sequence.user_id,
          campaign_id: sequence.campaign_id ?? null,
          to_email: toEmail,
          from_email: from,
          from_name: name,
          subject: step.subject,
          body: body,
          status: 'sent',
          provider: 'resend',
          provider_id: result.data?.id,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      // Actualizar el paso
      await supabase.from('sequence_steps').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        email_id: emailRecord?.id,
      }).eq('id', step.id)

      // Actualizar current_step de la secuencia
      const newStep = step.step_number
      await supabase.from('sequences').update({
        current_step: newStep,
        status: newStep >= 3 ? 'completed' : 'active',
        completed_at: newStep >= 3 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', sequence.id)

      // Actividad
      await supabase.from('activity_logs').insert({
        lead_id: sequence.lead_id,
        user_id: sequence.user_id,
        campaign_id: sequence.campaign_id ?? null,
        type: 'email_sent',
        title: `Secuencia paso ${step.step_number}/3 enviado: "${step.subject}"`,
        description: `Para: ${toEmail}`,
        metadata: { sequence_id: sequence.id, step_number: step.step_number },
      })

      // Marcar lead como contactado si estaba en 'new'
      await supabase.from('leads').update({ status: 'contacted' }).eq('id', sequence.lead_id).eq('status', 'new')

      sent++
    } catch (err) {
      console.error(`Error en sequence step ${step.id}:`, err)
      await supabase.from('sequence_steps').update({ status: 'skipped' }).eq('id', step.id)
      failed++
    }

    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({
    message: 'Pasos de secuencia procesados',
    processed: pendingSteps.length,
    sent,
    skipped,
    failed,
  })
}
