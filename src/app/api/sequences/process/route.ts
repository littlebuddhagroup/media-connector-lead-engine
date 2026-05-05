import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

// ============================================================
// POST /api/sequences/process
// Disparo manual de pasos pendientes — autenticado por sesión
// Acepta ?lead_id=xxx para filtrar por lead, o procesa todos
// ============================================================

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const lead_id = body.lead_id as string | undefined

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Obtener pasos pendientes del usuario (opcionalmente filtrados por lead)
  let query = admin
    .from('sequence_steps')
    .select(`
      *,
      sequence:sequences(id, status, lead_id, user_id, campaign_id, current_step)
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)

  if (lead_id) {
    // Filtrar por lead: obtener IDs de secuencias de ese lead
    const { data: seqs } = await admin
      .from('sequences')
      .select('id')
      .eq('lead_id', lead_id)
      .eq('user_id', user.id)

    if (!seqs || seqs.length === 0) {
      return NextResponse.json({ message: 'No hay pasos pendientes para este lead', sent: 0, skipped: 0, failed: 0, details: [] })
    }
    const seqIds = seqs.map((s: { id: string }) => s.id)
    query = query.in('sequence_id', seqIds)
  } else {
    // Filtrar todos los steps del usuario a través de sus secuencias
    const { data: seqs } = await admin
      .from('sequences')
      .select('id')
      .eq('user_id', user.id)
    const seqIds = (seqs ?? []).map((s: { id: string }) => s.id)
    if (seqIds.length === 0) {
      return NextResponse.json({ message: 'No hay secuencias', sent: 0, skipped: 0, failed: 0, details: [] })
    }
    query = query.in('sequence_id', seqIds)
  }

  const { data: pendingSteps, error } = await query.limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!pendingSteps || pendingSteps.length === 0) {
    return NextResponse.json({
      message: 'No hay pasos pendientes (todos están programados para el futuro o ya se enviaron)',
      sent: 0, skipped: 0, failed: 0, details: []
    })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmailDefault = process.env.RESEND_FROM_EMAIL ?? ''
  const fromNameDefault = process.env.RESEND_FROM_NAME ?? 'MyMediaConnect'

  const SENDER_ACCOUNTS: Record<string, string> = {
    'guillaume@mymediaconnect.com':   'Guillaume — MyMediaConnect',
    'guillaume@gomymediaconnect.com': 'Guillaume — MyMediaConnect',
    'guillaume@mymediaconnectgo.com': 'Guillaume — MyMediaConnect',
    'guillaume@mymediaconnect.es':    'Guillaume — MyMediaConnect',
  }

  let sent = 0
  let skipped = 0
  let failed = 0
  const details: { step_number: number; subject: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }[] = []

  for (const step of pendingSteps) {
    const sequence = step.sequence as {
      id: string; status: string; lead_id: string; user_id: string; campaign_id?: string; current_step: number
    }

    try {
      if (!sequence || sequence.status !== 'active') {
        await admin.from('sequence_steps').update({ status: 'skipped' }).eq('id', step.id)
        skipped++
        details.push({ step_number: step.step_number, subject: step.subject, status: 'skipped', reason: 'Secuencia no activa' })
        continue
      }

      // ¿El lead ha respondido?
      const { data: lead } = await admin
        .from('leads')
        .select('status, email, company_name, first_name')
        .eq('id', sequence.lead_id)
        .single()

      if (lead?.status === 'replied' || lead?.status === 'interested' || lead?.status === 'meeting_scheduled') {
        await admin.from('sequences').update({
          status: 'paused',
          paused_reason: 'replied',
          updated_at: new Date().toISOString(),
        }).eq('id', sequence.id)
        await admin.from('sequence_steps').update({ status: 'skipped' }).eq('id', step.id)
        skipped++
        details.push({ step_number: step.step_number, subject: step.subject, status: 'skipped', reason: 'Lead ya respondió' })
        continue
      }

      const toEmail = lead?.email
      if (!toEmail) {
        await admin.from('sequence_steps').update({ status: 'skipped' }).eq('id', step.id)
        skipped++
        details.push({ step_number: step.step_number, subject: step.subject, status: 'skipped', reason: 'Lead sin email' })
        continue
      }

      // Settings del usuario
      const { data: settings } = await admin
        .from('settings')
        .select('email_from_address, email_from_name, email_signature, sender_email')
        .eq('user_id', sequence.user_id)
        .single()

      const stepFromEmail = (step as { from_email?: string }).from_email
      const from = stepFromEmail || settings?.sender_email || settings?.email_from_address || fromEmailDefault
      const name = (stepFromEmail && SENDER_ACCOUNTS[stepFromEmail])
        || settings?.email_from_name
        || fromNameDefault

      // Construir cuerpo (con detección de HTML y firma)
      const bodyIsHtml = /<[a-z][\s\S]*>/i.test(step.body ?? '')
      let htmlBody = bodyIsHtml ? step.body : (step.body ?? '').replace(/\n/g, '<br>')
      let textBody = (step.body ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

      if (settings?.email_signature) {
        const sigIsHtml = /<[a-z][\s\S]*>/i.test(settings.email_signature)
        if (sigIsHtml) {
          htmlBody += `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">${settings.email_signature}`
        } else {
          htmlBody += `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">${settings.email_signature.replace(/\n/g, '<br>')}`
        }
        textBody += `\n\n--\n${settings.email_signature.replace(/<[^>]+>/g, '')}`
      }

      // Reply-to doble: sistema (detección automática) + Guillaume (bandeja de entrada)
      const replySubdomain = process.env.REPLY_SUBDOMAIN ?? 'reply.mymediaconnect.com'
      const forwardReplyTo = process.env.REPLY_FORWARD_EMAIL ?? 'guillaume@mymediaconnect.com'
      const replyTo = [
        `reply+${sequence.lead_id}@${replySubdomain}`,
        forwardReplyTo,
      ]

      const result = await resend.emails.send({
        from: `${name} <${from}>`,
        to: toEmail,
        replyTo,
        subject: step.subject,
        html: htmlBody,
        text: textBody,
      })

      // Guardar email enviado
      const { data: emailRecord } = await admin
        .from('emails')
        .insert({
          lead_id: sequence.lead_id,
          user_id: sequence.user_id,
          campaign_id: sequence.campaign_id ?? null,
          to_email: toEmail,
          from_email: from,
          from_name: name,
          subject: step.subject,
          body: step.body,
          status: 'sent',
          provider: 'resend',
          provider_id: result.data?.id,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      await admin.from('sequence_steps').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        email_id: emailRecord?.id,
      }).eq('id', step.id)

      const newStep = step.step_number
      await admin.from('sequences').update({
        current_step: newStep,
        status: newStep >= 3 ? 'completed' : 'active',
        completed_at: newStep >= 3 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', sequence.id)

      await admin.from('activity_logs').insert({
        lead_id: sequence.lead_id,
        user_id: sequence.user_id,
        campaign_id: sequence.campaign_id ?? null,
        type: 'email_sent',
        title: `Secuencia paso ${step.step_number}/3 enviado (manual): "${step.subject}"`,
        description: `Para: ${toEmail}`,
        metadata: { sequence_id: sequence.id, step_number: step.step_number, triggered_by: 'manual' },
      })

      await admin.from('leads').update({ status: 'contacted' }).eq('id', sequence.lead_id).eq('status', 'new')

      sent++
      details.push({ step_number: step.step_number, subject: step.subject, status: 'sent' })
    } catch (err) {
      console.error(`Error en paso ${step.id}:`, err)
      failed++
      details.push({
        step_number: step.step_number,
        subject: step.subject,
        status: 'failed',
        reason: err instanceof Error ? err.message : 'Error desconocido',
      })
    }

    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({
    message: sent > 0
      ? `${sent} email${sent !== 1 ? 's' : ''} enviado${sent !== 1 ? 's' : ''} correctamente`
      : skipped > 0
        ? 'No había pasos listos para enviar ahora mismo'
        : 'Sin cambios',
    sent,
    skipped,
    failed,
    details,
  })
}

