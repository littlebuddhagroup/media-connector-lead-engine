import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// GET /api/newsletters/unsubscribe?token={recipient_id}
// Procesa la baja de un suscriptor desde el enlace del email
// No requiere autenticación — es un enlace público
// Idioma detectado automáticamente del body_html del newsletter
// ============================================================

type Lang = 'es' | 'en' | 'fr'

function detectLang(html: string): Lang {
  if (/vous avez|désabonn|Bonjour|désabonner/i.test(html)) return 'fr'
  if (/you received|unsubscrib|Hi |Hello /i.test(html)) return 'en'
  return 'es'
}

const I18N = {
  ok: {
    title:    { es: 'Baja confirmada',    en: 'Unsubscribed',           fr: 'Désinscription confirmée' },
    body1:    { es: 'ha sido eliminado de nuestra lista de comunicaciones.',
                en: 'has been removed from our communications list.',
                fr: 'a été retiré de notre liste de communications.' },
    body2:    { es: 'Ya no recibirás más newsletters de MyMediaConnect.',
                en: 'You will no longer receive newsletters from MyMediaConnect.',
                fr: 'Vous ne recevrez plus de newsletters de MyMediaConnect.' },
    footer:   { es: 'MyMediaConnect · Si crees que fue un error, contacta con nosotros.',
                en: 'MyMediaConnect · If you think this was a mistake, contact us.',
                fr: 'MyMediaConnect · Si vous pensez que c\'est une erreur, contactez-nous.' },
    htmlLang: { es: 'es', en: 'en', fr: 'fr' },
    pageTitle:{ es: 'Baja confirmada — MyMediaConnect',
                en: 'Unsubscribed — MyMediaConnect',
                fr: 'Désinscription confirmée — MyMediaConnect' },
  },
  already: {
    title:    { es: 'Ya estabas dado de baja',
                en: 'Already unsubscribed',
                fr: 'Déjà désinscrit' },
    body:     { es: 'ya estaba eliminado de nuestra lista.',
                en: 'was already removed from our list.',
                fr: 'avait déjà été retiré de notre liste.' },
    footer:   { es: 'MyMediaConnect · Si tienes dudas, contacta con nosotros.',
                en: 'MyMediaConnect · If you have any questions, contact us.',
                fr: 'MyMediaConnect · Si vous avez des questions, contactez-nous.' },
    pageTitle:{ es: 'Ya estás dado de baja — MyMediaConnect',
                en: 'Already unsubscribed — MyMediaConnect',
                fr: 'Déjà désinscrit — MyMediaConnect' },
  },
  error: {
    title:    { es: 'Enlace no válido',   en: 'Invalid link',           fr: 'Lien invalide' },
    body:     { es: 'Este enlace de baja no es válido o ha expirado. Contacta con nosotros si necesitas ayuda.',
                en: 'This unsubscribe link is invalid or has expired. Contact us if you need help.',
                fr: 'Ce lien de désinscription est invalide ou a expiré. Contactez-nous si vous avez besoin d\'aide.' },
  },
}

const CARD_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
  .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.05); }
  .icon { width: 56px; height: 56px; background: #f0fdf4; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px; }
  .icon-info { background: #eff6ff; }
  h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  p { font-size: 14px; color: #6b7280; line-height: 1.6; }
  .email { font-weight: 600; color: #374151; }
  .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
`

function htmlOk(email: string, lang: Lang): string {
  const t = I18N.ok
  return `<!DOCTYPE html>
<html lang="${t.htmlLang[lang]}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t.pageTitle[lang]}</title>
  <style>${CARD_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>${t.title[lang]}</h1>
    <p>El email <span class="email">${email}</span> ${t.body1[lang]}</p>
    <p style="margin-top:12px">${t.body2[lang]}</p>
    <div class="footer">${t.footer[lang]}</div>
  </div>
</body>
</html>`
}

function htmlAlready(email: string, lang: Lang): string {
  const t = I18N.already
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t.pageTitle[lang]}</title>
  <style>${CARD_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="icon icon-info">ℹ️</div>
    <h1>${t.title[lang]}</h1>
    <p><span class="email">${email}</span> ${t.body[lang]}</p>
    <div class="footer">${t.footer[lang]}</div>
  </div>
</body>
</html>`
}

function htmlError(lang: Lang): string {
  const t = I18N.error
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>${t.title[lang]} — MyMediaConnect</title>
  <style>${CARD_CSS}</style>
</head>
<body>
  <div class="card">
    <h1>${t.title[lang]}</h1>
    <p>${t.body[lang]}</p>
  </div>
</body>
</html>`
}

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  // Detectar idioma del Accept-Language como fallback si no hay newsletter
  const acceptLang = request.headers.get('accept-language') ?? ''
  const browserLang: Lang = /^fr/i.test(acceptLang) ? 'fr' : /^en/i.test(acceptLang) ? 'en' : 'es'

  if (!token) {
    return new NextResponse(htmlError(browserLang), { status: 400, headers: HTML_HEADERS })
  }

  const supabase = createAdminClient()

  // Buscar recipient + body_html del newsletter para detectar idioma
  const { data: recipient } = await supabase
    .from('newsletter_recipients')
    .select('id, email, user_id, lead_id, newsletter_id, unsubscribed_at, newsletter:newsletters(body_html)')
    .eq('id', token)
    .maybeSingle()

  if (!recipient) {
    return new NextResponse(htmlError(browserLang), { status: 404, headers: HTML_HEADERS })
  }

  // Detectar idioma desde el cuerpo del newsletter, con fallback al navegador
  const nlBody = (recipient.newsletter as { body_html?: string } | null)?.body_html ?? ''
  const lang: Lang = nlBody ? detectLang(nlBody) : browserLang

  // Si ya estaba dado de baja, mostrar página informativa
  if (recipient.unsubscribed_at) {
    return new NextResponse(htmlAlready(recipient.email, lang), { status: 200, headers: HTML_HEADERS })
  }

  const now = new Date().toISOString()

  // Marcar recipient como dado de baja
  await supabase
    .from('newsletter_recipients')
    .update({ unsubscribed_at: now, status: 'unsubscribed' })
    .eq('id', recipient.id)

  // Registrar en lista negra global (upsert por si ya existía de otro newsletter)
  await supabase
    .from('newsletter_unsubscribes')
    .upsert({
      email:           recipient.email,
      user_id:         recipient.user_id,
      lead_id:         recipient.lead_id,
      newsletter_id:   recipient.newsletter_id,
      recipient_id:    recipient.id,
      unsubscribed_at: now,
    }, { onConflict: 'email,user_id' })

  // Incrementar contador en el newsletter
  if (recipient.newsletter_id) {
    await supabase.rpc('increment_newsletter_unsubscribed', {
      newsletter_id: recipient.newsletter_id,
    }).then(() => {
      // ok
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

  return new NextResponse(htmlOk(recipient.email, lang), { status: 200, headers: HTML_HEADERS })
}
