// ============================================================
// PIPEDRIVE SERVICE — Integración bidireccional con Pipedrive CRM
//
// Funcionalidades:
//   · Importar: deals, persons, organizations → leads
//   · Exportar: leads → deals + persons en Pipedrive
//   · Sync: actualizar estado de deals desde la app
//
// Autenticación: API Token (v1) — almacenado en api_integrations
// Docs: https://developers.pipedrive.com/docs/api/v1
// ============================================================

export interface PipedrivePerson {
  id: number
  name: string
  email?: Array<{ value: string; primary: boolean }>
  phone?: Array<{ value: string; primary: boolean }>
  org_id?: { value: number; name: string }
  job_title?: string
  linkedin_url?: string | null
}

export interface PipedriveOrganization {
  id: number
  name: string
  address?: string
  industry?: string
  web_site?: string
  country_code?: string
  people_count?: number
}

export interface PipedriveDeal {
  id: number
  title: string
  status: string
  stage_id?: number
  person_id?: { value: number; name: string }
  org_id?: { value: number; name: string }
  value?: number
  currency?: string
  expected_close_date?: string
  add_time?: string
  update_time?: string
  owner_name?: string
  pipeline_id?: number
  notes_count?: number
}

// Resultado de la importación
export interface ImportResult {
  imported: number
  skipped: number
  errors: number
  leads: ImportedLead[]
}

export interface ImportedLead {
  company_name: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  website?: string
  sector?: string
  country?: string
  description?: string
  linkedin_url?: string
  pipedrive_deal_id?: number
  pipedrive_person_id?: number
  pipedrive_org_id?: number
}

// Resultado de la exportación
export interface ExportResult {
  exported: number
  skipped: number
  errors: number
  pipedrive_ids: Array<{ lead_id: string; deal_id?: number; person_id?: number }>
}

// ─── Cliente Pipedrive ────────────────────────────────────────

