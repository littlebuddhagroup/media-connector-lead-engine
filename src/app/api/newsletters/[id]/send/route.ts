import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

type Params = { params: Promise<{ id: string }> }

// ============================================================
// NEWSLETTER SEND — Envía el newsletter a los destinatarios
// POST /api/newsletters/[id]/send
//
// Flujo:
// 1. Determinar destinatarios según target_type
// 2. Crear newsletter_recipients (one per lead/email)
// 3. Enviar emails con rotación de cuentas
// 4. Actualizar stats en newsletter
// ============================================================

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // 1. Obtener newsletter
  const { data: newsletter } = await supabase
    .from('newsletters')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!newsletter) return NextResponse.json({ error: 'Newsletter no encontrado' }, { status: 404 })
  if (newsletter.status === 'sending') return NextResponse.json({ error: 'Ya se está enviando' }, { status: 409 })
  if (newsletter.status === 'sent') return NextResponse.json({ error: 'Ya fue enviado' }, { status: 409 })

  // 2. Obtener cuentas de envío configuradas (rotación)
  const { data: settings } = await admin.from('settings')
    .select('email_from_address, email_from_name, email_signature')
    .eq('user_id', user.id)
    .single()

  const { data: integrations } = await admin.from('api_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('provider', 'resend')
    .eq('is_active', true)
    .single()

  if (!integrations?.api_key) {
    return NextResponse.json({ error: 'No hay API key de Resend configurada. Ve a Configuración.' }, { status: 400 })
  }

  // Cuentas de envío para rotación — mismas que en secuencias
  const SENDER_ACCOUNTS: { email: string; name: string }[] = [
    { email: 'guillaume@mymediaconnect.com',   name: 'Guillaume — MyMediaConnect' },
    { email: 'guillaume@gomymediaconnect.com', name: 'Guillaume — MyMediaConnect' },
    { email: 'guillaume@mymediaconnectgo.com', name: 'Guillaume — MyMediaConnect' },
    { email: 'guillaume@mymediaconnect.es',    name: 'Guillaume — MyMediaConnect' },
  ]

  // Si el newsletter tiene from_email fijo lo respetamos; si no, rotamos entre las 4 cuentas
  const fixedFromEmail = newsletter.from_email || null
  const fixedFromName  = newsletter.from_name  || settings?.email_from_name || 'Guillaume — MyMediaConnect'

  if (!fixedFromEmail && SENDER_ACCOUNTS.length === 0) {
    return NextResponse.json({ error: 'No hay cuentas de envío configuradas.' }, { status: 400 })
  }

  // 3. Resolver destinatarios
  let recipientLeads: Array<{ id?: string; email: string; company_name?: string; first_name?: string; last_name?: string }> = []

  if (newsletter.target_type === 'list' && newsletter.target_list_id) {
    const { data: members } = await admin
      .from('list_members')
      .select('lead:leads(id, email, company_name, first_name, last_name)')
      .eq('list_id', newsletter.target_list_id)
    recipientLeads = (members ?? [])
      .map((m: Record<string, unknown>) => m.lead as { id: string; email: string; company_name: string } | null)
      .filter((l: { id: string; email: string; company_name: string } | null): l is { id: string; email: string; company_name: string } => !!l?.email)
  } else if (newsletter.target_type === 'leads' && newsletter.target_filters) {
    // Filtros específicos
    let query = admin.from('leads').select('id, email, company_name, first_name, last_name').eq('user_id', user.id)
    const f = newsletter.target_filters as Record<string, unknown>
    if (f.status) query = query.eq('status', f.status)
    if (f.priority) query = query.eq('priority', f.priority)
    if (f.campaign_id) query = query.eq('campaign_id', f.campaign_id)
    const { data } = await query.not('email', 'is', null)
    recipientLeads = data ?? []
  } else {
    // Todos los leads con email
    const { data } = await admin
      .from('leads')
      .select('id, email, company_name, first_name, last_name')
      .eq('user_id', user.id)
      .not('email', 'is', null)
      .neq('email', '')
    recipientLeads = data ?? []
  }

  if (recipientLeads.length === 0) {
    return NextResponse.json({ error: 'No hay destinatarios con email válido' }, { status: 400 })
  }

  // ── Filtrar emails dados de baja (lista negra global) ──
  const { data: unsubscribed } = await admin
    .from('newsletter_unsubscribes')
    .select('email')
    .eq('user_id', user.id)
  const unsubscribedSet = new Set((unsubscribed ?? []).map((u: { email: string }) => u.email.toLowerCase()))
  const filteredLeads = recipientLeads.filter(l => !unsubscribedSet.has(l.email.toLowerCase()))
  const skippedCount  = recipientLeads.length - filteredLeads.length

  if (filteredLeads.length === 0) {
    return NextResponse.json({ error: `Todos los destinatarios (${recipientLeads.length}) están dados de baja.` }, { status: 400 })
  }

  // Marcar como enviando
  await supabase.from('newsletters').update({
    status: 'sending',
    total_recipients: filteredLeads.length,
  }).eq('id', id)

  // 4. Enviar emails
  const resend = new Resend(integrations.api_key)
  let sent = 0, failed = 0, bounced = 0

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://media-connector-lead-engine.vercel.app'

  // Crear recipients en BD — asignar cuenta rotativa a cada destinatario
  const recipientInserts = filteredLeads.map((lead, idx) => {
    const account = fixedFromEmail
      ? { email: fixedFromEmail, name: fixedFromName }
      : SENDER_ACCOUNTS[idx % SENDER_ACCOUNTS.length]
    return {
      newsletter_id: id,
      user_id: user.id,
      lead_id: lead.id ?? null,
      email: lead.email,
      name: lead.first_name
        ? `${lead.first_name} ${lead.last_name ?? ''}`.trim()
        : lead.company_name ?? '',
      from_email: account.email,
      from_name: account.name,
      status: 'pending' as const,
    }
  })

  const { data: recipients } = await admin
    .from('newsletter_recipients')
    .insert(recipientInserts)
    .select('id, email, name, lead_id, from_email, from_name')

  // Enviar en batches de 10 para evitar rate limiting
  const BATCH_SIZE = 10
  for (let i = 0; i < (recipients ?? []).length; i += BATCH_SIZE) {
    const batch = (recipients ?? []).slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (recipient: { id: string; email: string; name?: string; from_email: string; from_name?: string }) => {
      try {
        const senderEmail = recipient.from_email
        const senderName  = recipient.from_name || fixedFromName

        // Personalizar cuerpo con nombre del destinatario
        const personalizedHtml = newsletter.body_html
          .replace(/\{\{nombre\}\}/gi, recipient.name || 'estimado cliente')
          .replace(/\{\{name\}\}/gi,   recipient.name || 'valued customer')

        // Footer legal con enlace de baja (token = recipient.id)
        const unsubscribeUrl = `${APP_URL}/api/newsletters/unsubscribe?token=${recipient.id}`
        const footer = `
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;font-family:sans-serif;line-height:1.6;">
            Has recibido este email porque estás en la lista de contactos de MyMediaConnect.<br>
            <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Darse de baja</a>
            &nbsp;·&nbsp; MyMediaConnect
          </div>`

        const fullHtml = personalizedHtml.includes('</body>')
          ? personalizedHtml.replace('</body>', `${footer}</body>`)
          : personalizedHtml + footer

        const { data: emailData, error: emailErr } = await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to: recipient.email,
          subject: newsletter.subject,
          html: fullHtml,
          replyTo: newsletter.reply_to || senderEmail,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@${senderEmail.split('@')[1]}?subject=unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })

        if (emailErr || !emailData?.id) {
          failed++
          await admin.from('newsletter_recipients').update({
            status: 'failed',
            sent_at: new Date().toISOString(),
          }).eq('id', recipient.id)
        } else {
          sent++
          await admin.from('newsletter_recipients').update({
            status: 'sent',
            provider_id: emailData.id,
            sent_at: new Date().toISOString(),
          }).eq('id', recipient.id)
        }
      } catch {
        failed++
        await admin.from('newsletter_recipients').update({ status: 'failed' }).eq('id', recipient.id)
      }
    }))
    // Pequeña pausa entre batches
    if (i + BATCH_SIZE < (recipients ?? []).length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  // 5. Actualizar stats del newsletter
  await supabase.from('newsletters').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    total_sent: sent,
    total_recipients: recipientLeads.length,
    total_bounced: bounced,
  }).eq('id', id)

  return NextResponse.json({
    data: { sent, failed, skipped: skippedCount, total: filteredLeads.length + skippedCount }
  })
}
