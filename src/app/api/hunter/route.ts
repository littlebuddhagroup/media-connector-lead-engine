import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// LEAD SCOUT — Cascada de búsqueda: SerpAPI → Hunter → PDL → Apollo
// ============================================================

// ── Inferir departamento a partir del cargo ───────────────────────────────────
const DEPT_KEYWORDS: [string, string[]][] = [
  ['executive',      ['ceo', 'coo', 'cfo', 'cmo', 'chief', 'director general', 'presidente', 'vp ', 'vice president', 'founder', 'co-founder', 'socio', 'managing director', 'general manager']],
  ['marketing',      ['marketing', 'brand', 'marca', 'digital', 'contenido', 'content', 'comunicacion', 'comunicación', 'growth', 'demand', 'crm', 'seo', 'sem', 'ecommerce', 'e-commerce', 'trade marketing', 'shopper', 'category', 'packaging', 'design', 'diseño', 'creative', 'creativ']],
  ['sales',          ['sales', 'ventas', 'comercial', 'account', 'business development', 'revenue', 'key account', 'canal', 'distribucion', 'distribución']],
  ['management',     ['manager', 'head of', 'responsable', 'coordinador', 'coordinator', 'supervisor', 'lead']],
  ['communication',  ['pr ', 'press', 'prensa', 'relaciones', 'public relations', 'comunicacion', 'comunicación', 'spokesperson', 'portavoz']],
  ['finance',        ['finance', 'finanzas', 'cfo', 'treasury', 'controller', 'contabilidad', 'accounting', 'fiscal']],
  ['hr',             ['human resources', 'recursos humanos', 'talent', 'people', 'rrhh', 'hr ', 'hiring', 'recruitment', 'seleccion', 'selección']],
  ['it',             ['tech', 'technology', 'it ', 'software', 'developer', 'engineer', 'engineering', 'data', 'systems', 'cto', 'digital transformation']],
]

function inferDepartment(position?: string): string | undefined {
  if (!position) return undefined
  const lower = position.toLowerCase()
  for (const [dept, keywords] of DEPT_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return dept
  }
  return undefined
}

// ── Mapa país → TLDs locales para post-filtrado ───────────────────────────────
const COUNTRY_TLDS: Record<string, string[]> = {
  es: ['.es'],
  mx: ['.mx', '.com.mx'],
  ar: ['.ar', '.com.ar'],
  co: ['.co', '.com.co'],
  cl: ['.cl', '.com.cl'],
  pe: ['.pe', '.com.pe'],
  br: ['.br', '.com.br'],
  fr: ['.fr'],
  de: ['.de'],
  it: ['.it'],
  pt: ['.pt'],
  gb: ['.co.uk', '.uk'],
  ie: ['.ie'],
  ch: ['.ch'],
  nl: ['.nl'],
  be: ['.be'],
  pl: ['.pl'],
}

interface HunterEmail {
  value: string
  type: string
  confidence: number
  first_name?: string
  last_name?: string
  position?: string
  linkedin?: string
  department?: string
  seniority?: string
}

interface HunterResult {
  company_name: string
  domain: string
  website: string
  contact_name?: string
  contact_title?: string
  contact_email: string
  confidence: number
  department?: string
  seniority?: string
  contact_linkedin?: string
  already_exists: boolean
  added?: boolean
  source?: 'hunter' | 'pdl' | 'apollo'
}

