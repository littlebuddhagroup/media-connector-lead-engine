// ============================================================
// PIPEDRIVE IMPORT — Importar deals/persons/orgs como leads
// POST /api/pipedrive/import
//
// Body: {
//   source: 'deals' | 'persons' | 'organizations'
//   campaign_id?: string     — asignar a una campaña
//   status?: string          — filtro de estado en Pipedrive (deals)
//   pipeline_id?: number     — filtro de pipeline (deals)
//   max_results?: number     — máximo de registros (default 200)
//   enrich?: boolean         — enriquecer con IA tras importar (default false)
// }
// ============================================================

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { importFromPipedrive } from '@/services/pipedriveService'
import { enrichLead } from '@/services/enrichmentService'
import { runConcurrently } from '@/lib/concurrency'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Verificar API key
  const { data: integration } = await supabase
    .from('api_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('provider', 'pipedrive')
    .single()

  if (!integration?.api_key) {
    return NextResponse.json({ error: 'Pipedrive no está conectado. Añade tu API token en Configuración → Pipedrive.' }, { status: 400 })
  }

  const body = await request.json()
  const {
    source = 'deals',
    campaign_id,
    status = 'open',
    pipeline_id,
    max_results = 200,
    enrich = false,   // nuevo: enriquecer con IA (Lusha + Hunter + SerpAPI + IA)
  } = body

  if (!['deals', 'persons', 'organizations'].includes(source)) {
    return NextResponse.json({ error: 'source debe ser deals, persons u organizations' }, { status: 400 })
  }

  // Importar desde Pipedrive
  const importResult = await importFromPipedrive(integration.api_key, {
    source,
    status,
    pipeline_id,
    max_results,
  })

  if (importResult.leads.length === 0) {
    return NextResponse.json({
      ok: true,
      imported: 0,
      skipped: importResult.skipped,
      errors: importResult.errors,
      enriched: 0,
      message: 'No se encontraron registros para importar con los filtros actuales.',
    })
  }

  // Guardar leads en Supabase — deduplicar por email o company_name
  const admin = createAdminClient()
  let savedCount = 0
  let duplicateCount = 0
  const insertedIds: string[] = []

  const { data: existingLeads } = await supabase
    .from('leads')
    .select('email, company_name')
    .eq('user_id', user.id)

  const existingEmails = new Set((existingLeads ?? []).map(l => l.email?.toLowerCase()).filter(Boolean))
  const existingCompanies = new Set((existingLeads ?? []).map(l => l.company_name?.toLowerCase()).filter(Boolean))

  const leadsToInsert = importResult.leads.filter(lead => {
    const emailExists = lead.email && existingEmails.has(lead.email.toLowerCase())
    const companyExists = !lead.email && lead.company_name && existingCompanies.has(lead.company_name.toLowerCase())
    if (emailExists || companyExists) {
      duplicateCount++
      return false
    }
    return true
  })

  if (leadsToInsert.length > 0) {
    const { data: inserted, error } = await admin
      .from('leads')
      .insert(
        leadsToInsert.map(lead => ({
          user_id: user.id,
          campaign_id: campaign_id ?? null,
          company_name: lead.company_name,
          first_name: lead.first_name || null,
          last_name: lead.last_name || null,
          email: lead.email || null,
          phone: lead.phone || null,
          website: lead.website || null,
          sector: lead.sector || null,
          country: lead.country || null,
          description: lead.description || null,
          linkedin_url: lead.linkedin_url || null,
          status: 'new',
          priority: 'medium',
          source: 'pipedrive',
          ...(lead.pipedrive_deal_id ? { pipedrive_deal_id: lead.pipedrive_deal_id } : {}),
          ...(lead.pipedrive_person_id ? { pipedrive_person_id: lead.pipedrive_person_id } : {}),
          ...(lead.pipedrive_org_id ? { pipedrive_org_id: lead.pipedrive_org_id } : {}),
        }))
      )
      .select('id')

    if (!error && inserted) {
      savedCount = inserted.length
      insertedIds.push(...inserted.map((r: { id: string }) => r.id))
    }
  }

  // Registrar actividad de importación
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    campaign_id: campaign_id ?? null,
    type: 'import',
    title: `Importados ${savedCount} leads desde Pipedrive`,
    description: `Fuente: ${source}. ${duplicateCount} duplicados omitidos. ${importResult.errors} errores.${enrich ? ' Enriquecimiento IA en curso...' : ''}`,
    metadata: { source: 'pipedrive', import_source: source, total: importResult.imported, saved: savedCount, duplicates: duplicateCount },
  })

  // ─────────────────────────────────────────────────────────
  // ENRIQUECIMIENTO AUTOMÁTICO POST-IMPORTACIÓN
  // Lusha → Hunter → SerpAPI → IA — máx. 5 concurrentes
  // ─────────────────────────────────────────────────────────
  let enrichedCount = 0
  let enrichErrors = 0

  if (enrich && insertedIds.length > 0) {
    // Limitamos a 20 por ejecución para no saturar los créditos de Lusha/Hunter
    const idsToEnrich = insertedIds.slice(0, 20)

    const enrichResults = await runConcurrently<string, { success: boolean }>(
      idsToEnrich,
      async (leadId) => {
        try {
          await enrichLead(leadId, user.id)
          return { success: true }
        } catch (e) {
          console.error(`Error enriching Pipedrive lead ${leadId}:`, e)
          return { success: false }
        }
      },
      5  // máx 5 en paralelo
    )

    enrichedCount = enrichResults.filter(r => r.success).length
    enrichErrors = enrichResults.filter(r => !r.success).length

    // Registrar actividad de enriquecimiento
    if (enrichedCount > 0) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        campaign_id: campaign_id ?? null,
        type: 'enriched',
        title: `Enriquecidos ${enrichedCount} leads importados de Pipedrive`,
        description: `Lusha + Hunter + IA. ${enrichErrors} errores.`,
        metadata: { source: 'pipedrive', enriched: enrichedCount, errors: enrichErrors },
      })
    }
  }

  return NextResponse.json({
    ok: true,
    imported: savedCount,
    skipped: duplicateCount + importResult.skipped,
    errors: importResult.errors,
    total_from_pipedrive: importResult.imported,
    enriched: enrichedCount,
    enrich_errors: enrichErrors,
    message: `${savedCount} leads importados desde Pipedrive.${enrichedCount > 0 ? ` ${enrichedCount} enriquecidos automáticamente.` : ''} ${duplicateCount} ya existían.`,
  })
}
