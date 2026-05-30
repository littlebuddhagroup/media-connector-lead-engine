// ============================================================
// LUSHA SERVICE
// Enriquecimiento de contactos B2B: email, teléfono, LinkedIn
// Docs: https://www.lusha.com/docs/
// Auth: header api_key
// ============================================================

const LUSHA_BASE = 'https://api.lusha.com'

// ─── Tipos ───────────────────────────────────────────────────

export interface LushaPersonResult {
  firstName?: string
  lastName?: string
  email?: string
  emails?: string[]
  phone?: string
  phones?: string[]
  linkedin?: string
  jobTitle?: string
  company?: string
  companyDomain?: string
  city?: string
  country?: string
  credits_used?: number
  found: boolean
}

export interface LushaProspect {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  linkedin?: string
  jobTitle?: string
  company?: string
  companyDomain?: string
  city?: string
  country?: string
  sector?: string
}

export interface LushaSearchFilters {
  jobTitles?: string[]       // e.g. ['Marketing Manager', 'CMO', 'Brand Manager']
  industries?: string[]      // e.g. ['FMCG', 'Consumer Goods']
  countries?: string[]       // e.g. ['Spain', 'France']
  companySizes?: string[]    // e.g. ['51-200', '201-500']
  companyNames?: string[]    // e.g. ['Coca-Cola', 'Nestlé']
  companyDomains?: string[]  // e.g. ['coca-cola.com', 'nestle.com']
  keywords?: string[]
  limit?: number             // max results (default 25, max 100)
}

export interface LushaBulkInput {
  id: string
  firstName?: string
  lastName?: string
  company?: string
  companyDomain?: string
  linkedin?: string
}

export interface LushaBulkResult {
  id: string
  result: LushaPersonResult
}

// ─── Cliente ─────────────────────────────────────────────────

export class LushaClient {
  constructor(private apiKey: string) {}

