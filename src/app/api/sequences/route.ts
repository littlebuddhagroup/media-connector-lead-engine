import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMessage } from '@/services/aiService'

// ============================================================
// SECUENCIAS — API para crear y gestionar secuencias 3 toques
// ============================================================

// GET — Lista de secuencias del usuario
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')

  let query = supabase
    .from('sequences')
    .select(`
      *,
      sequence_steps (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (leadId) {
    query = query.eq('lead_id', leadId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST — Crear nueva secuencia para un lead
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { lead_id, campaign_id, custom_steps } = await request.json()

  if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 })

  // Verificar que no hay secuencia activa para este lead
  const { data: existing } = await supabase
    .from('sequences')
    .select('id')
    .eq('lead_id', lead_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Este lead ya tiene una secuencia activa' }, { status: 409 })
  }

  // Obtener datos del lead para generar mensajes
  const { data: lead } = await supabase
    .from('leads')
    .select(`*, enrichment:lead_enrichments(*)`)
    .eq('id', lead_id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  // Generar los 3 emails con IA (o usar custom_steps si se pasan)
  let steps: Array<{ step_number: number; subject: string; body: string; delay_days: number }>

  if (custom_steps?.length >= 3) {
    steps = custom_steps
  } else {
    try {
      const enrichment = Array.isArray(lead.enrichment) ? lead.enrichment[0] : lead.enrichment

      const [email1, email2, email3] = await Promise.all([
        generateMessage(lead, enrichment, 'initial_email', 'consultivo'),
        generateMessage(lead, enrichment, 'followup_1', 'directo'),
        generateMessage(lead, enrichment, 'followup_2', 'cercano'),
      ])

      steps = [
        { step_number: 1, subject: email1.subject ?? `Presentación MyMediaConnect para ${lead.company_name}`, body: email1.body, delay_days: 0 },
        { step_number: 2, subject: email2.subject ?? `Re: ¿Has tenido ocasión de revisar mi mensaje?`, body: email2.body, delay_days: 5 },
        { step_number: 3, subject: email3.subject ?? `Último intento — ¿Te interesa el tema?`, body: email3.body, delay_days: 10 },
      ]
    } catch (err) {
      return NextResponse.json({ error: 'Error generando mensajes con IA: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 })
    }
  }

  // Crear la secuencia
  const { data: sequence, error: seqError } = await supabase
    .from('sequences')
    .insert({
      user_id: user.id,
      campaign_id: campaign_id ?? lead.campaign_id ?? null,
      lead_id,
      name: `Secuencia 3 toques — ${lead.company_name}`,
      status: 'active',
      current_step: 0,
    })
    .select()
    .single()

  if (seqError) return NextResponse.json({ error: seqError.message }, { status: 500 })

  // Crear los pasos con fechas programadas
  const now = new Date()
  const stepsToInsert = steps.map(step => {
    const scheduledFor = new Date(now)
    scheduledFor.setDate(scheduledFor.getDate() + step.delay_days)
    scheduledFor.setHours(9, 0, 0, 0) // Siempre a las 9:00

    return {
      sequence_id: sequence.id,
      user_id: user.id,
      step_number: step.step_number,
      subject: step.subject,
      body: step.body,
      delay_days: step.delay_days,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
    }
  })

  await supabase.from('sequence_steps').insert(stepsToInsert)

  // Registrar actividad
  await supabase.from('activity_logs').insert({
    lead_id,
    user_id: user.id,
    campaign_id: campaign_id ?? lead.campaign_id ?? null,
    type: 'email_sent',
    title: `Secuencia de 3 emails activada`,
    description: `Emails programados: día 1, día 5 y día 10`,
  })

  return NextResponse.json({ data: sequence }, { status: 201 })
}

// PATCH — Pausar / cancelar secuencia
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { sequence_id, action } = await request.json() // action: 'pause' | 'cancel' | 'resume'
  if (!sequence_id || !action) return NextResponse.json({ error: 'sequence_id y action requeridos' }, { status: 400 })

  const statusMap: Record<string, string> = { pause: 'paused', cancel: 'cancelled', resume: 'active' }
  const newStatus = statusMap[action]
  if (!newStatus) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })

  const { data, error } = await supabase
    .from('sequences')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', sequence_id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
