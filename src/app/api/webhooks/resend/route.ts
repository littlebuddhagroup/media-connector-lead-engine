import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// ============================================================
// RESEND WEBHOOK — Tracking de aperturas y follow-ups automáticos
// ============================================================

function verifyWebhook(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return true // En dev sin secret, dejamos pasar

  const svixId = headers.get('svix-id') ?? ''
  const svixTimestamp = headers.get('svix-timestamp') ?? ''
  const svixSignature = headers.get('svix-signature') ?? ''

  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Verificar que el timestamp no sea demasiado viejo (5 min)
  const now = Math.floor(Date.now() / 1000)
  const ts = parseInt(svixTimestamp)
  if (Math.abs(now - ts) > 300) return false

  // Calcular firma esperada
  const toSign = `${svixId}.${svixTimestamp}.${body}`
  // El secret de Resend viene como "whsec_xxx", quitamos el prefijo
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')
  const hmac = crypto.createHmac('sha256', secretBytes)
  hmac.update(toSign)
  const computed = 'v1,' + hmac.digest('base64')

  // Comparar con las firmas del header (puede haber varias separadas por espacio)
  const signatures = svixSignature.split(' ')
  return signatures.some(sig => sig === computed)
}

export async function POST(request: Request) {
  const body = await request.text()

  if (!verifyWebhook(body, request.headers)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let payload: { type: string; data: Record<string, unknown> }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { type, data } = payload
  const resendEmailId = data.email_id as string

  if (!resendEmailId) {
    return NextResponse.json({ ok: true }) // Ignorar eventos sin email_id
  }

  const supabase = createAdminClient()

  // Buscar el email por provider_id (= Resend email ID)
  const { data: email } = await supabase
    .from('emails')
    .select('id, lead_id, user_id, campaign_id, subject, body, to_email, to_name, open_count')
    .eq('provider_id', resendEmailId)
    .single()

  if (!email) {
    // Email no encontrado — puede ser de otra fuente
    return NextResponse.json({ ok: true })
  }

  // Registrar evento
  await supabase.from('email_events').insert({
    email_id: email.id,
    lead_id: email.lead_id,
    user_id: email.user_id,
    event_type: type.replace('email.', ''), // 'opened', 'clicked', 'bounced', 'delivered'
    metadata: data,
  })

  // Actualizar estado del email según el evento
  if (type === 'email.delivered') {
    await supabase
      .from('emails')
      .update({ status: 'delivered' })
      .eq('id', email.id)
      .eq('status', 'sent') // Solo si estaba en 'sent'
  }

  if (type === 'email.bounced') {
    await supabase
      .from('emails')
      .update({ status: 'bounced' })
      .eq('id', email.id)
  }

  if (type === 'email.opened') {
    const openCount = (email.open_count ?? 0) + 1
    await supabase
      .from('emails')
      .update({
        status: 'opened',
        opened_at: new Date().toISOString(),
        open_count: openCount,
      })
      .eq('id', email.id)

    // Registrar actividad
    await supabase.from('activity_logs').insert({
      lead_id: email.lead_id,
      user_id: email.user_id,
      campaign_id: email.campaign_id,
      type: 'email_sent', // Reutilizamos el tipo más cercano
      title: `Email abierto: "${email.subject}"`,
      description: `Aperturas totales: ${openCount}`,
    })

    // ── AUTO FOLLOW-UP ───────────────────────────────────────────
    // Programar follow-up automático si:
    // 1. El lead no ha contestado
    // 2. No hay ya un follow-up pendiente para este email

    // ¿Ha contestado el lead?
    const { data: lead } = await supabase
      .from('leads')
      .select('status')
      .eq('id', email.lead_id)
      .single()

    const hasReplied = lead?.status === 'replied' || lead?.status === 'interested'

    if (!hasReplied) {
      // ¿Ya existe un follow-up pendiente para este email?
      const { data: existingFollowUp } = await supabase
        .from('follow_ups')
        .select('id')
        .eq('original_email_id', email.id)
        .eq('status', 'pending')
        .single()

      if (!existingFollowUp) {
        // Programar follow-up en 2 días
        const scheduledFor = new Date()
        scheduledFor.setDate(scheduledFor.getDate() + 2)
        scheduledFor.setHours(9, 0, 0, 0) // A las 9:00

        // Generar asunto y cuerpo del follow-up
        const followUpSubject = `Re: ${email.subject}`
        const followUpBody = generateFollowUpBody(email.to_name)

        await supabase.from('follow_ups').insert({
          original_email_id: email.id,
          lead_id: email.lead_id,
          user_id: email.user_id,
          campaign_id: email.campaign_id,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending',
          subject: followUpSubject,
          body: followUpBody,
        })

        await supabase.from('activity_logs').insert({
          lead_id: email.lead_id,
          user_id: email.user_id,
          campaign_id: email.campaign_id,
          type: 'email_sent',
          title: `Follow-up automático programado`,
          description: `Se enviará el ${scheduledFor.toLocaleDateString('es-ES')} a las 9:00`,
        })
      }
    }
  }

  if (type === 'email.clicked') {
    // Si hizo clic, probablemente está interesado — actualizar estado del lead
    await supabase
      .from('leads')
      .update({ status: 'interested' })
      .eq('id', email.lead_id)
      .in('status', ['new', 'contacted', 'enriched'])

    // Cancelar follow-up pendiente si lo hay (ya mostró interés)
    await supabase
      .from('follow_ups')
      .update({ status: 'cancelled' })
      .eq('lead_id', email.lead_id)
      .eq('status', 'pending')
  }

  return NextResponse.json({ ok: true })
}

function generateFollowUpBody(toName?: string): string {
  const greeting = toName ? `Hola ${toName},` : 'Hola,'
  return `${greeting}

Te escribía de nuevo porque vi que habías tenido ocasión de revisar mi mensaje anterior sobre MyMediaConnect.

Entiendo que el día a día es intenso en un equipo de marketing. Precisamente por eso me pareció relevante contactarte: muchas marcas como la vuestra dedican demasiado tiempo a gestionar versiones de diseño, aprobaciones por email con jurídico o dirección, y coordinar cambios de packaging con la agencia.

MyMediaConnect centraliza todo eso y reduce el time-to-market de nuevos materiales en un 40%.

¿Tendríais 20 minutos esta semana para ver si encaja con vuestra operativa actual?

Un saludo,`
}
