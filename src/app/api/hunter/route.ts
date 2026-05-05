import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// HUNTER.IO — Búsqueda de emails por dominio de empresa
// ============================================================

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
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey || apiKey === 'tu-hunter-key') {
    return NextResponse.json({ error: 'HUNTER_API_KEY no configurada. Añádela en .env.local' }, { status: 400 })
  }

  const { domain, company, limit = 20, department, seniority, country } = await request.json()

  if (!domain?.trim() && !company?.trim()) {
    return NextResponse.json({ error: 'Introduce el dominio o nombre de empresa' }, { status: 400 })
  }

  try {
    // limit=0 significa sin límite → usamos el máximo que permite Hunter (100 por petición)
    const effectiveLimit = limit === 0 ? 100 : Math.min(limit, 250)
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(effectiveLimit),
    })

    if (domain?.trim()) params.set('domain', domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    if (company?.trim()) params.set('company', company.trim())
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

    // Emails ya en el CRM — comprobamos solo por email individual, no por dominio
    // (una empresa puede tener varios contactos y solo algunos añadidos)
    const { data: existing } = await supabase
      .from('leads')
      .select('email')
      .eq('user_id', user.id)
    const existingEmails = new Set((existing ?? []).map((l: { email: string }) => l.email?.toLowerCase()).filter(Boolean))

    const results: HunterResult[] = emails.map(e => ({
      company_name: orgName,
      domain: orgDomain,
      website: orgWebsite,
      contact_name: [e.first_name, e.last_name].filter(Boolean).join(' ') || undefined,
      contact_title: e.position,
      contact_email: e.value,
      confidence: e.confidence,
      department: e.department,
      seniority: e.seniority,
      contact_linkedin: e.linkedin,
      already_exists: existingEmails.has(e.value.toLowerCase()),
    }))

    return NextResponse.json({
      data: results,
      total: data.data?.emails?.length ?? 0,
      meta: {
        organization: orgName,
        domain: orgDomain,
        pattern: data.data?.pattern,
        webmail: data.data?.webmail,
      }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error en Hunter'
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
          title: `Lead importado de Hunter.io: ${lead.company_name}`,
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
      title: `Lead importado de Hunter.io: ${company_name}`,
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
