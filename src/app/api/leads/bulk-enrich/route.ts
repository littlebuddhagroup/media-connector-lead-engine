import { createClient } from '@/lib/supabase/server'
import { enrichLead } from '@/services/enrichmentService'

// ============================================================
// BULK ENRICH — Enriquece múltiples leads con streaming SSE
// POST { lead_ids: string[] }
// Usa Server-Sent Events para progreso en tiempo real y evitar
// el timeout de serverless. El cliente consume el stream y
// actualiza el progreso en pantalla en tiempo real.
// ============================================================

export const maxDuration = 300 // 5 min — necesita Vercel Pro/Edge

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 })
  }

  const { lead_ids } = await request.json()

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return new Response(JSON.stringify({ error: 'lead_ids requerido' }), { status: 400 })
  }

  if (lead_ids.length > 500) {
    return new Response(JSON.stringify({ error: 'Máximo 500 leads por enriquecimiento masivo' }), { status: 400 })
  }

  // Verificar ownership
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, company_name')
    .in('id', lead_ids)
    .eq('user_id', user.id)

  if (leadsError) {
    return new Response(JSON.stringify({ error: leadsError.message }), { status: 500 })
  }
  if (!leads?.length) {
    return new Response(JSON.stringify({ error: 'No se encontraron leads' }), { status: 404 })
  }

  const encoder = new TextEncoder()
  let controllerClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (controllerClosed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          controllerClosed = true
        }
      }

      send({ type: 'start', total: leads.length })

      let succeeded = 0
      let failed = 0

      // Batches de 3 para no saturar la API de IA y evitar timeouts
      const BATCH_SIZE = 3
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        if (controllerClosed) break
        const batch = leads.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batch.map(async (lead) => {
            try {
              await enrichLead(lead.id, user.id)
              succeeded++
              send({
                type: 'progress',
                id: lead.id,
                company_name: lead.company_name,
                success: true,
                succeeded,
                failed,
                total: leads.length,
              })
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Error desconocido'
              failed++
              send({
                type: 'progress',
                id: lead.id,
                company_name: lead.company_name,
                success: false,
                error: msg,
                succeeded,
                failed,
                total: leads.length,
              })
            }
          })
        )

        // Pausa entre batches para evitar rate limiting
        if (i + BATCH_SIZE < leads.length && !controllerClosed) {
          await new Promise(r => setTimeout(r, 600))
        }
      }

      send({ type: 'done', succeeded, failed, total: leads.length })

      if (!controllerClosed) {
        try { controller.close() } catch { /* ignore */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
