import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// GET /api/newsletters/track/click?r={recipientId}&url={encodedUrl}
// Tracking de clicks — registra el click y redirige al destino.
// No requiere autenticación — enlace público embebido en emails.
// ============================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recipientId = searchParams.get('r')
  const encodedUrl  = searchParams.get('url')

  // Si no hay URL de destino, redirigir a la web principal
  const destination = encodedUrl
    ? decodeURIComponent(encodedUrl)
    : 'https://mymediaconnect.com'

  // Validación básica de la URL de destino
  let safeDestination = destination
  try {
    const parsed = new URL(destination)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      safeDestination = 'https://mymediaconnect.com'
    }
  } catch {
    safeDestination = 'https://mymediaconnect.com'
  }

  // Registrar click en BD de forma asíncrona (no bloquea el redirect)
  if (recipientId) {
    const supabase = createAdminClient()

    supabase
      .from('newsletter_recipients')
      .select('id, newsletter_id, clicked_at, click_count')
      .eq('id', recipientId)
      .single()
      .then(async ({ data: recipient }: { data: { id: string; newsletter_id: string | null; clicked_at: string | null; click_count: number | null } | null }) => {
        if (!recipient) return

        const now = new Date().toISOString()
        const newCount = (recipient.click_count ?? 0) + 1

        await supabase
          .from('newsletter_recipients')
          .update({
            clicked_at: recipient.clicked_at ?? now,
            click_count: newCount,
            last_clicked_url: safeDestination,
          })
          .eq('id', recipientId)

        // Incrementar total_clicked en el newsletter solo en el primer click
        if (!recipient.clicked_at && recipient.newsletter_id) {
          const { data: nl } = await supabase
            .from('newsletters')
            .select('total_clicked')
            .eq('id', recipient.newsletter_id)
            .single()

          if (nl) {
            await supabase
              .from('newsletters')
              .update({ total_clicked: ((nl as { total_clicked: number | null }).total_clicked ?? 0) + 1 })
              .eq('id', recipient.newsletter_id)
          }
        }
      })
      .catch(() => { /* silencioso */ })
  }

  // Redirigir inmediatamente al destino
  return NextResponse.redirect(safeDestination, { status: 302 })
}
