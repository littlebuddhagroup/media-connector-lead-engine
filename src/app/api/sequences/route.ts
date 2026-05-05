import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateMessage, enrichLeadWithAI } from '@/services/aiService'
import { getUserAISettings } from '@/lib/getUserAIProvider'

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
  const campaignId = searchParams.get('campaign_id')

  let query = supabase
    .from('sequences')
    .select(`
      *,
      sequence_steps (*),
      lead:leads(id, first_name, last_name, company_name, email)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (leadId) {
    query = query.eq('lead_id', leadId)
  }

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  // Límite para evitar carga sin fin cuando no hay filtro específico
  if (!leadId && !campaignId) {
    query = query.limit(100)
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

  const { lead_id, campaign_id, custom_steps, from_email, language = 'es' } = await request.json()

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
      const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)
      let enrichment = Array.isArray(lead.enrichment) ? lead.enrichment[0] : lead.enrichment

      // Si el lead no tiene enrichment, enriquecerlo ahora para que los emails
      // tengan el mismo contexto y calidad que los generados desde la ficha del lead
      if (!enrichment) {
        try {
          enrichment = await enrichLeadWithAI(lead, undefined, aiProvider, aiModel)
          // Guardar el enrichment para uso futuro
          const adminSb = createAdminClient()
          await adminSb.from('lead_enrichments').upsert({
            lead_id,
            user_id: user.id,
            ...enrichment,
          }, { onConflict: 'lead_id' })
          await adminSb.from('leads').update({ is_enriched: true }).eq('id', lead_id)
        } catch {
          // Si falla el enriquecimiento, continuamos sin él (mejor un email que nada)
          enrichment = null
        }
      }

      const [email1, email2, email3] = await Promise.all([
        generateMessage(lead, enrichment, 'initial_email', 'consultivo', undefined, false, language, aiProvider, aiModel),
        generateMessage(lead, enrichment, 'followup_1', 'directo', undefined, false, language, aiProvider, aiModel),
        generateMessage(lead, enrichment, 'followup_2', 'cercano', undefined, false, language, aiProvider, aiModel),
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

  // Crear los pasos — las fechas vienen de custom_steps.scheduled_for o se calculan por defecto
  const baseDate = new Date()
  const stepsToInsert = steps.map(step => {
    // Si el cliente envía scheduled_for explícito (desde la UI de revisión) lo usamos directamente
    const explicitDate = (step as { scheduled_for?: string }).scheduled_for
    let scheduledFor: Date
    if (explicitDate) {
      scheduledFor = new Date(explicitDate)
    } else {
      scheduledFor = new Date(baseDate)
      scheduledFor.setDate(scheduledFor.getDate() + step.delay_days)
      scheduledFor.setHours(9, 0, 0, 0)
    }

    return {
      sequence_id: sequence.id,
      user_id: user.id,
      step_number: step.step_number,
      subject: step.subject,
      body: step.body,
      delay_days: step.delay_days,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
      from_email: from_email || null,
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
    description: `Emails programados para envío automático vía cron`,
  })

  return NextResponse.json({ data: sequence }, { status: 201 })
}

// DELETE — Borrar secuencia y sus pasos definitivamente
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { sequence_id } = await request.json()
  if (!sequence_id) return NextResponse.json({ error: 'sequence_id requerido' }, { status: 400 })

  // Verificar que la secuencia pertenece al usuario
  const { data: seq } = await supabase
    .from('sequences')
    .select('id, lead_id, campaign_id')
    .eq('id', sequence_id)
    .eq('user_id', user.id)
    .single()

  if (!seq) return NextResponse.json({ error: 'Secuencia no encontrada' }, { status: 404 })

  // Borrar pasos primero (FK constraint)
  await supabase.from('sequence_steps').delete().eq('sequence_id', sequence_id)
  // Borrar follow_ups relacionados si los hay
  await supabase.from('follow_ups').delete().eq('original_email_id', sequence_id)
  // Borrar la secuencia
  const { error } = await supabase.from('sequences').delete().eq('id', sequence_id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PATCH — Pausar / cancelar / reanudar / reiniciar secuencia
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { sequence_id, action, language = 'es' } = await request.json() // action: 'pause' | 'cancel' | 'resume' | 'restart'
  if (!sequence_id || !action) return NextResponse.json({ error: 'sequence_id y action requeridos' }, { status: 400 })

  // ─── Acción especial: restart ────────────────────────────────────────────────
  if (action === 'restart') {
    // 1. Obtener la secuencia actual
    const { data: seq } = await supabase
      .from('sequences')
      .select('id, lead_id, campaign_id, user_id')
      .eq('id', sequence_id)
      .eq('user_id', user.id)
      .single()

    if (!seq) return NextResponse.json({ error: 'Secuencia no encontrada' }, { status: 404 })

    // 2. Cancelar la secuencia actual y marcar sus pasos como skipped
    await supabase.from('sequences').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', sequence_id)

    await supabase.from('sequence_steps')
      .update({ status: 'skipped' })
      .eq('sequence_id', sequence_id)
      .eq('status', 'pending')

    // 3. Obtener datos del lead para regenerar emails con IA
    const { data: lead } = await supabase
      .from('leads')
      .select('*, enrichment:lead_enrichments(*)')
      .eq('id', seq.lead_id)
      .single()

    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

    // 4. Generar 3 nuevos emails con IA
    const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)
    let steps: Array<{ step_number: number; subject: string; body: string; delay_days: number }>
    try {
      let enrichment = Array.isArray(lead.enrichment) ? lead.enrichment[0] : lead.enrichment

      // Auto-enriquecer si no tiene datos de contexto
      if (!enrichment) {
        try {
          enrichment = await enrichLeadWithAI(lead, undefined, aiProvider, aiModel)
          const adminSb = createAdminClient()
          await adminSb.from('lead_enrichments').upsert({
            lead_id: seq.lead_id,
            user_id: user.id,
            ...enrichment,
          }, { onConflict: 'lead_id' })
          await adminSb.from('leads').update({ is_enriched: true }).eq('id', seq.lead_id)
        } catch {
          enrichment = null
        }
      }

      const [email1, email2, email3] = await Promise.all([
        generateMessage(lead, enrichment, 'initial_email', 'consultivo', undefined, false, language, aiProvider, aiModel),
        generateMessage(lead, enrichment, 'followup_1', 'directo', undefined, false, language, aiProvider, aiModel),
        generateMessage(lead, enrichment, 'followup_2', 'cercano', undefined, false, language, aiProvider, aiModel),
      ])
      steps = [
        { step_number: 1, subject: email1.subject ?? `Presentación MyMediaConnect para ${lead.company_name}`, body: email1.body, delay_days: 0 },
        { step_number: 2, subject: email2.subject ?? `Re: ¿Has tenido ocasión de revisar mi mensaje?`, body: email2.body, delay_days: 5 },
        { step_number: 3, subject: email3.subject ?? `Último intento — ¿Te interesa el tema?`, body: email3.body, delay_days: 10 },
      ]
    } catch (err) {
      return NextResponse.json({ error: 'Error regenerando mensajes con IA: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 })
    }

    // 5. Crear nueva secuencia
    const { data: newSeq, error: seqErr } = await supabase
      .from('sequences')
      .insert({
        user_id: user.id,
        lead_id: seq.lead_id,
        campaign_id: seq.campaign_id ?? null,
        name: `Secuencia 3 toques — ${lead.company_name}`,
        status: 'active',
        current_step: 0,
      })
      .select()
      .single()

    if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 })

    // 6. Insertar pasos con nuevas fechas
    const now = new Date()
    await supabase.from('sequence_steps').insert(
      steps.map(step => {
        const scheduledFor = new Date(now)
        scheduledFor.setDate(scheduledFor.getDate() + step.delay_days)
        scheduledFor.setHours(9, 0, 0, 0)
        return {
          sequence_id: newSeq.id,
          user_id: user.id,
          step_number: step.step_number,
          subject: step.subject,
          body: step.body,
          delay_days: step.delay_days,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending',
        }
      })
    )

    // 7. Registrar actividad
    await supabase.from('activity_logs').insert({
      lead_id: seq.lead_id,
      user_id: user.id,
      campaign_id: seq.campaign_id ?? null,
      type: 'email_sent',
      title: 'Secuencia de 3 emails reiniciada',
      description: 'Se regeneraron los 3 emails y se reprogramaron las fechas de envío',
    })

    return NextResponse.json({ data: newSeq })
  }

  // ─── Acción especial: mark_replied ──────────────────────────────────────────
  if (action === 'mark_replied') {
    const { data: seq } = await supabase
      .from('sequences')
      .select('id, lead_id, campaign_id')
      .eq('id', sequence_id)
      .eq('user_id', user.id)
      .single()

    if (!seq) return NextResponse.json({ error: 'Secuencia no encontrada' }, { status: 404 })

    // Cancelar secuencia y marcar pasos pendientes como skipped
    await supabase.from('sequences').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', sequence_id)

    await supabase.from('sequence_steps')
      .update({ status: 'skipped', replied_at: new Date().toISOString() })
      .eq('sequence_id', sequence_id)
      .eq('status', 'pending')

    // Actualizar estado del lead a replied
    await supabase.from('leads')
      .update({ status: 'replied', updated_at: new Date().toISOString() })
      .eq('id', seq.lead_id)
      .eq('user_id', user.id)

    // Log de actividad
    await supabase.from('activity_logs').insert({
      lead_id: seq.lead_id,
      user_id: user.id,
      campaign_id: seq.campaign_id ?? null,
      type: 'sequence_replied',
      title: 'Lead marcado como respondido',
      description: 'Respuesta registrada manualmente — emails pendientes cancelados',
      metadata: { sequence_id, marked_manually: true },
    })

    return NextResponse.json({ data: { ok: true, lead_id: seq.lead_id } })
  }

  // ─── Acciones simples: pause / cancel / resume ───────────────────────────────
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
