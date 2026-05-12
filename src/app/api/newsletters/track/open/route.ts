import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// GET /api/newsletters/track/open?r={recipientId}
// Tracking de apertura — sirve un pixel 1×1 transparente
// y registra la apertura del email en BD.
// No requiere autenticación — enlace público embebido en emails.
// ============================================================

// 1×1 GIF transparente (base64 hardcoded para máxima velocidad)
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

const PIXEL_RESPONSE = () =>
  new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recipientId = searchParams.get('r')

  // Siempre devolvemos el pixel aunque haya error — no interrumpir la carga del email
  if (!recipientId) return PIXEL_RESPONSE()

  try {
    const supabase = createAdminClient()

    // Obtener el recipient para saber newsletter_id
    const { data: recipient } = await supabase
      .from('newsletter_recipients')
      .select('id, newsletter_id, opened_at, open_count')
      .eq('id', recipientId)
      .single()

    if (!recipient) return PIXEL_RESPONSE()

    const now = new Date().toISOString()
    const newCount = (recipient.open_count ?? 0) + 1

    // Actualizar recipient — primera apertura o incremento
    await supabase
      .from('newsletter_recipients')
      .update({
        opened_at: recipient.opened_at ?? now,  // solo la primera vez
        open_count: newCount,
        status: 'opened',
      })
      .eq('id', recipientId)

    // Actualizar contador total en el newsletter
    if (recipient.newsletter_id) {
      // Solo incrementamos total_opened si es la primera apertura de este recipient
      if (!recipient.opened_at) {
        const { data: nl } = await supabase
          .from('newsletters')
          .select('total_opened')
          .eq('id', recipient.newsletter_id)
          .single()

        if (nl) {
          await supabase
            .from('newsletters')
            .update({ total_opened: (nl.total_opened ?? 0) + 1 })
            .eq('id', recipient.newsletter_id)
        }
      }
    }
  } catch {
    // Silencioso — no interrumpir la carga del email
  }

  return PIXEL_RESPONSE()
}
