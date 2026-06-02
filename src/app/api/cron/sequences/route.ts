import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { runConcurrently } from '@/lib/concurrency'

// ============================================================
// CRON JOB — Procesa y envía pasos pendientes de secuencias
// Ejecutar diariamente: vercel.json → crons
//
// Optimizado para escala:
//   - Pre-fetch leads + settings en 2 queries bulk (no N queries en loop)
//   - runConcurrently(10) para envíos Resend (I/O bound)
//   - Bulk DB writes al final: inserts + updates en paralelo
//   - Sin setTimeout delays
// ============================================================

const SENDER_ACCOUNTS: Record<string, string> = {
  'guillaume@mymediaconnect.com':   'Guillaume — MyMediaConnect',
  'guillaume@gomymediaconnect.com': 'Guillaume — MyMediaConnect',
  'guillaume@mymediaconnectgo.com': 'Guillaume — MyMediaConnect',
  'guillaume@mymediaconnect.es':    'Guillaume — MyMediaConnect',
}

const REPLIED_STATUSES = ['replied', 'interested', 'meeting_scheduled']

type LeadRow = { id: string; status: string; email: string | null; company_name: string }
type SettingsRow = { user_id: string; email_from_address: string | null; email_from_name: string | null; email_signature: string | null; sender_email: string | null; pipedrive_bcc_enabled: boolean | null }