// ── Países Hunter → nombres Apollo ───────────────────────────────────────────
const COUNTRY_TO_APOLLO: Record<string, string> = {
  es: 'Spain', mx: 'Mexico', ar: 'Argentina', co: 'Colombia', cl: 'Chile',
  pe: 'Peru', br: 'Brazil', fr: 'France', de: 'Germany', it: 'Italy',
  pt: 'Portugal', gb: 'United Kingdom', ie: 'Ireland', ch: 'Switzerland',
  us: 'United States', ca: 'Canada', nl: 'Netherlands', be: 'Belgium', pl: 'Poland',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey || apiKey === 'tu-hunter-key') {
    return NextResponse.json({ error: 'HUNTER_API_KEY no configurada. Añádela en .env.local' }, { status: 400 })
  }

  const { domain: rawDomain, company, limit = 20, department, seniority, country } = await request.json()

  if (!rawDomain?.trim() && !company?.trim()) {
    return NextResponse.json({ error: 'Introduce el dominio o nombre de empresa' }, { status: 400 })
  }

  // ── Resolución automática de dominio via SerpAPI ──────────────────────────
  // Si el usuario no puso dominio (o puso algo que no parece dominio), buscamos
  // el sitio oficial en Google para obtener el dominio real de la empresa.
  let domain = rawDomain?.trim() ?? ''
  let resolvedDomain = false
  const looksLikeDomain = /\.[a-z]{2,}$/i.test(domain)

  if ((!domain || !looksLikeDomain) && company?.trim() && process.env.SERPAPI_API_KEY) {
    try {
      const serpParams = new URLSearchParams({
        q: `${company.trim()} official website`,
        engine: 'google',
        api_key: process.env.SERPAPI_API_KEY,
        num: '5',
        gl: country ?? 'us',
        hl: 'en',
      })
      const serpRes = await fetch(`https://serpapi.com/search?${serpParams}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (serpRes.ok) {
        const serpData = await serpRes.json()
        const firstResult = serpData.organic_results?.[0]?.link ?? serpData.knowledge_graph?.website
        if (firstResult) {
          const extracted = firstResult.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
          const GENERIC_DOMAINS = ['linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'wikipedia.org', 'crunchbase.com']
          if (extracted && !GENERIC_DOMAINS.some(g => extracted.includes(g))) {
            domain = extracted
            resolvedDomain = true
          }
        }
      }
    } catch (serpErr) {
      console.warn('SerpAPI domain resolution failed:', serpErr)
    }
  }

  try {
    const effectiveLimit = limit === 0 ? 100 : Math.min(limit, 250)
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(effectiveLimit),
    })

    if (domain) params.set('domain', domain.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    else if (company?.trim()) params.set('company', company.trim())
    if (department) params.set('department', department)
    if (seniority) params.set('seniority', seniority)
    if (country) params.set('country', country)

    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('Hunter error:', res.status, errBody)
      let msg = `Hunter API error ${res.status}`
      if (res.status === 401 || res.status === 403) msg = 'Hunter API key inválida. Revisa HUNTER_API_KEY en .env.local'
      if (res.status === 429) msg = 'Límite de búsquedas de Hunter alcanzado. Espera unos minutos.'
      if (res.status === 400) msg = `Parámetros inválidos: ${errBody.slice(0, 200)}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const data = await res.json()
    const emails: HunterEmail[] = data.data?.emails ?? []
    const orgName: string = data.data?.organization ?? company ?? domain ?? 'Empresa'
    const orgDomain: string = data.data?.domain ?? domain ?? ''
    const orgWebsite = `https://${orgDomain}`

    // Emails ya en el CRM
    const { data: existing } = await supabase
      .from('leads')
      .select('email')
      .eq('user_id', user.id)
    const existingEmails = new Set((existing ?? []).map((l: { email: string }) => l.email?.toLowerCase()).filter(Boolean))

    const countryTlds = country ? (COUNTRY_TLDS[country] ?? []) : []
    const isGenericDomain = orgDomain && !countryTlds.some(tld => orgDomain.endsWith(tld))

    const hunterResults: HunterResult[] = emails.map(e => ({
      company_name: orgName,
      domain: orgDomain,
      website: orgWebsite,
      contact_name: [e.first_name, e.last_name].filter(Boolean).join(' ') || undefined,
      contact_title: e.position,
      contact_email: e.value,
      confidence: e.confidence,
      department: e.department || inferDepartment(e.position),
      seniority: e.seniority,
      contact_linkedin: e.linkedin,
      already_exists: existingEmails.has(e.value.toLowerCase()),
      source: 'hunter' as const,
    }))

    // ── PDL + Apollo en paralelo ──────────────────────────────────────────────
    const domainCoreName = orgDomain
      ? orgDomain.replace(/\.[a-z]{2,3}(\.[a-z]{2})?$/i, '').replace(/^www\./, '')
      : null

    const GENERIC_SUFFIXES = /\b(company|group|foods|food|spain|españa|iberia|iberica|co|inc|ltd|sa|sl|slu|bv|gmbh)\b/gi
    const cleanCompanyName = (domainCoreName ?? company ?? '')
      .replace(/-/g, ' ')
      .replace(GENERIC_SUFFIXES, '')
      .trim()

    const pdlPromise = async (): Promise<HunterResult[]> => {
      if (!process.env.PDL_API_KEY) return []
      const conditions: string[] = []
      const domainClauses: string[] = []

      if (orgDomain) domainClauses.push(`job_company_website = '${orgDomain}'`)
      if (domainCoreName) {
        if (!orgDomain?.endsWith('.com')) domainClauses.push(`job_company_website = '${domainCoreName}.com'`)
        if (!orgDomain?.endsWith('.es'))  domainClauses.push(`job_company_website = '${domainCoreName}.es'`)
        if (!orgDomain?.endsWith('.mx'))  domainClauses.push(`job_company_website = '${domainCoreName}.mx'`)
      }
      if (company?.trim()) domainClauses.push(`job_company_name LIKE '${company.trim().replace(/'/g, "''")}%'`)
      if (cleanCompanyName && cleanCompanyName !== company?.trim()) {
        domainClauses.push(`job_company_name LIKE '${cleanCompanyName.replace(/'/g, "''")}%'`)
      }

      if (domainClauses.length > 0) conditions.push(`(${domainClauses.join(' OR ')})`)
      else return []
      if (country) conditions.push(`location_country = '${country.toLowerCase()}'`)
      if (department) {
        const DEPT_ROLES: Record<string, string[]> = {
          marketing:     ['marketing'],
          executive:     ['c_suite', 'owner', 'president', 'vp'],
          sales:         ['sales', 'business_development'],
          management:    ['operations'],
          communication: ['media', 'marketing'],
          finance:       ['finance'],
          hr:            ['human_resources'],
          it:            ['engineering', 'information_technology'],
        }
        const roles = DEPT_ROLES[department]
        if (roles) conditions.push(`job_title_role IN (${roles.map(r => `'${r}'`).join(', ')})`)
      }
      conditions.push(`work_email IS NOT NULL`)
      const pdlSql = `SELECT * FROM person WHERE ${conditions.join(' AND ')}`
      console.log('[PDL] Query:', pdlSql)
      const pdlRes = await fetch('https://api.peopledatalabs.com/v5/person/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.PDL_API_KEY },
        body: JSON.stringify({ sql: pdlSql, size: Math.min(effectiveLimit, 100) }),
        signal: AbortSignal.timeout(20000),
      })
      if (!pdlRes.ok) {
        const errText = await pdlRes.text()
        console.warn('[PDL] Error:', pdlRes.status, errText.slice(0, 300))
        return []
      }
      const pdlData = await pdlRes.json()
      console.log('[PDL] Results:', pdlData.data?.length ?? 0)
      return (pdlData.data ?? [])
        .filter((p: { work_email?: string }) => p.work_email)
        .map((p: {
          full_name?: string; first_name?: string; last_name?: string;
          job_title?: string; job_title_role?: string; job_title_levels?: string[];
          work_email?: string; linkedin_url?: string;
          job_company_name?: string; job_company_website?: string;
        }) => ({
          company_name: p.job_company_name ?? orgName,
          domain: p.job_company_website?.replace(/^https?:\/\//, '').replace(/^www\./, '') ?? orgDomain,
          website: p.job_company_website ?? orgWebsite,
          contact_name: (p.full_name ?? [p.first_name, p.last_name].filter(Boolean).join(' ')) || undefined,
          contact_title: p.job_title,
          contact_email: p.work_email!,
          confidence: 90,
          department: p.job_title_role ?? inferDepartment(p.job_title),
          seniority: p.job_title_levels?.[0],
          contact_linkedin: p.linkedin_url,
          already_exists: existingEmails.has(p.work_email!.toLowerCase()),
          source: 'pdl' as const,
        }))
    }

    const apolloPromise = async (): Promise<HunterResult[]> => {
      if (!process.env.APOLLO_API_KEY) return []
      const apolloPayload: Record<string, unknown> = {
        api_key: process.env.APOLLO_API_KEY,
        page: 1,
        per_page: Math.min(effectiveLimit, 50),
        person_seniorities: ['director', 'c_suite', 'vp', 'head', 'manager', 'senior'],
      }
      if (orgDomain || domainCoreName) {
        const domains: string[] = []
        if (orgDomain) domains.push(orgDomain)
        if (domainCoreName) {
          if (!domains.includes(`${domainCoreName}.com`)) domains.push(`${domainCoreName}.com`)
          if (!domains.includes(`${domainCoreName}.es`)) domains.push(`${domainCoreName}.es`)
        }
        apolloPayload.organization_domains = domains
        if (domainCoreName) apolloPayload.q_organization_name = domainCoreName
      } else if (company?.trim()) {
        apolloPayload.q_organization_name = company.trim()
      }
      if (department) {
        const DEPT_TITLES: Record<string, string[]> = {
          marketing:     ['Marketing Director', 'Brand Manager', 'Marketing Manager', 'Head of Marketing', 'CMO', 'Content Director', 'Digital Marketing Manager', 'Growth Manager'],
          executive:     ['CEO', 'COO', 'CFO', 'President', 'Founder', 'Managing Director', 'General Manager'],
          sales:         ['Sales Director', 'Commercial Director', 'Key Account Manager', 'Sales Manager', 'Head of Sales', 'Business Development Manager'],
          management:    ['Manager', 'Head of', 'Director'],
          communication: ['PR Manager', 'Communications Director', 'Head of Communications', 'Public Relations Manager'],
        }
        const titles = DEPT_TITLES[department]
        if (titles) apolloPayload.person_titles = titles
      }
      if (country && COUNTRY_TO_APOLLO[country]) apolloPayload.person_locations = [COUNTRY_TO_APOLLO[country]]
      const apolloRes = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': process.env.APOLLO_API_KEY },
        body: JSON.stringify(apolloPayload),
        signal: AbortSignal.timeout(15000),
      })
      if (!apolloRes.ok) return []
      const apolloData = await apolloRes.json()
      return (apolloData.people ?? []).map((p: {
        name?: string; first_name?: string; last_name?: string;
        title?: string; email?: string; linkedin_url?: string;
        organization?: { name?: string; website_url?: string; primary_domain?: string }
      }) => {
        const org = p.organization
        const dom = org?.primary_domain?.toLowerCase() ?? orgDomain
        const emailVal = p.email ?? ''
        return {
          company_name: org?.name ?? orgName,
          domain: dom,
          website: org?.website_url ?? orgWebsite,
          contact_name: (p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' ')) || undefined,
          contact_title: p.title,
          contact_email: emailVal,
          confidence: emailVal ? 70 : 40,
          department: inferDepartment(p.title),
          seniority: undefined,
          contact_linkedin: p.linkedin_url,
          already_exists: existingEmails.has(emailVal.toLowerCase()),
          source: 'apollo' as const,
        }
      }).filter((r: HunterResult) => r.contact_email)
    }

    // ── Ejecutar PDL + Apollo en paralelo ─────────────────────────────────────
    const [pdlSettled, apolloSettled] = await Promise.allSettled([pdlPromise(), apolloPromise()])
    const pdlResults: HunterResult[] = pdlSettled.status === 'fulfilled' ? pdlSettled.value : []
    const apolloResults: HunterResult[] = apolloSettled.status === 'fulfilled' ? apolloSettled.value : []
    if (pdlSettled.status === 'rejected') console.warn('[PDL] Promise rejected:', pdlSettled.reason)
    if (apolloSettled.status === 'rejected') console.warn('[Apollo] Promise rejected:', apolloSettled.reason)

    // ── Deduplicar por email (Hunter > PDL > Apollo) ──────────────────────────
    const seenEmails = new Set<string>()
    const allResults: HunterResult[] = []
    for (const r of [...hunterResults, ...pdlResults, ...apolloResults]) {
      const key = r.contact_email.toLowerCase()
      if (key && !seenEmails.has(key)) {
        seenEmails.add(key)
        allResults.push(r)
      }
    }

    return NextResponse.json({
      data: allResults,
      filtered_by_country: false,
      country_warning: !!(country && countryTlds.length > 0 && isGenericDomain),
      pdl_used: pdlResults.length > 0,
      apollo_used: apolloResults.length > 0,
      sources: [
        ...(hunterResults.length > 0 ? ['hunter'] : []),
        ...(pdlResults.length > 0 ? ['pdl'] : []),
        ...(apolloResults.length > 0 ? ['apollo'] : []),
      ],
      service_status: {
        serp:   { used: resolvedDomain, resolved: resolvedDomain ? domain : null },
        hunter: { searched: true, count: hunterResults.length },
        pdl:    { searched: !!process.env.PDL_API_KEY, count: pdlResults.length },
        apollo: { searched: !!process.env.APOLLO_API_KEY, count: apolloResults.length },
      },
      total: allResults.length,
      resolved_domain: resolvedDomain ? domain : undefined,
      meta: {
        organization: orgName,
        domain: orgDomain,
        pattern: data.data?.pattern,
        webmail: data.data?.webmail,
      }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error en Lead Scout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — Añadir múltiples contactos de Hunter al CRM en una sola operación
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { contacts, campaign_id, list_id } = await request.json()
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: 'contacts array requerido' }, { status: 400 })
  }

  // Verificar emails ya existentes para no duplicar
  const emailsToAdd = contacts.map((c: HunterResult) => c.contact_email.toLowerCase())
  const { data: existing } = await supabase
    .from('leads')
    .select('email')
    .eq('user_id', user.id)
    .in('email', emailsToAdd)
  const existingSet = new Set((existing ?? []).map((l: { email: string }) => l.email?.toLowerCase()))

  const newContacts = contacts.filter((c: HunterResult) => !existingSet.has(c.contact_email.toLowerCase()))
  if (!newContacts.length) {
    return NextResponse.json({ inserted: 0, skipped: contacts.length })
  }

  // Bulk insert de leads en una sola query
  const leadsToInsert = newContacts.map((c: HunterResult) => {
    const nameParts = c.contact_name ? c.contact_name.split(' ') : []
    return {
      company_name: c.company_name,
      domain: c.domain ?? null,
      website: c.website ?? null,
      email: c.contact_email,
      first_name: nameParts[0] ?? null,
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
      department: c.department ?? null,
      linkedin_url: c.contact_linkedin ?? null,
      description: c.contact_title ?? null,
      campaign_id: campaign_id ?? null,
      user_id: user.id,
      source: 'hunter',
    }
  })

  const { data: inserted, error } = await supabase
    .from('leads')
    .insert(leadsToInsert)
    .select('id, email, company_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bulk insert de activity logs + asignación a lista en paralelo
  if (inserted?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = [
      supabase.from('activity_logs').insert(
        inserted.map((lead: { id: string; email: string; company_name: string }) => ({
          lead_id: lead.id,
          user_id: user.id,
          campaign_id: campaign_id ?? null,
          type: 'lead_created',
          title: `Lead importado: ${lead.company_name}`,
          description: `Email: ${lead.email}`,
        }))
      ),
    ]

    if (list_id) {
      ops.push(
        supabase.from('lead_list_members').upsert(
          inserted.map((lead: { id: string }) => ({ list_id, lead_id: lead.id })),
          { onConflict: 'list_id,lead_id', ignoreDuplicates: true }
        )
      )
    }

    await Promise.all(ops)
  }

  return NextResponse.json({
    inserted: inserted?.length ?? 0,
    skipped: contacts.length - newContacts.length,
    ids: (inserted ?? []).map((l: { id: string; company_name: string }) => ({ id: l.id, company_name: l.company_name })),
  })
}

