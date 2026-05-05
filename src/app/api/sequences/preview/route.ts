import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMessage } from '@/services/aiService'

// POST /api/sequences/preview
// Genera los 3 emails con IA sin guardar nada — para revisión previa al envío
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { lead_id } = await request.json()
  if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 })

  const { data: lead } = await supabase
    .from('leads')
    .select('*, enrichment:lead_enrichments(*)')
    .eq('id', lead_id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  try {
    const enrichment = Array.isArray(lead.enrichment) ? lead.enrichment[0] : lead.enrichment

    const [email1, email2, email3] = await Promise.all([
      generateMessage(lead, enrichment, 'initial_email', 'consultivo'),
      generateMessage(lead, enrichment, 'followup_1', 'directo'),
      generateMessage(lead, enrichment, 'followup_2', 'cercano'),
    ])

    return NextResponse.json({
      steps: [
        {
          step_number: 1,
          label: 'Email inicial · Día 1 (se envía ahora)',
          subject: email1.subject ?? `Presentación MyMediaConnect para ${lead.company_name}`,
          body: email1.body,
          delay_days: 0,
        },
        {
          step_number: 2,
          label: 'Follow-up · Día 5',
          subject: email2.subject ?? 'Re: ¿Has tenido ocasión de revisar mi mensaje?',
          body: email2.body,
          delay_days: 5,
        },
        {
          step_number: 3,
          label: 'Último intento · Día 10',
          subject: email3.subject ?? 'Último intento — ¿Te interesa el tema?',
          body: email3.body,
          delay_days: 10,
        },
      ],
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Error generando emails con IA: ' + (err instanceof Error ? err.message : 'Unknown') },
      { status: 500 }
    )
  }
}
