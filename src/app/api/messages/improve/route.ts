import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { improveMessage } from '@/services/aiService'
import { getUserAISettings } from '@/lib/getUserAIProvider'
import type { MessageTone } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { lead_id, draft, tone, instructions } = body

  if (!lead_id || !draft?.trim()) {
    return NextResponse.json({ error: 'lead_id y draft son requeridos' }, { status: 400 })
  }

  // Obtener lead y enriquecimiento
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*, enrichment:lead_enrichments(*)')
    .eq('id', lead_id)
    .eq('user_id', user.id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  try {
    const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)
    const improved = await improveMessage(
      draft,
      lead,
      lead.enrichment?.[0] ?? null,
      (tone as MessageTone) ?? 'consultivo',
      instructions,
      aiProvider,
      aiModel
    )

    // Guardar el mensaje mejorado
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        lead_id,
        user_id: user.id,
        campaign_id: lead.campaign_id,
        type: 'initial_email',
        tone: tone ?? 'consultivo',
        subject: improved.subject,
        body: improved.body,
        model_used: aiProvider === 'groq'
          ? (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile')
          : aiModel,
      })
      .select()
      .single()

    if (msgError) throw new Error(msgError.message)

    // Registrar actividad
    await supabase.from('activity_logs').insert({
      lead_id,
      user_id: user.id,
      campaign_id: lead.campaign_id,
      type: 'message_generated',
      title: 'Mensaje mejorado con IA',
      description: `Borrador del usuario reescrito con tono: ${tone ?? 'consultivo'}`,
    })

    return NextResponse.json({ data: message })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error mejorando mensaje'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