  private async request<T>(path: string, options?: RequestInit, timeoutMs = 20000): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(`${LUSHA_BASE}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'api_key': this.apiKey,
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(`Lusha API error ${res.status}: ${errText}`)
      }

      return res.json() as Promise<T>
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Lusha API timeout (>${timeoutMs / 1000}s): ${path}`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  // Test de conexión — hace una búsqueda mínima para verificar que la API key es válida.
  // Lusha no tiene un endpoint /account; usamos /person con parámetros mínimos:
  // - 401 → API key inválida
  // - 200 / 404 (persona no encontrada) → API key válida
  async testConnection(): Promise<{ ok: boolean; credits?: number; plan?: string; error?: string }> {
    try {
      const res = await fetch(`${LUSHA_BASE}/person?firstName=Test&lastName=Test&company=Acme`, {
        headers: { 'api_key': this.apiKey },
      })

      // 401 = key inválida
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}))
        return { ok: false, error: `API key inválida (401): ${body?.message ?? 'Unauthorized'}` }
      }

      // 200, 404 (persona no encontrada) o 402 (sin créditos) → key válida
      const body = await res.json().catch(() => ({}))
      const credits = body?.data?.remainingCredits ?? body?.remainingCredits
      return { ok: true, credits, plan: body?.data?.plan }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  // Enriquecer persona usando prospecting/contact/search
  // El endpoint /person no está disponible en este plan de Lusha.
  // Estrategia: buscar por empresa/dominio y hacer match por nombre en los resultados.
  // Si no hay match de nombre suficientemente cercano → found: false → el caller hace fallback.
  async enrichPerson(params: {
    firstName?: string
    lastName?: string
    company?: string
    companyDomain?: string
    linkedinUrl?: string
  }): Promise<LushaPersonResult & { apiError?: string }> {
    const firstName  = params.firstName?.trim().toLowerCase() ?? ''
    const lastName   = params.lastName?.trim().toLowerCase() ?? ''
    const fullName   = [params.firstName, params.lastName].filter(Boolean).join(' ')
    const fullNameLC = fullName.toLowerCase()

    // Necesitamos al menos empresa o dominio para acotar la búsqueda
    if (!params.company && !params.companyDomain) {
      return { found: false }
    }

    const companyInclude: Record<string, unknown> = {}
    if (params.company)       companyInclude.names   = [params.company]
    if (params.companyDomain) companyInclude.domains = [params.companyDomain]

    try {
      const body = {
        filters: {
          companies: { include: companyInclude },
        },
        pages: { page: 0, size: 10 },
        includePartialContact: false,
      }

      const data = await this.request<Record<string, unknown>>('/prospecting/contact/search', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      type LContact = {
        firstName?: string; lastName?: string
        emails?: Array<{ email: string }>
        phoneNumbers?: Array<{ localizedNumber: string }>
        linkedinUrl?: string; jobTitle?: string
        positions?: Array<{ companyName?: string; companyDomain?: string }>
        city?: string; country?: string
      }
      type LResp = { data?: LContact[]; totalResults?: number }
      const contacts = (data as LResp).data ?? []

      if (!contacts.length) return { found: false }

      // Intentar match por nombre si lo tenemos
      let match: LContact | undefined

      if (fullNameLC) {
        // 1. Match exacto de nombre completo
        match = contacts.find(c => {
          const cn = [c.firstName, c.lastName].filter(Boolean).join(' ').toLowerCase()
          return cn === fullNameLC
        })

        // 2. Match de firstName + inicio de lastName (por si hay nombres compuestos)
        if (!match && firstName) {
          match = contacts.find(c => {
            const cfn = (c.firstName ?? '').toLowerCase()
            const cln = (c.lastName ?? '').toLowerCase()
            return cfn === firstName && (lastName ? cln.startsWith(lastName.split(' ')[0]) : true)
          })
        }

        // 3. Solo match de firstName (si es único en la empresa)
        if (!match && firstName) {
          const fnMatches = contacts.filter(c =>
            (c.firstName ?? '').toLowerCase() === firstName
          )
          if (fnMatches.length === 1) match = fnMatches[0]
        }
      }

      // Sin nombre para comparar o sin match → no podemos confirmar identidad
      if (!match) return { found: false }

      const emails = match.emails?.map(e => e.email) ?? []
      const phones = match.phoneNumbers?.map(p => p.localizedNumber) ?? []

      return {
        firstName: match.firstName,
        lastName: match.lastName,
        email: emails[0],
        emails,
        phone: phones[0],
        phones,
        linkedin: match.linkedinUrl,
        jobTitle: match.jobTitle,
        company: match.positions?.[0]?.companyName,
        companyDomain: match.positions?.[0]?.companyDomain,
        city: match.city,
        country: match.country,
        found: emails.length > 0 || phones.length > 0,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[Lusha enrichPerson] error:', msg)
      return { found: false, apiError: msg }
    }
  }

  // Búsqueda de prospectos nuevos (prospecting API)
  // Endpoint correcto: POST /prospecting/contact/search
  // Docs: https://docs.lusha.com/apis/openapi/prospecting-search-and-enrich/searchprospectingcontacts
  async searchProspects(filters: LushaSearchFilters): Promise<LushaProspect[]> {
    // Lusha: locations → array de objetos; el resto → arrays de strings
    const contactInclude: Record<string, unknown> = {}
    if (filters.jobTitles?.length)
      contactInclude.jobTitles = filters.jobTitles
    if (filters.countries?.length)
      contactInclude.locations = filters.countries.map(c => ({ country: c }))

    const companyInclude: Record<string, unknown> = {}
    if (filters.industries?.length)
      companyInclude.industries = filters.industries
    if (filters.companyNames?.length)
      companyInclude.names = filters.companyNames
    if (filters.companyDomains?.length)
      companyInclude.domains = filters.companyDomains
    if (filters.companySizes?.length)
      companyInclude.employeeCount = filters.companySizes

    const body = {
      filters: {
        ...(Object.keys(contactInclude).length ? { contacts: { include: contactInclude } } : {}),
        ...(Object.keys(companyInclude).length ? { companies: { include: companyInclude } } : {}),
      },
      pages: {
        page: 0,
        size: Math.min(filters.limit ?? 25, 100),
      },
      includePartialContact: true,
    }

    const data = await this.request<Record<string, unknown>>('/prospecting/contact/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    // La respuesta de Lusha es { data: [...], totalResults, currentPage, ... }
    // Los contactos están directamente en data[] (array plano en raíz)
    type LushaContact = {
      id?: string
      firstName?: string; lastName?: string; fullName?: string; name?: string
      emails?: Array<{ email: string }>
      emailAddresses?: Array<{ email: string }>
      phoneNumbers?: Array<{ localizedNumber: string }>
      linkedinUrl?: string; jobTitle?: string; title?: string
      positions?: Array<{ companyName?: string; companyDomain?: string; title?: string }>
      currentPositions?: Array<{ companyName?: string; companyDomain?: string; title?: string }>
      company?: { name?: string; domain?: string }
      companyName?: string; companyDomain?: string
      city?: string; country?: string; industry?: string; sector?: string
    }
    type LushaResponse = { data?: LushaContact[]; contacts?: LushaContact[]; totalResults?: number }
    const r = data as LushaResponse

    const contacts: LushaContact[] =
      (Array.isArray(r.data) ? r.data : null) ??
      (Array.isArray(r.contacts) ? r.contacts : null) ??
      []

    return contacts.map(p => {
      // Nombre: varios campos posibles según plan
      const fullName = p.fullName ?? p.name ?? [p.firstName, p.lastName].filter(Boolean).join(' ') ?? ''
      const [firstName, ...rest] = fullName.split(' ')
      const lastName = rest.join(' ')

      // Empresa: varios campos posibles
      const companyName =
        p.companyName ??
        p.company?.name ??
        (p.positions ?? p.currentPositions)?.[0]?.companyName ??
        undefined

      const companyDomain =
        p.companyDomain ??
        p.company?.domain ??
        (p.positions ?? p.currentPositions)?.[0]?.companyDomain ??
        undefined

      return {
        firstName: firstName || p.firstName,
        lastName: lastName || p.lastName,
        email: p.emails?.[0]?.email ?? p.emailAddresses?.[0]?.email,
        phone: p.phoneNumbers?.[0]?.localizedNumber,
        linkedin: p.linkedinUrl,
        jobTitle: p.jobTitle ?? p.title ?? (p.positions ?? p.currentPositions)?.[0]?.title,
        company: companyName,
        companyDomain,
        city: p.city,
        country: p.country,
        sector: p.industry ?? p.sector,
      }
    })
  }

  // Enriquecimiento en bloque (hasta 25 por llamada)
  async bulkEnrich(contacts: LushaBulkInput[]): Promise<LushaBulkResult[]> {
    // Lusha bulk: POST /v1/bulk-enrichment
    const results: LushaBulkResult[] = []
    const chunkSize = 25

    for (let i = 0; i < contacts.length; i += chunkSize) {
      const chunk = contacts.slice(i, i + chunkSize)

      const data = await this.request<{
        data?: Array<{
          externalId?: string
          emailAddresses?: Array<{ email: string }>
          phoneNumbers?: Array<{ localizedNumber: string }>
          linkedinUrl?: string
          jobTitle?: string
          city?: string
          country?: string
        }>
      }>('/bulk-enrichment', {
        method: 'POST',
        body: JSON.stringify({
          contacts: chunk.map(c => ({
            externalId: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company,
            companyDomain: c.companyDomain,
            linkedinUrl: c.linkedin,
          })),
        }),
      })

      for (const item of data?.data ?? []) {
        const emails = item.emailAddresses?.map(e => e.email) ?? []
        const phones = item.phoneNumbers?.map(p => p.localizedNumber) ?? []
        results.push({
          id: item.externalId ?? '',
          result: {
            email: emails[0],
            emails,
            phone: phones[0],
            phones,
            linkedin: item.linkedinUrl,
            jobTitle: item.jobTitle,
            city: item.city,
            country: item.country,
            found: emails.length > 0 || phones.length > 0,
          },
        })
      }
    }

    return results
  }
}

// ─── Helpers exportados ───────────────────────────────────────

export async function getLushaClient(apiKey: string): Promise<LushaClient> {
  return new LushaClient(apiKey)
}

export async function testLushaConnection(
  apiKey: string
): Promise<{ ok: boolean; credits?: number; plan?: string; error?: string }> {
  const client = new LushaClient(apiKey)
  return client.testConnection()
}
