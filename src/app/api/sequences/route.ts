import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateMessage, enrichLeadWithAI } from '@/services/aiService'
import { getUserAISettings } from '@/lib/getUserAIProvider'

// ─── Asuntos de fallback por idioma (3 toques) ───────────────────────────────
function getDefaultSubjects(language: string, companyName: string): string[] {
  const subjects: Record<string, string[]> = {
    es: [
      `Presentación MyMediaConnect para ${companyName}`,
      '¿Has tenido ocasión de revisar mi mensaje?',
      `Último intento — ¿Te interesa el tema?`,
      `Una idea concreta para ${companyName}`,
      `Cerramos el hilo — ¿te interesa o lo dejamos aquí?`,
    ],
    en: [
      `MyMediaConnect introduction for ${companyName}`,
      'Have you had a chance to look at my message?',
      `Last attempt — interested in the topic?`,
      `A specific idea for ${companyName}`,
      `Closing the loop — shall we connect or leave it here?`,
    ],
    fr: [
      `Présentation MyMediaConnect pour ${companyName}`,
      'Avez-vous eu l\'occasion de lire mon message ?',
      `Dernière tentative — le sujet vous intéresse ?`,
      `Une idée concrète pour ${companyName}`,
      `On referme le sujet — intéressé ou on s'arrête là ?`,
    ],
    de: [
      `MyMediaConnect Präsentation für ${companyName}`,
      'Hatten Sie Gelegenheit, meine Nachricht zu lesen?',
      `Letzter Versuch — interessiert Sie das Thema?`,
      `Eine konkrete Idee für ${companyName}`,
      `Abschlussfrage — interessiert oder soll ich aufhören?`,
    ],
    it: [
      `Presentazione MyMediaConnect per ${companyName}`,
      'Ha avuto modo di leggere il mio messaggio?',
      `Ultimo tentativo — l'argomento ti interessa?`,
      `Un'idea concreta per ${companyName}`,
      `Chiudiamo il cerchio — sei interessato o ci fermiamo qui?`,
    ],
    pt: [
      `Apresentação MyMediaConnect para ${companyName}`,
      'Teve oportunidade de ver a minha mensagem?',
      `Última tentativa — tem interesse no assunto?`,
      `Uma ideia concreta para ${companyName}`,
      `Fechando o assunto — tem interesse ou paramos por aqui?`,
    ],
    nl: [
      `MyMediaConnect introductie voor ${companyName}`,
      'Heeft u de kans gehad mijn bericht te lezen?',
      `Laatste poging — bent u geïnteresseerd in het onderwerp?`,
      `Een concreet idee voor ${companyName}`,
      `Afsluiting — geïnteresseerd of stoppen we hier?`,
    ],
    ca: [
      `Presentació MyMediaConnect per ${companyName}`,
      'Has tingut ocasió de llegir el meu missatge?',
      `Últim intent — t'interessa el tema?`,
      `Una idea concreta per a ${companyName}`,
      `Tanquem el fil — t'interessa o ho deixem aquí?`,
    ],
  }
  return subjects[language] ?? subjects['es']
}

// Delays en días para cada step (3 o 5 toques)
const STEP_DELAYS: Record<number, number[]> = {
  3: [0, 5, 10],
  5: [0, 4, 8, 13, 18],
}

// Tonos por step (3 o 5 toques)
const STEP_TONES: Record<number, string[]> = {
  3: ['consultivo', 'directo', 'cercano'],
  5: ['consultivo', 'directo', 'cercano', 'formal', 'directo'],
}

