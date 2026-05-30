// ============================================================
// TEST NOTIFICATION — Envía un email de prueba a los destinatarios
// GET /api/settings/test-notification
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Leer settings del usuario
  const { data: settings } = await supabase
    .from('settings')
    .select('notification_emails, email_from_address, email_from_name')
    .eq('user_id', user.id)
    .single()

  // Determinar destinatarios
  const recipients: string[] = settings?.notification_emails
    ? settings.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
    : [user.email!]

  if (!recipients.length || !recipients[0]) {
    return NextResponse.json({ error: 'No hay email de destino configurado.' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'Resend no está configurado en el servidor.' }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? settings?.email_from_address ?? 'noreply@mymediaconnect.com'
  const fromName = settings?.email_from_name ?? 'Media Connector Lead Engine'
  const now = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' })

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: recipients,
    subject: '✅ Prueba de notificaciones — Media Connector Lead Engine',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e; font-size: 18px; margin-bottom: 8px;">
          Notificaciones configuradas correctamente
        </h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">
          Este es un email de prueba enviado el <strong>${now}</strong>.
        </p>
        <p style="color: #374151; font-size: 14px;">
          Si recibes este mensaje, las notificaciones de briefing diario y alertas de señales de compra
          llegarán correctamente a:
        </p>
        <ul style="margin: 12px 0; padding-left: 20px;">
          ${recipients.map(r => `<li style="color: #1d4ed8; font-size: 14px;">${r}</li>`).join('')}
        </ul>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Media Connector Lead Engine — <a href="https://mymediaconnect.com" style="color: #6366f1;">mymediaconnect.com</a>
        </p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error: `Error al enviar: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    sent_to: recipients,
    message: `Email de prueba enviado a: ${recipients.join(', ')}`,
  })
}