type SendResult =
  | { type: 'skip_inactive'; stepId: string }
  | { type: 'pause'; stepId: string; sequenceId: string }
  | { type: 'skip_no_email'; stepId: string }
  | { type: 'sent'; stepId: string; sequenceId: string; step_number: number; lead_id: string; user_id: string; campaign_id?: string | null; to_email: string; from_email: string; from_name: string; subject: string; body: string; provider_id?: string }
  | { type: 'failed'; stepId: string }

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Obtener pasos pendientes con secuencia ya joinada (limit 200)
  const { data: pendingSteps, error } = await supabase
    .from('sequence_steps')
    .select(`
      *,
      sequence:sequences(id, status, lead_id, user_id, campaign_id, current_step)
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(200)

  if (error) {
    console.error('Error fetching sequence steps:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pendingSteps?.length) {
    return NextResponse.json({ message: 'No hay pasos pendientes', processed: 0 })
  }

  // Filtrar los que tienen secuencia válida
  type Sequence = { id: string; status: string; lead_id: string; user_id: string; campaign_id?: string | null; current_step: number }
  type StepRow = Record<string, unknown> & { id: string; sequence: Sequence | null }
  const allSteps = pendingSteps as StepRow[]
  const validSteps = allSteps.filter(s => s.sequence?.lead_id)

  // ── Pre-fetch leads + settings en 2 queries bulk ──
  const leadIds = [...new Set(validSteps.map(s => s.sequence!.lead_id))]
  const userIds = [...new Set(validSteps.map(s => s.sequence!.user_id))]

  const [{ data: leadsData }, { data: settingsData }] = await Promise.all([
    supabase.from('leads').select('id, status, email, company_name').in('id', leadIds),
    supabase.from('settings')
      .select('user_id, email_from_address, email_from_name, email_signature, sender_email, pipedrive_bcc_enabled')
      .in('user_id', userIds),
  ])

  const leadMap = new Map<string, LeadRow>((leadsData ?? []).map((l: LeadRow) => [l.id, l]))
  const settingsMap = new Map<string, SettingsRow>((settingsData ?? []).map((s: SettingsRow) => [s.user_id, s]))

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmailDefault = process.env.RESEND_FROM_EMAIL ?? ''
  const fromNameDefault = process.env.RESEND_FROM_NAME ?? 'Media Connector'

  // ── Envíos en paralelo — concurrencia=10 (I/O bound hacia Resend) ──
  const stepResults = await runConcurrently<StepRow, SendResult>(
    validSteps,
    async (step) => {
      const sequence = step.sequence as Sequence

      if (!sequence || sequence.status !== 'active') {
        return { type: 'skip_inactive', stepId: step.id }
      }

      const lead = leadMap.get(sequence.lead_id)
      if (lead && REPLIED_STATUSES.includes(lead.status)) {
        return { type: 'pause', stepId: step.id, sequenceId: sequence.id }
      }

      const toEmail = lead?.email
      if (!toEmail) return { type: 'skip_no_email', stepId: step.id }

      const settings = settingsMap.get(sequence.user_id)
      const stepFromEmail = (step as Record<string, unknown>).from_email as string | undefined
      const from = stepFromEmail || settings?.sender_email || settings?.email_from_address || fromEmailDefault
      const name = (stepFromEmail && SENDER_ACCOUNTS[stepFromEmail]) || settings?.email_from_name || fromNameDefault
      let body = step.body as string
      if (settings?.email_signature) body += `\n\n--\n${settings.email_signature}`

      try {
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
          // BCC a Pipedrive — activo por defecto, desactivable desde Configuración
          ...(settings?.pipedrive_bcc_enabled !== false && { bcc: 'mymediaconnect@pipedrivemail.com' }),
          subject: step.subject as string,
          text: body,
          html: body.replace(/\n/g, '<br>'),
        })

        return {
          type: 'sent',
          stepId: step.id,
          sequenceId: sequence.id,
          step_number: step.step_number as number,
          lead_id: sequence.lead_id,
          user_id: sequence.user_id,
          campaign_id: sequence.campaign_id,
          to_email: toEmail,
          from_email: from,
          from_name: name,
          subject: step.subject as string,
          body,
          provider_id: result.data?.id,
        }
      } catch (err) {
        console.error(`Error sending step ${step.id}:`, err)
        return { type: 'failed', stepId: step.id }
      }
    },
    10
  )

  // ── Separar resultados ──
  const sentResults = stepResults.filter((r): r is Extract<SendResult, { type: 'sent' }> => r.type === 'sent')
  const pauseResults = stepResults.filter((r): r is Extract<SendResult, { type: 'pause' }> => r.type === 'pause')
  const skipIds = stepResults
    .filter(r => r.type === 'skip_inactive' || r.type === 'skip_no_email' || r.type === 'failed')
    .map(r => r.stepId)
  const pausedStepIds = pauseResults.map(r => r.stepId)

  const sentAt = new Date().toISOString()
  const bulkOps: Promise<unknown>[] = []

  // ── 1. Bulk insert email records + obtener IDs ──
  let emailRecords: Array<{ id: string }> = []
  if (sentResults.length > 0) {
    const { data } = await supabase
      .from('emails')
      .insert(sentResults.map(r => ({
        lead_id: r.lead_id,
        user_id: r.user_id,
        campaign_id: r.campaign_id ?? null,
        to_email: r.to_email,
        from_email: r.from_email,
        from_name: r.from_name,
        subject: r.subject,
        body: r.body,
        status: 'sent',
        provider: 'resend',
        provider_id: r.provider_id,
        sent_at: sentAt,
      })))
      .select('id')
    emailRecords = data ?? []
  }

  // ── 2. Bulk update steps ENVIADOS — status+sent_at en una query, email_id concurrente ──
  if (sentResults.length > 0) {
    const sentStepIds = sentResults.map(r => r.stepId)
    // Primero el status en bulk (1 query)
    bulkOps.push(
      supabase.from('sequence_steps')
        .update({ status: 'sent', sent_at: sentAt })
        .in('id', sentStepIds)
    )
    // Luego email_id individualmente en paralelo (si tenemos los IDs)
    if (emailRecords.length === sentResults.length) {
      sentResults.forEach((r, i) => {
        const emailId = emailRecords[i]?.id
        if (emailId) {
          bulkOps.push(
            supabase.from('sequence_steps').update({ email_id: emailId }).eq('id', r.stepId)
          )
        }
      })
    }
  }

  // ── 3. Bulk update steps OMITIDOS ──
  if (skipIds.length > 0) {
    bulkOps.push(
      supabase.from('sequence_steps').update({ status: 'skipped' }).in('id', skipIds)
    )
  }
  if (pausedStepIds.length > 0) {
    bulkOps.push(
      supabase.from('sequence_steps').update({ status: 'skipped' }).in('id', pausedStepIds)
    )
  }

  // ── 4. Pausar secuencias con leads que respondieron ──
  const seqsToPause = [...new Set(pauseResults.map(r => r.sequenceId))]
  if (seqsToPause.length > 0) {
    bulkOps.push(
      supabase.from('sequences').update({
        status: 'paused',
        paused_reason: 'replied',
        updated_at: sentAt,
      }).in('id', seqsToPause)
    )
  }

  // ── 5. Actualizar secuencias ENVIADAS — agrupar por resultado ──
  const completedSeqIds = sentResults.filter(r => r.step_number >= 3).map(r => r.sequenceId)
  if (completedSeqIds.length > 0) {
    bulkOps.push(
      supabase.from('sequences').update({
        current_step: 3,
        status: 'completed',
        completed_at: sentAt,
        updated_at: sentAt,
      }).in('id', completedSeqIds)
    )
  }

  // Agrupar secuencias activas por step_number
  const byStep = new Map<number, string[]>()
  sentResults.filter(r => r.step_number < 3).forEach(r => {
    const arr = byStep.get(r.step_number) ?? []
    arr.push(r.sequenceId)
    byStep.set(r.step_number, arr)
  })
  byStep.forEach((ids, stepNum) => {
    bulkOps.push(
      supabase.from('sequences').update({
        current_step: stepNum,
        status: 'active',
        updated_at: sentAt,
      }).in('id', ids)
    )
  })

  // ── 6. Bulk insert activity logs ──
  if (sentResults.length > 0) {
    bulkOps.push(
      supabase.from('activity_logs').insert(
        sentResults.map(r => ({
          lead_id: r.lead_id,
          user_id: r.user_id,
          campaign_id: r.campaign_id ?? null,
          type: 'email_sent',
          title: `Secuencia paso ${r.step_number}/3 enviado: "${r.subject}"`,
          description: `Para: ${r.to_email}`,
          metadata: { sequence_id: r.sequenceId, step_number: r.step_number },
        }))
      )
    )
  }

  // ── 7. Marcar leads como contactados (solo los que estaban en 'new') ──
  const uniqueLeadIds = [...new Set(sentResults.map(r => r.lead_id))]
  if (uniqueLeadIds.length > 0) {
    bulkOps.push(
      supabase.from('leads').update({ status: 'contacted' }).in('id', uniqueLeadIds).eq('status', 'new')
    )
  }

  // Ejecutar TODAS las operaciones DB en paralelo
  await Promise.all(bulkOps)

  return NextResponse.json({
    message: 'Pasos de secuencia procesados',
    processed: validSteps.length,
    sent: sentResults.length,
    skipped: skipIds.length + pausedStepIds.length,
    failed: stepResults.filter(r => r.type === 'failed').length,
  })
}
