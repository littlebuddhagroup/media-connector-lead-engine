import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateMessage, enrichLeadWithAI } from '@/services/aiService'
import { getUserAISettings } from '@/lib/getUserAIProvider'
import { runConcurrently } from '@/lib/concurrency'

// ============================================================
// CAMPAIGN — Lanzar secuencias en bloque con rotación de cuentas
// POST /api/campaigns/[id]/launch-sequences
// body: { lead_ids?: string[], accounts?: string[] }
//
// Optimizado para miles de leads:
//   - Template path: 3 bulk DB inserts (sequences + steps + logs)
//   - AI path: runConcurrently(concurrency=3) + 3 bulk DB inserts
//   - Sin setTimeout delays
// ============================================================

const DEFAULT_ACCOUNTS = [
  'guillaume@mymediaconnect.com',
  'guillaume@gomymediaconnect.com',
  'guillaume@mymediaconnectgo.com',
  'guillaume@mymediaconnect.es',
]

interface TemplateStep {
  step_number: number
  subject: string
  body: string
  delay_days: number
  tone: string
  scheduled_date?: string  // YYYY-MM-DD — fecha fija definida en el editor
  scheduled_time?: string  // HH:MM
}

interface StepData {
  step_number: number
  subject: string
  body: string
  delay_days: number
}

interface LeadProcessResult {
  lead: {
    id: string
    company_name: string
    email: string
    sector?: string | null
    country?: string | null
    description?: string | null
    website?: string | null
    first_name?: string | null
    last_name?: string | null
    department?: string | null
    campaign_id?: string | null
  }
  fromEmail: string
  steps: StepData[]
  error?: string
}

// Reemplaza variables de plantilla con datos reales del lead
// {{contact_name}} → solo nombre de pila (nunca apellido)
function applyTemplateVariables(text: string, lead: { company_name: string; sector?: string | null; first_name?: string | null; last_name?: string | null }): string {
  const firstName = lead.first_name?.trim() || lead.company_name
  return text
    .replace(/\{\{company_name\}\}/g, lead.company_name)
    .replace(/\{\{contact_name\}\}/g, firstName)
    .replace(/\{\{sector\}\}/g, lead.sector ?? 'vuestra empresa')
}