// PUT — Añadir contacto de Hunter al CRM
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { company_name, domain, website, contact_name, contact_title, contact_email, contact_linkedin, campaign_id, list_id, department, first_name, last_name } = await request.json()

  if (!company_name || !contact_email) {
    return NextResponse.json({ error: 'company_name y contact_email son requeridos' }, { status: 400 })
  }

  // Separar nombre/apellido si no vienen separados
  const nameParts = contact_name ? contact_name.split(' ') : []
  const resolvedFirstName = first_name ?? nameParts[0] ?? null
  const resolvedLastName = last_name ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null)

  const { data, error } = await supabase
    .from('leads')
    .insert({
      company_name,
      domain: domain ?? null,
      website: website ?? null,
      email: contact_email,
      first_name: resolvedFirstName,
      last_name: resolvedLastName,
      department: department ?? null,
      linkedin_url: contact_linkedin ?? null,
      description: contact_title ? `${contact_title}` : null,
      campaign_id: campaign_id ?? null,
      user_id: user.id,
      source: 'hunter',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Activity log + asignación a lista en paralelo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [
    supabase.from('activity_logs').insert({
      lead_id: data.id,
      user_id: user.id,
      campaign_id: campaign_id ?? null,
      type: 'lead_created',
      title: `Lead importado: ${company_name}`,
      description: `Email: ${contact_email}${contact_name ? ` · Contacto: ${contact_name}` : ''}`,
    }),
  ]

  if (list_id) {
    ops.push(
      supabase.from('lead_list_members').upsert(
        [{ list_id, lead_id: data.id }],
        { onConflict: 'list_id,lead_id', ignoreDuplicates: true }
      )
    )
  }

  await Promise.all(ops)

  return NextResponse.json({ data }, { status: 201 })
}
