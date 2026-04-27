import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMessage } from '@/services/aiService'
import type { MessageType, MessageTone } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API Key no configurada' }, { status: 400 })
  }

  const body = await request.json()
  const { lead_id, type, tone, additional_context } = body

  if (!lead_id || !type) {
    return NextResponse.json({ error: 'lead_id y type son requeridos' }, { status: 400 })
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
    const generated = await generateMessage(
      lead,
      lead.enrichment?.[0] ?? null,
      type as MessageType,
      (tone as MessageTone) ?? 'consultivo',
      additional_context
    )

    // Guardar el mensaje generado
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        lead_id,
        user_id: user.id,
        campaign_id: lead.campaign_id,
        type,
        tone: tone ?? 'consultivo',
        subject: generated.subject,
        body: generated.body,
        model_used: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
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
      title: `Mensaje generado: ${type.replace('_', ' ')}`,
      description: `Tono: ${tone ?? 'consultivo'}`,
    })

    return NextResponse.json({ data: message })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generando mensaje'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
