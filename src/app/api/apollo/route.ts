import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// APOLLO.IO — Búsqueda de contactos por cargo y sector
// ============================================================

interface ApolloContact {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  title?: string
  email?: string
  linkedin_url?: string
  organization?: {
    name?: string
    website_url?: string
    primary_domain?: string
    industry?: string
    country?: string
  }
}

interface ApolloSearchResult {
  company_name: string
  domain?: string
  website?: string
  sector?: string
  country?: string
  contact_name?: string
  contact_title?: string
  contact_email?: string
  contact_linkedin?: string
  already_exists: boolean
  added?: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'APOLLO_API_KEY no configurada en variables de entorno' }, { status: 400 })
  }

  const { job_titles, industries, countries, per_page = 20 } = await request.json()

  if (!job_titles?.length && !industries?.length) {
    return NextResponse.json({ error: 'Indica al menos un cargo o sector' }, { status: 400 })
  }

  try {
    // Apollo v1 API — parámetros validados:
    // - q_keywords: palabras clave libres (usamos para sectores)
    // - person_titles: cargos exactos
    // - person_locations: países (nombres en inglés)
    // - person_seniorities: nivel jerárquico
    // - contact_email_status: 'verified' | 'likely to engage' | 'unavailable' | 'bounced'
    // NOTA: q_organization_industries NO es un parámetro válido en v1
    const searchPayload: Record<string, unknown> = {
      api_key: apiKey,
      page: 1,
      per_page: Math.min(per_page, 50),
    }

    // Cargos
    if (job_titles?.length) {
      searchPayload.person_titles = job_titles
    }

    // Sectores → los usamos como keywords de la organización
    if (industries?.length) {
      searchPayload.q_organization_keyword_tags = industries
    }

    // Países → filtro de localización del contacto
    if (countries?.length) {
      searchPayload.person_locations = countries
    }

    // Nivel jerárquico — asegura que encontramos decisores
    searchPayload.person_seniorities = ['director', 'c_suite', 'vp', 'head', 'manager']

    // Solo contactos con email disponible
    searchPayload.contact_email_status = ['verified', 'likely to engage']

    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(searchPayload),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('Apollo error:', res.status, errBody)
      let friendlyError = `Apollo API error: ${res.status}`
      if (res.status === 403 || res.status === 401) friendlyError = 'API Key de Apollo inválida o sin permisos. Verifica que APOLLO_API_KEY esté configurada en Vercel.'
      if (res.status === 422) friendlyError = 'Parámetros de búsqueda inválidos. Prueba con menos filtros o términos más simples.'
      if (res.status === 429) friendlyError = 'Límite de búsquedas de Apollo alcanzado. Espera unos minutos.'
      return NextResponse.json({ error: friendlyError, debug: { status: res.status, body: errBody.slice(0, 200) } }, { status: 500 })
    }

    const data = await res.json()
    const people: ApolloContact[] = data.people ?? []

    // Dominios ya en el CRM
    const { data: existing } = await supabase
      .from('leads')
      .select('domain, email')
      .eq('user_id', user.id)
    const existingDomains = new Set((existing ?? []).map((l: { domain: string }) => l.domain?.toLowerCase()).filter(Boolean))
    const existingEmails = new Set((existing ?? []).map((l: { email: string }) => l.email?.toLowerCase()).filter(Boolean))

    const results: ApolloSearchResult[] = people.map(p => {
      const org = p.organization
      const domain = org?.primary_domain?.toLowerCase() ?? ''
      const email = p.email?.toLowerCase() ?? ''

      return {
        company_name: org?.name ?? 'Empresa desconocida',
        domain: org?.primary_domain,
        website: org?.website_url,
        sector: org?.industry,
        country: org?.country,
        contact_name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' '),
        contact_title: p.title,
        contact_email: p.email,
        contact_linkedin: p.linkedin_url,
        already_exists: existingDomains.has(domain) || (!!email && existingEmails.has(email)),
      }
    })

    return NextResponse.json({
      data: results,
      total: data.pagination?.total_entries ?? results.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error en Apollo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT — Añadir contacto de Apollo al CRM
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { company_name, domain, website, sector, country, contact_name, contact_title, contact_email, contact_linkedin, campaign_id } = await request.json()

  if (!company_name) {
    return NextResponse.json({ error: 'company_name requerido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      company_name,
      domain: domain ?? null,
      website: website ?? null,
      sector: sector ?? null,
      country: country ?? null,
      email: contact_email ?? null,
      linkedin_url: contact_linkedin ?? null,
      description: contact_title ? `Contacto: ${contact_name} — ${contact_title}` : null,
      campaign_id: campaign_id ?? null,
      user_id: user.id,
      source: 'apify', // Reutilizamos el tipo 'apify' para Apollo
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    lead_id: data.id,
    user_id: user.id,
    campaign_id: campaign_id ?? null,
    type: 'lead_created',
    title: `Lead importado de Apollo.io: ${company_name}`,
    description: contact_email ? `Contacto: ${contact_name} (${contact_email})` : `Contacto: ${contact_name ?? 'desconocido'}`,
  })

  return NextResponse.json({ data }, { status: 201 })
}
