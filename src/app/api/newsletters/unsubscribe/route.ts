import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// GET /api/newsletters/unsubscribe?token={recipient_id}
// Procesa la baja de un suscriptor desde el enlace del email
// No requiere autenticación — es un enlace público
// ============================================================

const HTML_OK = (email: string) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Baja confirmada — MyMediaConnect</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.05); }
    .icon { width: 56px; height: 56px; background: #f0fdf4; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.6; }
    .email { font-weight: 600; color: #374151; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Baja confirmada</h1>
    <p>El email <span class="email">${email}</span> ha sido eliminado de nuestra lista de comunicaciones.</p>
    <p style="margin-top:12px">Ya no recibirás más newsletters de MyMediaConnect.</p>
    <div class="footer">MyMediaConnect · Si crees que fue un error, contacta con nosotros.</div>
  </div>
</body>
</html>`

const HTML_ALREADY = (email: string) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ya estás dado de baja — MyMediaConnect</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.05); }
    .icon { width: 56px; height: 56px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.6; }
    .email { font-weight: 600; color: #374151; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">ℹ️</div>
    <h1>Ya estabas dado de baja</h1>
    <p>El email <span class="email">${email}</span> ya estaba eliminado de nuestra lista.</p>
    <div class="footer">MyMediaConnect · Si tienes dudas, contacta con nosotros.</div>
  </div>
</body>
</html>`

const HTML_ERROR = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Enlace no válido — MyMediaConnect</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    p { font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Enlace no válido</h1>
    <p>Este enlace de baja no es válido o ha expirado. Contacta con nosotros si necesitas ayuda.</p>
  </div>
</body>
</html>`

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse(HTML_ERROR, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const supabase = createAdminClient()

  // Buscar el recipient por token (= recipient.id)
  const { data: recipient } = await supabase
    .from('newsletter_recipients')
    .select('id, email, user_id, lead_id, newsletter_id, unsubscribed_at')
    .eq('id', token)
    .single()

  if (!recipient) {
    return new NextResponse(HTML_ERROR, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const now = new Date().toISOString()

  // Si ya estaba dado de baja, mostrar página informativa
  if (recipient.unsubscribed_at) {
    return new NextResponse(HTML_ALREADY(recipient.email), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Marcar recipient como dado de baja
  await supabase
    .from('newsletter_recipients')
    .update({ unsubscribed_at: now, status: 'unsubscribed' })
    .eq('id', recipient.id)

  // Registrar en lista negra global (upsert por si ya existía de otro newsletter)
  await supabase
    .from('newsletter_unsubscribes')
    .upsert({
      email:         recipient.email,
      user_id:       recipient.user_id,
      lead_id:       recipient.lead_id,
      newsletter_id: recipient.newsletter_id,
      recipient_id:  recipient.id,
      unsubscribed_at: now,
    }, { onConflict: 'email,user_id' })

  // Incrementar contador en el newsletter
  if (recipient.newsletter_id) {
    await supabase.rpc('increment_newsletter_unsubscribed', {
      newsletter_id: recipient.newsletter_id,
    }).then(() => {
      // Fallback manual si el RPC no existe
    }).catch(async () => {
      const { data: nl } = await supabase
        .from('newsletters')
        .select('total_unsubscribed')
        .eq('id', recipient.newsletter_id)
        .single()
      if (nl) {
        await supabase
          .from('newsletters')
          .update({ total_unsubscribed: (nl.total_unsubscribed ?? 0) + 1 })
          .eq('id', recipient.newsletter_id)
      }
    })
  }

  return new NextResponse(HTML_OK(recipient.email), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