class PipedriveClient {
  private apiToken: string
  private baseUrl = 'https://api.pipedrive.com/v1'

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<{ success: boolean; data: T; additional_data?: { pagination?: { more_items_in_collection: boolean; next_start: number } } }> {
    const url = `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}api_token=${this.apiToken}`
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`Pipedrive API error ${res.status}: ${err}`)
    }
    return res.json()
  }

  // ── Test de conexión ──────────────────────────────────────
  async testConnection(): Promise<{ ok: boolean; user?: string; company?: string; error?: string }> {
    try {
      const resp = await this.request<{ name: string; company_name: string }>('/users/me')
      return { ok: true, user: resp.data.name, company: resp.data.company_name }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  // ── Obtener pipelines y stages ───────────────────────────
  async getPipelines(): Promise<Array<{ id: number; name: string }>> {
    const resp = await this.request<Array<{ id: number; name: string }>>('/pipelines')
    return resp.data ?? []
  }

  async getStages(pipelineId?: number): Promise<Array<{ id: number; name: string; pipeline_id: number }>> {
    const path = pipelineId ? `/stages?pipeline_id=${pipelineId}` : '/stages'
    const resp = await this.request<Array<{ id: number; name: string; pipeline_id: number }>>(path)
    return resp.data ?? []
  }

  // ── Importar: Deals ──────────────────────────────────────
  async getDeals(options: { status?: 'open' | 'won' | 'lost' | 'all_not_deleted'; limit?: number; start?: number; pipeline_id?: number } = {}): Promise<PipedriveDeal[]> {
    const params = new URLSearchParams({
      status: options.status ?? 'open',
      limit: String(options.limit ?? 100),
      start: String(options.start ?? 0),
    })
    if (options.pipeline_id) params.set('pipeline_id', String(options.pipeline_id))

    const resp = await this.request<PipedriveDeal[]>(`/deals?${params}`)
    return resp.data ?? []
  }

  async getDealsPaginated(options: { status?: string; pipeline_id?: number; max_results?: number } = {}): Promise<PipedriveDeal[]> {
    const maxResults = options.max_results ?? 500
    const allDeals: PipedriveDeal[] = []
    let start = 0
    const pageSize = 100

    while (allDeals.length < maxResults) {
      const params = new URLSearchParams({
        status: options.status ?? 'open',
        limit: String(Math.min(pageSize, maxResults - allDeals.length)),
        start: String(start),
      })
      if (options.pipeline_id) params.set('pipeline_id', String(options.pipeline_id))

      const resp = await this.request<PipedriveDeal[]>(`/deals?${params}`)
      const items = resp.data ?? []
      allDeals.push(...items)

      if (!resp.additional_data?.pagination?.more_items_in_collection || items.length === 0) break
      start += items.length
    }
    return allDeals
  }

  // ── Importar: Persons ────────────────────────────────────
  async getPerson(personId: number): Promise<PipedrivePerson | null> {
    try {
      const resp = await this.request<PipedrivePerson>(`/persons/${personId}`)
      return resp.data
    } catch {
      return null
    }
  }

  async getPersonsPaginated(options: { max_results?: number } = {}): Promise<PipedrivePerson[]> {
    const maxResults = options.max_results ?? 500
    const allPersons: PipedrivePerson[] = []
    let start = 0

    while (allPersons.length < maxResults) {
      const params = new URLSearchParams({
        limit: String(Math.min(100, maxResults - allPersons.length)),
        start: String(start),
      })
      const resp = await this.request<PipedrivePerson[]>(`/persons?${params}`)
      const items = resp.data ?? []
      allPersons.push(...items)
      if (!resp.additional_data?.pagination?.more_items_in_collection || items.length === 0) break
      start += items.length
    }
    return allPersons
  }

  // ── Importar: Organizations ──────────────────────────────
  async getOrganization(orgId: number): Promise<PipedriveOrganization | null> {
    try {
      const resp = await this.request<PipedriveOrganization>(`/organizations/${orgId}`)
      return resp.data
    } catch {
      return null
    }
  }

  async getOrganizationsPaginated(options: { max_results?: number } = {}): Promise<PipedriveOrganization[]> {
    const maxResults = options.max_results ?? 500
    const allOrgs: PipedriveOrganization[] = []
    let start = 0

    while (allOrgs.length < maxResults) {
      const params = new URLSearchParams({
        limit: String(Math.min(100, maxResults - allOrgs.length)),
        start: String(start),
      })
      const resp = await this.request<PipedriveOrganization[]>(`/organizations?${params}`)
      const items = resp.data ?? []
      allOrgs.push(...items)
      if (!resp.additional_data?.pagination?.more_items_in_collection || items.length === 0) break
      start += items.length
    }
    return allOrgs
  }

  // ── Exportar: Crear/Actualizar Person ────────────────────
  async createOrUpdatePerson(data: {
    name: string
    email?: string
    phone?: string
    org_id?: number
    job_title?: string
  }): Promise<number | null> {
    try {
      // Buscar si ya existe por email
      if (data.email) {
        const search = await this.request<Array<{ id: number }>>(`/persons/search?term=${encodeURIComponent(data.email)}&fields=email`)
        if ((search.data ?? []).length > 0) {
          return search.data[0].id
        }
      }
      // Crear nuevo
      const body: Record<string, unknown> = { name: data.name }
      if (data.email) body.email = [{ value: data.email, primary: true }]
      if (data.phone) body.phone = [{ value: data.phone, primary: true }]
      if (data.org_id) body.org_id = data.org_id
      if (data.job_title) body.job_title = data.job_title

      const resp = await this.request<{ id: number }>('/persons', { method: 'POST', body })
      return resp.data.id
    } catch {
      return null
    }
  }

  // ── Exportar: Crear/Actualizar Organization ──────────────
  async createOrUpdateOrganization(data: {
    name: string
    address?: string
    industry?: string
    web_site?: string
  }): Promise<number | null> {
    try {
      // Buscar por nombre
      const search = await this.request<Array<{ id: number }>>(`/organizations/search?term=${encodeURIComponent(data.name)}&fields=name`)
      if ((search.data ?? []).length > 0) {
        return search.data[0].id
      }
      // Crear nueva
      const resp = await this.request<{ id: number }>('/organizations', { method: 'POST', body: data })
      return resp.data.id
    } catch {
      return null
    }
  }

  // ── Exportar: Crear Deal ─────────────────────────────────
  async createDeal(data: {
    title: string
    person_id?: number
    org_id?: number
    stage_id?: number
    status?: string
    value?: number
    currency?: string
  }): Promise<number | null> {
    try {
      const resp = await this.request<{ id: number }>('/deals', { method: 'POST', body: data })
      return resp.data.id
    } catch {
      return null
    }
  }

  // ── Actualizar Deal ──────────────────────────────────────
  async updateDeal(dealId: number, data: { status?: string; stage_id?: number; title?: string }): Promise<boolean> {
    try {
      await this.request(`/deals/${dealId}`, { method: 'PUT', body: data })
      return true
    } catch {
      return false
    }
  }

  // ── Añadir nota a deal o person ──────────────────────────
  async addNote(data: { content: string; deal_id?: number; person_id?: number; org_id?: number }): Promise<boolean> {
    try {
      await this.request('/notes', { method: 'POST', body: data })
      return true
    } catch {
      return false
    }
  }
}

// ─── Mapeo Pipedrive → Lead de la app ────────────────────────

function mapDealToLead(
  deal: PipedriveDeal,
  person?: PipedrivePerson | null,
  org?: PipedriveOrganization | null
): ImportedLead {
  const personEmail = person?.email?.find(e => e.primary)?.value ?? person?.email?.[0]?.value ?? ''
  const personPhone = person?.phone?.find(p => p.primary)?.value ?? person?.phone?.[0]?.value ?? ''
  const personName = person?.name ?? deal.person_id?.name ?? ''
  const [firstName, ...lastParts] = personName.split(' ')
  const lastName = lastParts.join(' ')
  const companyName = org?.name ?? deal.org_id?.name ?? deal.title

  return {
    company_name: companyName,
    first_name: firstName || companyName,
    last_name: lastName || '',
    email: personEmail,
    phone: personPhone || undefined,
    website: org?.web_site || undefined,
    sector: org?.industry || undefined,
    country: org?.country_code || undefined,
    description: `Importado desde Pipedrive. Deal: "${deal.title}" (${deal.status}). Pipeline ID: ${deal.pipeline_id ?? 'N/A'}.`,
    pipedrive_deal_id: deal.id,
    pipedrive_person_id: person?.id,
    pipedrive_org_id: org?.id,
  }
}

function mapPersonToLead(person: PipedrivePerson): ImportedLead {
  const email = person.email?.find(e => e.primary)?.value ?? person.email?.[0]?.value ?? ''
  const phone = person.phone?.find(p => p.primary)?.value ?? person.phone?.[0]?.value ?? ''
  const [firstName, ...lastParts] = person.name.split(' ')
  const lastName = lastParts.join(' ')
  const companyName = person.org_id?.name ?? person.name

  return {
    company_name: companyName,
    first_name: firstName || companyName,
    last_name: lastName || '',
    email,
    phone: phone || undefined,
    sector: undefined,
    pipedrive_person_id: person.id,
    pipedrive_org_id: person.org_id?.value,
  }
}

// ─── API pública del servicio ─────────────────────────────────

export async function getPipedriveClient(apiToken: string): Promise<PipedriveClient> {
  return new PipedriveClient(apiToken)
}

export async function testPipedriveConnection(apiToken: string) {
  const client = new PipedriveClient(apiToken)
  return client.testConnection()
}

export async function importFromPipedrive(
  apiToken: string,
  options: {
    source: 'deals' | 'persons' | 'organizations'
    status?: string
    pipeline_id?: number
    max_results?: number
  }
): Promise<ImportResult> {
  const client = new PipedriveClient(apiToken)
  const result: ImportResult = { imported: 0, skipped: 0, errors: 0, leads: [] }

  try {
    if (options.source === 'deals') {
      const deals = await client.getDealsPaginated({
        status: options.status ?? 'open',
        pipeline_id: options.pipeline_id,
        max_results: options.max_results ?? 200,
      })

      // Pre-fetch persons y orgs en paralelo (por grupos de 10)
      for (const deal of deals) {
        try {
          const [person, org] = await Promise.all([
            deal.person_id?.value ? client.getPerson(deal.person_id.value) : Promise.resolve(null),
            deal.org_id?.value ? client.getOrganization(deal.org_id.value) : Promise.resolve(null),
          ])

          const lead = mapDealToLead(deal, person, org)
          if (!lead.email && !lead.company_name) {
            result.skipped++
            continue
          }
          result.leads.push(lead)
          result.imported++
        } catch {
          result.errors++
        }
      }
    } else if (options.source === 'persons') {
      const persons = await client.getPersonsPaginated({ max_results: options.max_results ?? 200 })
      for (const person of persons) {
        const email = person.email?.find(e => e.primary)?.value ?? person.email?.[0]?.value
        if (!email) { result.skipped++; continue }
        result.leads.push(mapPersonToLead(person))
        result.imported++
      }
    } else if (options.source === 'organizations') {
      const orgs = await client.getOrganizationsPaginated({ max_results: options.max_results ?? 200 })
      for (const org of orgs) {
        result.leads.push({
          company_name: org.name,
          first_name: org.name,
          last_name: '',
          email: '',
          website: org.web_site || undefined,
          sector: org.industry || undefined,
          country: org.country_code || undefined,
          pipedrive_org_id: org.id,
        })
        result.imported++
      }
    }
  } catch (err) {
    result.errors++
    console.error('Pipedrive import error:', err)
  }

  return result
}

export async function exportToPipedrive(
  apiToken: string,
  leads: Array<{
    id: string
    company_name: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
    website?: string | null
    sector?: string | null
    country?: string | null
    score?: number | null
    status?: string | null
    priority?: string | null
  }>,
  options: {
    stage_id?: number
    pipeline_id?: number
    add_notes?: boolean
  } = {}
): Promise<ExportResult> {
  const client = new PipedriveClient(apiToken)
  const result: ExportResult = { exported: 0, skipped: 0, errors: 0, pipedrive_ids: [] }

  // Mapeo de status del lead a estado del deal en Pipedrive
  const statusToDealStatus: Record<string, string> = {
    meeting_scheduled: 'open',
    interested: 'open',
    replied: 'open',
    closed: 'won',
    discarded: 'lost',
  }

  for (const lead of leads) {
    try {
      // 1. Crear/encontrar organización
      const orgId = lead.company_name
        ? await client.createOrUpdateOrganization({
            name: lead.company_name,
            web_site: lead.website || undefined,
            industry: lead.sector || undefined,
          })
        : null

      // 2. Crear/encontrar persona
      const personName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.company_name
      const personId = await client.createOrUpdatePerson({
        name: personName,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        org_id: orgId || undefined,
      })

      // 3. Crear deal
      const dealStatus = lead.status ? (statusToDealStatus[lead.status] ?? 'open') : 'open'
      const dealTitle = `${lead.company_name} — MyMediaConnect`
      const dealId = await client.createDeal({
        title: dealTitle,
        person_id: personId || undefined,
        org_id: orgId || undefined,
        stage_id: options.stage_id,
        status: dealStatus,
      })

      // 4. Añadir nota con contexto del lead
      if (options.add_notes && dealId && lead.score) {
        await client.addNote({
          deal_id: dealId,
          content: `Lead exportado desde MyMediaConnect Lead Engine.\n\nFit Score: ${lead.score}/100\nPrioridad: ${lead.priority ?? 'media'}\nEstado: ${lead.status ?? 'nuevo'}\nSector: ${lead.sector ?? 'N/A'}\nPaís: ${lead.country ?? 'N/A'}`,
        })
      }

      result.pipedrive_ids.push({ lead_id: lead.id, deal_id: dealId ?? undefined, person_id: personId ?? undefined })
      result.exported++
    } catch {
      result.errors++
      result.pipedrive_ids.push({ lead_id: lead.id })
    }
  }

  return result
}