// Tipos de mensaje por step (3 o 5 toques)
const STEP_TYPES: Record<number, string[]> = {
  3: ['initial_email', 'followup_1', 'followup_2'],
  5: ['initial_email', 'followup_1', 'followup_2', 'followup_1', 'followup_2'],
}

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

  const { lead_id, campaign_id, custom_steps, from_email, language = 'es', total_steps = 3 } = await request.json()

  if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 })

  // Normalizar total_steps: solo se permiten 3 o 5
  const numSteps: 3 | 5 = total_steps === 5 ? 5 : 3

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

  // Generar emails con IA (o usar custom_steps si se pasan)
  let steps: Array<{ step_number: number; subject: string; body: string; delay_days: number }>

  if (custom_steps?.length >= numSteps) {
    steps = custom_steps
  } else {
    try {
      const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)
      let enrichment = Array.isArray(lead.enrichment) ? lead.enrichment[0] : lead.enrichment

      // Auto-enriquecer si el lead no tiene datos de contexto
      if (!enrichment) {
        try {
          enrichment = await enrichLeadWithAI(lead, undefined, aiProvider, aiModel)
          const adminSb = createAdminClient()
          await adminSb.from('lead_enrichments').upsert({
            lead_id,
            user_id: user.id,
            ...enrichment,
          }, { onConflict: 'lead_id' })
          await adminSb.from('leads').update({ is_enriched: true }).eq('id', lead_id)
        } catch {
          enrichment = null
        }
      }

      const delays = STEP_DELAYS[numSteps]
      const tones = STEP_TONES[numSteps]
      const types = STEP_TYPES[numSteps]

      // Generar todos los emails en paralelo
      const emails = await Promise.all(
        Array.from({ length: numSteps }, (_, i) =>
          generateMessage(lead, enrichment, types[i] as Parameters<typeof generateMessage>[2], tones[i] as Parameters<typeof generateMessage>[3], undefined, false, language, aiProvider, aiModel)
        )
      )

      const fallback = getDefaultSubjects(language, lead.company_name)
      steps = emails.map((email, i) => ({
        step_number: i + 1,
        subject: email.subject ?? fallback[i] ?? `Follow-up ${i + 1} — ${lead.company_name}`,
        body: email.body,
        delay_days: delays[i],
      }))
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
      name: `Secuencia ${numSteps} toques — ${lead.company_name}`,
      status: 'active',
      current_step: 0,
      total_steps: numSteps,
    })
    .select()
    .single()

  if (seqError) return NextResponse.json({ error: seqError.message }, { status: 500 })

  // Crear los pasos — las fechas vienen de custom_steps.scheduled_for o se calculan por defecto
  const baseDate = new Date()
  const stepsToInsert = steps.map(step => {
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
    title: `Secuencia de ${numSteps} emails activada`,
    description: `${numSteps} emails programados para envío automático vía cron`,
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

  const { sequence_id, action, language = 'es', total_steps } = await request.json() // action: 'pause' | 'cancel' | 'resume' | 'restart'
  if (!sequence_id || !action) return NextResponse.json({ error: 'sequence_id y action requeridos' }, { status: 400 })

  // ─── Acción especial: restart ────────────────────────────────────────────────
  if (action === 'restart') {
    // 1. Obtener la secuencia actual
    const { data: seq } = await supabase
      .from('sequences')
      .select('id, lead_id, campaign_id, user_id, total_steps')
      .eq('id', sequence_id)
      .eq('user_id', user.id)
      .single()

    if (!seq) return NextResponse.json({ error: 'Secuencia no encontrada' }, { status: 404 })

    // Respetar el total_steps original o el nuevo si se pasa explícitamente
    const numSteps: 3 | 5 = (total_steps === 5 || seq.total_steps === 5) ? 5 : 3

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

    // 4. Generar emails con IA
    const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)
    let steps: Array<{ step_number: number; subject: string; body: string; delay_days: number }>
    try {
      let enrichment = Array.isArray(lead.enrichment) ? lead.enrichment[0] : lead.enrichment

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

      const delays = STEP_DELAYS[numSteps]
      const tones = STEP_TONES[numSteps]
      const types = STEP_TYPES[numSteps]

      const emails = await Promise.all(
        Array.from({ length: numSteps }, (_, i) =>
          generateMessage(lead, enrichment, types[i] as Parameters<typeof generateMessage>[2], tones[i] as Parameters<typeof generateMessage>[3], undefined, false, language, aiProvider, aiModel)
        )
      )

      const fallback = getDefaultSubjects(language, lead.company_name)
      steps = emails.map((email, i) => ({
        step_number: i + 1,
        subject: email.subject ?? fallback[i] ?? `Follow-up ${i + 1} — ${lead.company_name}`,
        body: email.body,
        delay_days: delays[i],
      }))
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
        name: `Secuencia ${numSteps} toques — ${lead.company_name}`,
        status: 'active',
        current_step: 0,
        total_steps: numSteps,
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
      title: `Secuencia de ${numSteps} emails reiniciada`,
      description: `Se regeneraron los ${numSteps} emails y se reprogramaron las fechas de envío`,
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