// Calcula la fecha de envío para un paso dado
function computeScheduledFor(step: StepData, stepIdx: number, templateSteps: TemplateStep[] | null, now: Date): Date {
  const tmplStep = templateSteps?.[stepIdx]
  if (tmplStep?.scheduled_date) {
    const [h, m] = (tmplStep.scheduled_time ?? '09:00').split(':').map(Number)
    const d = new Date(`${tmplStep.scheduled_date}T00:00:00`)
    d.setHours(h, m, 0, 0)
    return d
  }
  const d = new Date(now)
  d.setDate(d.getDate() + step.delay_days)
  d.setHours(9, 0, 0, 0)
  return d
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const campaignId = params.id
  const body = await request.json().catch(() => ({}))
  const accounts: string[] = body.accounts ?? DEFAULT_ACCOUNTS
  const filterLeadIds: string[] | undefined = body.lead_ids
  const language: string = body.language ?? 'es'
  const totalSteps: 3 | 5 = body.total_steps === 5 ? 5 : 3

  if (!accounts.length) {
    return NextResponse.json({ error: 'Debes indicar al menos una cuenta de envío' }, { status: 400 })
  }

  // Verificar que la campaña pertenece al usuario
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  // ── Buscar plantilla guardada para esta campaña ──
  const { data: savedTemplates } = await admin
    .from('sequence_templates')
    .select('id, steps')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)

  const savedTemplate = savedTemplates?.[0] ?? null
  const templateSteps: TemplateStep[] | null =
    savedTemplate?.steps && Array.isArray(savedTemplate.steps) && savedTemplate.steps.length === totalSteps
      ? (savedTemplate.steps as TemplateStep[])
      : null

  // Obtener leads de la campaña — fuente 1: campaign_id directo en leads
  const { data: directLeads } = await admin
    .from('leads')
    .select('id, company_name, email, sector, country, description, website, first_name, last_name, department, campaign_id')
    .eq('campaign_id', campaignId)
    .in('user_id', [user.id])
    .not('email', 'is', null)

  // Fuente 2: leads añadidos via junction campaign_leads
  const { data: junctionRows } = await admin
    .from('campaign_leads')
    .select('lead_id')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)

  const junctionLeadIds = (junctionRows ?? []).map((r: { lead_id: string }) => r.lead_id)

  let junctionLeads: typeof directLeads = []
  if (junctionLeadIds.length > 0) {
    const { data } = await admin
      .from('leads')
      .select('id, company_name, email, sector, country, description, website, first_name, last_name, department, campaign_id')
      .in('id', junctionLeadIds)
      .not('email', 'is', null)
    junctionLeads = data ?? []
  }

  // Merge y deduplicar por id
  const seenIds = new Set<string>()
  const mergedLeads = [...(directLeads ?? []), ...junctionLeads].filter(l => {
    if (seenIds.has(l.id)) return false
    seenIds.add(l.id)
    return true
  })

  let allLeads = mergedLeads

  if (filterLeadIds?.length) {
    allLeads = allLeads.filter(l => filterLeadIds.includes(l.id))
  }

  if (!allLeads.length) {
    return NextResponse.json({ error: 'No hay leads con email en esta campaña' }, { status: 400 })
  }

  // Filtrar leads que ya tienen secuencia activa
  const { data: existingSeqs } = await supabase
    .from('sequences')
    .select('lead_id')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])

  const alreadyHasSeq = new Set((existingSeqs ?? []).map((s: { lead_id: string }) => s.lead_id))
  const leads = allLeads.filter(l => !alreadyHasSeq.has(l.id))

  if (!leads.length) {
    return NextResponse.json({
      message: 'Todos los leads ya tienen una secuencia activa',
      launched: 0,
      skipped: allLeads.length,
    })
  }

  const usingTemplate = !!templateSteps
  const now = new Date()
  let launched = 0
  let errors = 0
  const results: Array<{ lead_id: string; account: string; status: 'ok' | 'error'; message?: string }> = []

  // ══════════════════════════════════════════════════════════════
  // RUTA A: PLANTILLA GUARDADA — 3 bulk inserts para todos los leads
  // ══════════════════════════════════════════════════════════════
  if (templateSteps) {
    // 1. Calcular step data para cada lead (síncrono, muy rápido)
    const leadData = leads.map((lead, i) => ({
      lead,
      fromEmail: accounts[i % accounts.length],
      steps: templateSteps.map(tmpl => ({
        step_number: tmpl.step_number,
        subject: applyTemplateVariables(tmpl.subject, lead),
        body: applyTemplateVariables(tmpl.body, lead),
        delay_days: tmpl.delay_days,
      })),
    }))

    // 2. Bulk insert de todas las secuencias en una sola query
    const { data: sequences, error: seqError } = await supabase
      .from('sequences')
      .insert(leadData.map(({ lead }) => ({
        user_id: user.id,
        campaign_id: campaignId,
        lead_id: lead.id,
        name: `Secuencia ${totalSteps} toques — ${lead.company_name}`,
        status: 'active',
        current_step: 0,
        total_steps: totalSteps,
      })))
      .select('id, lead_id')

    if (seqError || !sequences?.length) {
      return NextResponse.json({ error: seqError?.message ?? 'Error creando secuencias' }, { status: 500 })
    }

    // Mapa lead_id → sequence_id
    const seqByLeadId = new Map(sequences.map(s => [s.lead_id, s.id]))

    // 3. Bulk insert de todos los pasos en una sola query
    const allSteps = leadData.flatMap(({ lead, fromEmail, steps }) => {
      const seqId = seqByLeadId.get(lead.id)
      if (!seqId) return []
      return steps.map((step, stepIdx) => ({
        sequence_id: seqId,
        user_id: user.id,
        step_number: step.step_number,
        subject: step.subject,
        body: step.body,
        delay_days: step.delay_days,
        scheduled_for: computeScheduledFor(step, stepIdx, templateSteps, now).toISOString(),
        status: 'pending',
        from_email: fromEmail,
      }))
    })

    await supabase.from('sequence_steps').insert(allSteps)

    // 4. Bulk insert de todos los activity logs en una sola query
    await supabase.from('activity_logs').insert(
      leadData
        .filter(({ lead }) => seqByLeadId.has(lead.id))
        .map(({ lead, fromEmail }) => ({
          lead_id: lead.id,
          user_id: user.id,
          campaign_id: campaignId,
          type: 'email_sent',
          title: 'Secuencia de 3 emails activada',
          description: `Cuenta de envío: ${fromEmail}. Usando plantilla guardada.`,
        }))
    )

    launched = sequences.length
    sequences.forEach(s => {
      const ld = leadData.find(d => d.lead.id === s.lead_id)
      results.push({ lead_id: s.lead_id, account: ld?.fromEmail ?? '', status: 'ok' })
    })

  } else {
    // ══════════════════════════════════════════════════════════════
    // RUTA B: GENERACIÓN CON IA — concurrencia controlada + bulk inserts
    // ══════════════════════════════════════════════════════════════

    // Precargar enriquecimientos existentes
    const leadIds = leads.map(l => l.id)
    const enrichMap = new Map()
    const { data: enrichments } = await supabase
      .from('lead_enrichments')
      .select('*')
      .in('lead_id', leadIds)
      .eq('user_id', user.id)
    ;(enrichments ?? []).forEach((e: { lead_id: string }) => enrichMap.set(e.lead_id, e))

    const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)

    // Fase 1: Generar contenido en paralelo (concurrency=3 para respetar rate limits de IA)
    const leadResults: LeadProcessResult[] = await runConcurrently(
      leads,
      async (lead, i) => {
        const fromEmail = accounts[i % accounts.length]
        try {
          // Auto-enriquecer si no hay datos
          let enrichmentData = enrichMap.get(lead.id) ?? null
          if (!enrichmentData) {
            try {
              enrichmentData = await enrichLeadWithAI(lead as never, undefined, aiProvider, aiModel)
              await admin.from('lead_enrichments').upsert({
                lead_id: lead.id,
                user_id: user.id,
                ...enrichmentData,
              }, { onConflict: 'lead_id' })
              await admin.from('leads').update({ is_enriched: true }).eq('id', lead.id)
            } catch {
              enrichmentData = null
            }
          }

          // Delays y tipos según totalSteps
          const stepDelays = totalSteps === 5 ? [0, 4, 8, 13, 18] : [0, 5, 10]
          const stepTones = totalSteps === 5
            ? ['consultivo', 'directo', 'cercano', 'formal', 'directo']
            : ['consultivo', 'directo', 'cercano']
          const stepTypes = totalSteps === 5
            ? ['initial_email', 'followup_1', 'followup_2', 'followup_1', 'followup_2']
            : ['initial_email', 'followup_1', 'followup_2']

          // Generar los emails en paralelo para este lead
          const emails = await Promise.all(
            Array.from({ length: totalSteps }, (_, idx) =>
              generateMessage(lead as never, enrichmentData, stepTypes[idx] as Parameters<typeof generateMessage>[2], stepTones[idx] as Parameters<typeof generateMessage>[3], undefined, false, language, aiProvider, aiModel)
            )
          )

          return {
            lead,
            fromEmail,
            steps: emails.map((email, idx) => ({
              step_number: idx + 1,
              subject: email.subject ?? `Email ${idx + 1} — ${lead.company_name}`,
              body: email.body,
              delay_days: stepDelays[idx],
            })),
          }
        } catch (err) {
          return {
            lead,
            fromEmail,
            steps: [],
            error: err instanceof Error ? err.message : 'Error desconocido',
          }
        }
      },
      3 // 3 leads × 3 emails = máx 9 llamadas IA simultáneas
    )

    // Separar éxitos de errores
    const successful = leadResults.filter(r => !r.error)
    const failed = leadResults.filter(r => r.error)
    errors = failed.length

    failed.forEach(r => results.push({ lead_id: r.lead.id, account: r.fromEmail, status: 'error', message: r.error }))

    // Fase 2: Bulk inserts para los leads generados con éxito
    if (successful.length > 0) {
      const { data: sequences, error: seqError } = await supabase
        .from('sequences')
        .insert(successful.map(({ lead }) => ({
          user_id: user.id,
          campaign_id: campaignId,
          lead_id: lead.id,
          name: `Secuencia ${totalSteps} toques — ${lead.company_name}`,
          status: 'active',
          current_step: 0,
          total_steps: totalSteps,
        })))
        .select('id, lead_id')

      if (seqError || !sequences) {
        return NextResponse.json({ error: seqError?.message ?? 'Error creando secuencias' }, { status: 500 })
      }

      const seqByLeadId = new Map(sequences.map(s => [s.lead_id, s.id]))

      // Bulk insert pasos
      const allSteps = successful.flatMap(({ lead, fromEmail, steps }) => {
        const seqId = seqByLeadId.get(lead.id)
        if (!seqId) return []
        return steps.map((step, stepIdx) => ({
          sequence_id: seqId,
          user_id: user.id,
          step_number: step.step_number,
          subject: step.subject,
          body: step.body,
          delay_days: step.delay_days,
          scheduled_for: computeScheduledFor(step, stepIdx, null, now).toISOString(),
          status: 'pending',
          from_email: fromEmail,
        }))
      })

      await supabase.from('sequence_steps').insert(allSteps)

      // Bulk insert activity logs
      await supabase.from('activity_logs').insert(
        successful
          .filter(({ lead }) => seqByLeadId.has(lead.id))
          .map(({ lead, fromEmail }) => ({
            lead_id: lead.id,
            user_id: user.id,
            campaign_id: campaignId,
            type: 'email_sent',
            title: 'Secuencia de 3 emails activada',
            description: `Cuenta de envío: ${fromEmail}. Generado con IA.`,
          }))
      )

      launched = sequences.length
      sequences.forEach(s => {
        const r = successful.find(x => x.lead.id === s.lead_id)
        results.push({ lead_id: s.lead_id, account: r?.fromEmail ?? '', status: 'ok' })
      })
    }
  }

  return NextResponse.json({
    message: `Secuencias lanzadas para ${launched} leads`,
    launched,
    errors,
    skipped: allLeads.length - leads.length,
    using_template: usingTemplate,
    account_distribution: accounts.map((acc, i) => ({
      account: acc,
      count: leads.filter((_, j) => j % accounts.length === i).length,
    })),
    results,
  })
}
