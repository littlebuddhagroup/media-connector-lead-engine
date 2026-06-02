import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { runConcurrently } from '@/lib/concurrency'

// ============================================================
// CRON JOB — Envío automático de follow-ups programados
// Ejecutar diariamente: vercel.json → crons
//
// Optimizado para escala:
//   - Pre-fetch leads + settings en 2 queries bulk
//   - runConcurrently(10) para envíos Resend (I/O bound)
//   - Bulk DB writes al final: inserts + updates en paralelo
//   - Sin setTimeout delays
// ============================================================

const REPLIED_STATUSES = ['replied', 'interested', 'meeting_scheduled']

type LeadRow = { id: string; status: string; email: string | null; company_name: string }
type SettingsRow = { user_id: string; email_from_address: string | null; email_from_name: string | null; email_signature: string | null; pipedrive_bcc_enabled: boolean | null }
type FollowUpRow = { id: string; lead_id: string; user_id: string; campaign_id: string | null; subject: string; body: string; campaign?: { status: string } | null }

type FollowUpResult =
  | { type: 'cancelled'; followUpId: string }
  | { type: 'failed_no_email'; followUpId: string }
  | { type: 'sent'; followUpId: string; lead_id: string; user_id: string; campaign_id?: string | null; to_email: string; from_email: string; from_name: string; subject: string; body: string; provider_id?: string; email_id?: string }
  | { type: 'failed'; followUpId: string }

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Obtener follow-ups pendientes (limit 100)
  // Excluimos los que pertenecen a campañas pausadas
  const { data: pendingFollowUps, error } = await supabase
    .from('follow_ups')
    .select('id, lead_id, user_id, campaign_id, subject, body, campaign:campaigns(status)')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(100)

  if (error) {
    console.error('Error fetching follow-ups:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pendingFollowUps?.length) {
    return NextResponse.json({ message: 'No hay follow-ups pendientes', processed: 0 })
  }

  // Filtrar follow-ups de campañas pausadas (no enviar mientras la campaña esté en pausa)
  const allFollowUps = pendingFollowUps as FollowUpRow[]
  const followUps = allFollowUps.filter(f => {
    if (!f.campaign_id) return true          // sin campaña → enviar siempre
    if (!f.campaign) return true             // campaña no encontrada → dejar pasar
    return f.campaign.status !== 'paused'   // pausada → saltar
  })

  if (!followUps.length) {
    return NextResponse.json({ message: 'No hay follow-ups pendientes (activos)', processed: 0 })
  }

  // ── Pre-fetch leads + settings en 2 queries bulk ──
  const leadIds = [...new Set(followUps.map(f => f.lead_id))]
  const userIds = [...new Set(followUps.map(f => f.user_id))]

  const [{ data: leadsData }, { data: settingsData }] = await Promise.all([
    supabase.from('leads').select('id, status, email, company_name').in('id', leadIds),
    supabase.from('settings')
      .select('user_id, email_from_address, email_from_name, email_signature, pipedrive_bcc_enabled')
      .in('user_id', userIds),
  ])

  const leadMap = new Map<string, LeadRow>((leadsData ?? []).map((l: LeadRow) => [l.id, l]))
  const settingsMap = new Map<string, SettingsRow>((settingsData ?? []).map((s: SettingsRow) => [s.user_id, s]))

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmailDefault = process.env.RESEND_FROM_EMAIL ?? ''
  const fromNameDefault = process.env.RESEND_FROM_NAME ?? 'Media Connector'

  // ── Envíos en paralelo — concurrencia=10 ──
  const results = await runConcurrently<FollowUpRow, FollowUpResult>(
    followUps,
    async (followUp) => {
      const lead = leadMap.get(followUp.lead_id)

      // Lead ya contestó — cancelar
      if (lead && REPLIED_STATUSES.includes(lead.status)) {
        return { type: 'cancelled', followUpId: followUp.id }
      }

      const toEmail = lead?.email
      if (!toEmail) return { type: 'failed_no_email', followUpId: followUp.id }

      const settings = settingsMap.get(followUp.user_id)
      const from = settings?.email_from_address || fromEmailDefault
      const name = settings?.email_from_name || fromNameDefault
      let body = followUp.body
      if (settings?.email_signature) body += `\n\n--\n${settings.email_signature}`

      try {
        const result = await resend.emails.send({
          from: `${name} <${from}>`,
          to: toEmail,
          // BCC a Pipedrive — activo por defecto, desactivable desde Configuración
          ...(settings?.pipedrive_bcc_enabled !== false && { bcc: 'mymediaconnect@pipedrivemail.com' }),
          subject: followUp.subject,
          text: body,
          html: body.replace(/\n/g, '<br>'),
        })

        return {
          type: 'sent',
          followUpId: followUp.id,
          lead_id: followUp.lead_id,
          user_id: followUp.user_id,
          campaign_id: followUp.campaign_id,
          to_email: toEmail,
          from_email: from,
          from_name: name,
          subject: followUp.subject,
          body,
          provider_id: result.data?.id,
        }
      } catch (err) {
        console.error(`Error sending follow-up ${followUp.id}:`, err)
        return { type: 'failed', followUpId: followUp.id }
      }
    },
    10
  )

  // ── Separar resultados ──
  const sentResults = results.filter((r): r is Extract<FollowUpResult, { type: 'sent' }> => r.type === 'sent')
  const cancelledIds = results.filter(r => r.type === 'cancelled').map(r => r.followUpId)
  const failedIds = results.filter(r => r.type === 'failed' || r.type === 'failed_no_email').map(r => r.followUpId)

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

  // ── 2. Bulk update follow-ups por estado ──
  if (sentResults.length > 0) {
    bulkOps.push(
      supabase.from('follow_ups')
        .update({ status: 'sent', sent_at: sentAt })
        .in('id', sentResults.map(r => r.followUpId))
    )
  }
  if (cancelledIds.length > 0) {
    bulkOps.push(
      supabase.from('follow_ups').update({ status: 'cancelled' }).in('id', cancelledIds)
    )
  }
  if (failedIds.length > 0) {
    bulkOps.push(
      supabase.from('follow_ups').update({ status: 'failed' }).in('id', failedIds)
    )
  }

  // ── 3. Bulk insert activity logs ──
  if (sentResults.length > 0) {
    bulkOps.push(
      supabase.from('activity_logs').insert(
        sentResults.map((r, i) => ({
          lead_id: r.lead_id,
          user_id: r.user_id,
          campaign_id: r.campaign_id ?? null,
          type: 'email_sent',
          title: `Follow-up automático enviado: "${r.subject}"`,
          description: `Para: ${r.to_email}`,
          metadata: { provider_id: r.provider_id, email_id: emailRecords[i]?.id },
        }))
      )
    )
  }

  // ── 4. Marcar leads como contactados si estaban en 'new' ──
  const uniqueLeadIds = [...new Set(sentResults.map(r => r.lead_id))]
  if (uniqueLeadIds.length > 0) {
    bulkOps.push(
      supabase.from('leads').update({ status: 'contacted' }).in('id', uniqueLeadIds).eq('status', 'new')
    )
  }

  // Ejecutar TODAS las operaciones DB en paralelo
  await Promise.all(bulkOps)

  return NextResponse.json({
    message: 'Follow-ups procesados',
    processed: pendingFollowUps.length,
    sent: sentResults.length,
    skipped: cancelledIds.length,
    failed: failedIds.length,
  })
}