// GET — devuelve estado de pasos pendientes/overdue para diagnóstico
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const lead_id = searchParams.get('lead_id')

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Obtener IDs de secuencias del usuario (filtradas por lead si se pide)
  let seqQuery = admin.from('sequences').select('id').eq('user_id', user.id)
  if (lead_id) seqQuery = seqQuery.eq('lead_id', lead_id)
  const { data: seqs } = await seqQuery
  const seqIds = (seqs ?? []).map((s: { id: string }) => s.id)

  if (seqIds.length === 0) return NextResponse.json({ pending_overdue: 0, pending_future: 0, steps: [] })

  const { data: steps } = await admin
    .from('sequence_steps')
    .select('id, step_number, subject, status, scheduled_for, sent_at, sequence_id')
    .in('sequence_id', seqIds)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })

  type StepRow = { id: string; step_number: number; subject: string; status: string; scheduled_for?: string; sent_at?: string; sequence_id: string }
  const pending_overdue = (steps as StepRow[] ?? []).filter(s => s.scheduled_for && s.scheduled_for <= now).length
  const pending_future = (steps as StepRow[] ?? []).filter(s => s.scheduled_for && s.scheduled_for > now).length

  return NextResponse.json({
    pending_overdue,
    pending_future,
    steps: steps ?? [],
    server_time: now,
  })
}
