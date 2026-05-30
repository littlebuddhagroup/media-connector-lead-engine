// ============================================================
// LUSHA SEARCH — Buscar prospectos nuevos e importarlos como leads
// POST /api/lusha/search
//
// Body: {
//   jobTitles?: string[]       — cargos a buscar
//   industries?: string[]      — sectores
//   countries?: string[]       — países
//   companySizes?: string[]    — tamaños de empresa
//   companyNames?: string[]    — nombres de empresa exactos
//   companyDomains?: string[]  — dominios de email (ej. coca-cola.com)
//   keywords?: string[]
//   limit?: number             — máx resultados (default 25)
//   campaign_id?: string       — asignar a campaña al importar
//   import?: boolean           — si true, guarda los resultados como leads
// }
// ============================================================

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { LushaClient } from '@/services/lushaService'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Verificar API key
  const { data: integration } = await supabase
    .from('api_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('provider', 'lusha')
    .single()

  if (!integration?.api_key) {
    return NextResponse.json({ error: 'Lusha no está conectado.' }, { status: 400 })
  }

  const body = await request.json()
  const {
    jobTitles,
    industries,
    countries,
    companySizes,
    companyNames,
    companyDomains,
    keywords,
    limit = 25,
    campaign_id,
    import: doImport = false,
  } = body

  // Validar que hay al menos un filtro real (Lusha requiere al menos uno)
  const hasFilters = [jobTitles, industries, countries, companySizes, companyNames, companyDomains, keywords]
    .some(f => Array.isArray(f) ? f.length > 0 : !!f)

  if (!hasFilters) {
    return NextResponse.json(
      { error: 'Indica al menos un filtro: empresa, dominio, cargo, sector o país.' },
      { status: 400 }
    )
  }

  // ── Importación directa de prospectos sin re-buscar ──────────────
  if (body.direct_prospects && doImport) {
    const directProspects = body.direct_prospects as Array<{
      firstName?: string; lastName?: string; email?: string; phone?: string
      linkedin?: string; jobTitle?: string; company?: string; companyDomain?: string
      city?: string; country?: string; sector?: string
    }>
    const admin = createAdminClient()
    const { data: existingLeads } = await supabase.from('leads').select('email, company_name').eq('user_id', user.id)
    const existingEmails = new Set((existingLeads ?? []).map(l => l.email?.toLowerCase()).filter(Boolean))

    const toInsert = directProspects.filter(p => !p.email || !existingEmails.has(p.email.toLowerCase()))
    let imported = 0
    const insertedIds: string[] = []

    if (toInsert.length > 0) {
      const { data: inserted } = await admin.from('leads').insert(
        toInsert.map(p => ({
          user_id: user.id,
          campaign_id: campaign_id ?? null,
          company_name: p.company || companyNames?.[0] || 'Empresa desconocida',
          first_name: p.firstName || null,
          last_name: p.lastName || null,
          email: p.email || null,
          phone: p.phone || null,
          linkedin_url: p.linkedin || null,
          job_title: p.jobTitle || null,
          website: p.companyDomain ? `https://${p.companyDomain}` : null,
          sector: p.sector || industries?.[0] || null,
          country: p.country || countries?.[0] || null,
          status: 'new', priority: 'medium', source: 'lusha',
          is_enriched: !!(p.email || p.phone),
        }))
      ).select('id')
      imported = inserted?.length ?? 0
      insertedIds.push(...(inserted ?? []).map((r: { id: string }) => r.id))
    }

    return NextResponse.json({ ok: true, imported, duplicates: directProspects.length - toInsert.length, lead_ids: insertedIds })
  }

  const client = new LushaClient(integration.api_key)

  // Buscar en Lusha
  let prospects: Awaited<ReturnType<typeof client.searchProspects>>
  try {
    prospects = await client.searchProspects({
      jobTitles,
      industries,
      countries,
      companySizes,
      companyNames,
      companyDomains,
      keywords,
      limit,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[lusha/search] searchProspects error:', msg)
    return NextResponse.json(
      { error: `Error al buscar en Lusha: ${msg}` },
      { status: 502 }
    )
  }

  if (!prospects.length) {
    return NextResponse.json({ ok: true, found: 0, imported: 0, prospects: [], message: 'No se encontraron prospectos con esos filtros.' })
  }

  // Si no piden importar, devolver preview
  if (!doImport) {
    return NextResponse.json({ ok: true, found: prospects.length, imported: 0, prospects })
  }

  // Importar como leads — deduplicar por email
  const admin = createAdminClient()

  const { data: existingLeads } = await supabase
    .from('leads')
    .select('email, company_name')
    .eq('user_id', user.id)

  const existingEmails = new Set((existingLeads ?? []).map(l => l.email?.toLowerCase()).filter(Boolean))
  const existingCompanies = new Set((existingLeads ?? []).map(l => l.company_name?.toLowerCase()).filter(Boolean))

  let duplicates = 0
  const toInsert = prospects.filter(p => {
    const emailDup = p.email && existingEmails.has(p.email.toLowerCase())
    const companyDup = !p.email && p.company && existingCompanies.has(p.company.toLowerCase())
    if (emailDup || companyDup) { duplicates++; return false }
    return true
  })

  let imported = 0
  if (toInsert.length > 0) {
    const { data: inserted } = await admin
      .from('leads')
      .insert(
        toInsert.map(p => ({
          user_id: user.id,
          campaign_id: campaign_id ?? null,
          // Si Lusha devuelve contacto parcial sin empresa, usamos el filtro de búsqueda
          company_name: p.company || companyNames?.[0] || 'Empresa desconocida',
          first_name: p.firstName || null,
          last_name: p.lastName || null,
          email: p.email || null,
          phone: p.phone || null,
          linkedin_url: p.linkedin || null,
          job_title: p.jobTitle || null,
          website: p.companyDomain ? `https://${p.companyDomain}` : (companyDomains?.[0] ? `https://${companyDomains[0]}` : null),
          sector: p.sector || industries?.[0] || null,
          country: p.country || countries?.[0] || null,
          status: 'new',
          priority: 'medium',
          source: 'lusha',
          is_enriched: !!(p.email || p.phone),
        }))
      )
      .select('id')

    imported = inserted?.length ?? 0
  }

  // Registrar actividad
  if (imported > 0) {
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      campaign_id: campaign_id ?? null,
      type: 'import',
      title: `Importados ${imported} prospectos desde Lusha`,
      description: `${duplicates} duplicados omitidos. Filtros: ${[...(companyNames ?? []), ...(companyDomains ?? []), ...(jobTitles ?? []), ...(industries ?? [])].join(', ') || 'ninguno'}`,
      metadata: { source: 'lusha', found: prospects.length, imported, duplicates },
    })
  }

  return NextResponse.json({
    ok: true,
    found: prospects.length,
    imported,
    duplicates,
    prospects: toInsert,
    message: `${imported} prospectos importados como leads. ${duplicates} ya existían.`,
  })
}
