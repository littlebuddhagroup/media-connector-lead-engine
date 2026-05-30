// ============================================================
// LUSHA ENRICH — Enriquecer uno o varios leads
// POST /api/lusha/enrich
//
// Body:
//   { lead_id: string }                        → enriquecer 1 lead
//   { lead_ids: string[] }                     → enriquecer lista (bulk)
//   { campaign_id: string }                    → enriquecer todos los leads de una campaña
//   { all: true }                              → enriquecer todos los leads del usuario
//
// Rellena: email, phone, linkedin_url, job_title — sólo campos vacíos (no sobreescribe)
// Devuelve: { enriched, skipped, not_found, errors }
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
    return NextResponse.json({ error: 'Lusha no está conectado. Añade tu API key en Configuración → Lusha.' }, { status: 400 })
  }

  const body = await request.json()
  const { lead_id, lead_ids, campaign_id, all: enrichAll } = body

  // Construir query de leads a enriquecer
  let query = supabase
    .from('leads')
    .select('id, first_name, last_name, company_name, email, phone, linkedin_url, job_title, sector, country, website, domain')

  if (lead_id) {
    query = query.eq('id', lead_id)
  } else if (lead_ids?.length) {
    query = query.in('id', lead_ids)
  } else if (campaign_id) {
    query = query.eq('campaign_id', campaign_id)
  } else if (enrichAll) {
    // Solo los que faltan email o teléfono
    query = query.or('email.is.null,phone.is.null').limit(200)
  } else {
    return NextResponse.json({ error: 'Debes indicar lead_id, lead_ids, campaign_id o all:true' }, { status: 400 })
  }

  const { data: leadsData, error: fetchError } = await query
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!leadsData?.length) return NextResponse.json({ ok: true, enriched: 0, skipped: 0, not_found: 0, errors: 0, message: 'No se encontraron leads.' })

  type LeadRow = {
    id: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
    job_title: string | null
    sector: string | null
    country: string | null
    website: string | null
    domain: string | null
  }
  const leads: LeadRow[] = leadsData as LeadRow[]

  const client = new LushaClient(integration.api_key)
  const admin = createAdminClient()

  let enriched = 0
  let skipped = 0
  let not_found = 0
  let no_name = 0   // leads sin nombre de contacto (Lusha no puede buscar sin nombre)
  let errors = 0
  let api_errors: string[] = []  // errores de API (créditos, auth, timeout)

  // Helper: intentar enriquecer un lead individual con Lusha
  // Lusha necesita mínimo: (firstName o lastName) + company, o linkedinUrl
  // Si no hay nombre de persona, no podemos buscar en Lusha
  async function enrichSingle(lead: LeadRow) {
    const hasName = !!(lead.first_name || lead.last_name)
    const hasLinkedin = !!lead.linkedin_url

    if (!hasName && !hasLinkedin) {
      no_name++
      return
    }

    // Extraer dominio del website si no está en domain
    const companyDomain = lead.domain
      || (lead.website ? new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`).hostname.replace('www.', '') : undefined)

    const result = await client.enrichPerson({
      firstName: lead.first_name ?? undefined,
      lastName: lead.last_name ?? undefined,
      company: lead.company_name ?? undefined,
      companyDomain: companyDomain ?? undefined,
      linkedinUrl: lead.linkedin_url ?? undefined,
    })

    if (!result.found) {
      if (result.apiError) {
        api_errors.push(result.apiError)
        errors++
      } else {
        not_found++
      }
      return
    }

    const updates: Record<string, string | null> = {}
    if (!lead.email && result.email) updates.email = result.email
    if (!lead.phone && result.phone) updates.phone = result.phone
    if (!lead.linkedin_url && result.linkedin) updates.linkedin_url = result.linkedin
    if (!lead.job_title && result.jobTitle) updates.job_title = result.jobTitle

    if (Object.keys(updates).length === 0) { skipped++; return }

    await admin.from('leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', lead.id)
    enriched++
  }

  // Procesar todos en lotes de 25
  const CHUNK = 25
  for (let i = 0; i < leads.length; i += CHUNK) {
    const chunk = leads.slice(i, i + CHUNK)

    if (chunk.length === 1) {
      // Un solo lead — siempre individual
      try { await enrichSingle(chunk[0]) } catch { errors++ }
    } else {
      // Varios leads — intentar bulk primero, fallback a individual
      try {
        // Solo mandamos al bulk los que tienen nombre (Lusha lo requiere)
        const withName = chunk.filter(l => l.first_name || l.last_name || l.linkedin_url)
        const withoutName = chunk.filter(l => !l.first_name && !l.last_name && !l.linkedin_url)
        no_name += withoutName.length

        if (withName.length === 0) continue

        const bulkResults = await client.bulkEnrich(
          withName.map(l => ({
            id: l.id,
            firstName: l.first_name ?? undefined,
            lastName: l.last_name ?? undefined,
            company: l.company_name ?? undefined,
            linkedin: l.linkedin_url ?? undefined,
          }))
        )

        const resultMap = new Map(bulkResults.map(r => [r.id, r.result]))

        for (const lead of withName) {
          const result = resultMap.get(lead.id)
          if (!result?.found) { not_found++; continue }

          const updates: Record<string, string | null> = {}
          if (!lead.email && result.email) updates.email = result.email
          if (!lead.phone && result.phone) updates.phone = result.phone
          if (!lead.linkedin_url && result.linkedin) updates.linkedin_url = result.linkedin
          if (!lead.job_title && result.jobTitle) updates.job_title = result.jobTitle

          if (Object.keys(updates).length === 0) { skipped++; continue }

          await admin.from('leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', lead.id)
          enriched++
        }
      } catch {
        // Si falla el bulk, intentar individualmente
        for (const lead of chunk) {
          try { await enrichSingle(lead) } catch { errors++ }
        }
      }
    }
  }

  // Registrar actividad
  if (enriched > 0) {
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      campaign_id: campaign_id ?? null,
      type: 'enrichment',
      title: `Enriquecidos ${enriched} leads con Lusha`,
      description: `${not_found} no encontrados · ${no_name} sin nombre de contacto · ${skipped} ya tenían datos · ${errors} errores`,
      metadata: { source: 'lusha', enriched, not_found, no_name, skipped, errors },
    })
  }

  // Mensaje adaptado al resultado
  let message = `${enriched} leads enriquecidos con Lusha.`
  if (no_name > 0) message += ` ${no_name} sin nombre de contacto (Lusha necesita nombre de persona).`
  if (not_found > 0) message += ` ${not_found} no encontrados en la base de datos de Lusha.`
  if (skipped > 0) message += ` ${skipped} ya tenían datos completos.`
  if (api_errors.length > 0) message += ` Error de API: ${api_errors[0]}`

  return NextResponse.json({
    ok: true,
    enriched,
    skipped,
    not_found,
    no_name,
    errors,
    total: leads.length,
    message,
  })
}
