import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// RESEND INBOUND EMAIL WEBHOOK — Detección automática de respuestas
//
// Configuración necesaria:
//   1. DNS: añadir MX "reply" → inbound.resend.com (subdominio, no afecta MX corporativo)
//      Tipo: MX  Nombre: reply  Valor: inbound.resend.com  Prioridad: 10
//   2. Resend Dashboard → Inbound → webhook: /api/webhooks/resend/inbound
//   3. Variable de entorno: REPLY_SUBDOMAIN=reply.mymediaconnect.com
//
// Flujo de detección:
//   Email enviado con reply-to: reply+{lead_id}@reply.mymediaconnect.com
//   Lead responde → Resend recibe en el subdominio → llama este webhook
//   El webhook extrae el lead_id del campo "to", cancela secuencia, actualiza estado
// ============================================================

export async function POST(request: Request) {
  // NOTA: Los webhooks de email inbound de Resend NO usan firma Svix —
  // NO aplicar aquí el RESEND_WEBHOOK_SECRET, que es solo para delivery events.

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Resend puede enviar inbound en formato plano o anidado en { data: {...} }
  const data = (payload.data as Record<string, unknown> | undefined) ?? payload

  const fromEmail  = (data.from as string | undefined) ?? ''
  // "to" puede ser string, array de strings, o string con display name
  const toRaw      = data.to
  const toEmail    = Array.isArray(toRaw) ? (toRaw as string[]).join(' ') : (toRaw as string | undefined) ?? ''
  const subject    = (data.subject as string | undefined) ?? ''
  const bodyText   = (data.text as string | undefined) ?? ''
  const bodyHtml   = (data.html as string | undefined) ?? ''
  const inReplyTo  = (data.in_reply_to as string | undefined) ?? ''
  const references = (data.references as string | undefined) ?? ''

  // ── Método 1: extraer lead_id del campo "to" (reply+{lead_id}@subdominio)
  // Patrón: reply+UUID@reply.mymediaconnect.com
  // También busca en subject/headers por si el MTA reescribe el "to"
  let leadId: string | null = null
  const uuidRegex = /reply\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

  // Buscar UUID en to, subject e in_reply_to (máxima cobertura)
  const searchTargets = [toEmail, subject, inReplyTo, JSON.stringify(data.headers ?? {})]
  let match: RegExpMatchArray | null = null
  for (const target of searchTargets) {
    match = target.match(uuidRegex)
    if (match?.[1]) { leadId = match[1]; break }
  }

  // ── Método 2 (fallback): buscar por email del remitente
  let lead: { id: string; user_id: string; email: string; status: string } | null = null

  if (leadId) {
    const { data } = await supabase
      .from('leads')
      .select('id, user_id, email, status')
      .eq('id', leadId)
      .maybeSingle()
    lead = data
  }

  if (!lead && fromEmail) {
    const { data } = await supabase
      .from('leads')
      .select('id, user_id, email, status')
      .ilike('email', fromEmail)
      .maybeSingle()
    lead = data
  }

  // Guardar email entrante (si existe la tabla inbound_emails)
  let inboundId: string | null = null
  try {
    const { data: inbound } = await supabase
      .from('inbound_emails')
      .insert({
        from_email:     fromEmail,
        to_email:       toEmail,
        subject,
        body_text:      bodyText,
        body_html:      bodyHtml,
        in_reply_to:    inReplyTo,
        references_ids: references,
        lead_id:        lead?.id ?? null,
        user_id:        lead?.user_id ?? null,
        processed:      !!lead,
        raw_payload:    payload,
      })
      .select('id')
      .single()
    if (inbound) inboundId = inbound.id
  } catch { /* tabla puede no existir aún */ }

  if (!lead) {
    return NextResponse.json({ ok: true, message: 'No lead found' })
  }

  // Buscar secuencia activa para este lead
  const { data: activeSeq } = await supabase
    .from('sequences')
    .select('id, campaign_id')
    .eq('lead_id', lead.id)
    .eq('status', 'active')
    .maybeSingle()

  // Cancelar secuencia activa
  if (activeSeq) {
    await Promise.all([
      supabase.from('sequences').update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      }).eq('id', activeSeq.id),
      supabase.from('sequence_steps')
        .update({ status: 'skipped', replied_at: new Date().toISOString() })
        .eq('sequence_id', activeSeq.id)
        .eq('status', 'pending'),
    ])
  }

  // Actualizar estado del lead
  if (['new', 'contacted', 'enriched', 'approved'].includes(lead.status)) {
    await supabase.from('leads')
      .update({ status: 'replied', updated_at: new Date().toISOString() })
      .eq('id', lead.id)
  }

  // Marcar el último email enviado como replied
  const { data: lastEmail } = await supabase
    .from('emails')
    .select('id')
    .eq('lead_id', lead.id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastEmail) {
    await supabase.from('emails').update({
      status: 'replied',
      replied_at: new Date().toISOString(),
    }).eq('id', lastEmail.id)
  }

  // Log de actividad
  await supabase.from('activity_logs').insert({
    lead_id:     lead.id,
    user_id:     lead.user_id,
    campaign_id: activeSeq?.campaign_id ?? null,
    type:        'reply_detected',
    title:       'Respuesta recibida por email',
    description: `De: ${fromEmail} — Asunto: ${subject}`,
    metadata: {
      from_email:       fromEmail,
      to_email:         toEmail,
      subject,
      lead_id_from_to:  !!match,
      sequence_id:      activeSeq?.id ?? null,
      inbound_email_id: inboundId,
      auto_detected:    true,
    },
  })

  return NextResponse.json({
    ok: true,
    lead_id:            lead.id,
    detection_method:   match ? 'reply_to_address' : 'sender_email',
    sequence_cancelled: !!activeSeq,
  })
}

// GET — endpoint de salud para verificar que el webhook es accesible
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/resend/inbound',
    method:   'POST',
    status:   'listening',
    note:     'Enviar POST con payload de email inbound de Resend',
  })
}
