// ============================================================
// SCRAPING SERVICE — Abstracción de proveedores
// SerpAPI (Google Search) + Web content fetch
// ============================================================

export interface SearchResult {
  company_name: string
  website?: string
  domain?: string
  description?: string
  source_url?: string
}

export interface ScrapedWebContent {
  title?: string
  description?: string
  content: string
  url: string
}

// --- SERPAPI: Buscar empresas en Google ---
export async function searchWithSerpApi(
  query: string,
  country = 'es',
  numResults = 10
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) throw new Error('SERPAPI_API_KEY no configurada')

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: 'google',
    q: query,
    gl: country,
    hl: 'es',
    num: String(numResults),
  })

  const res = await fetch(`https://serpapi.com/search?${params}`)
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`)

  const data = await res.json()
  const organicResults = data.organic_results ?? []

  return organicResults
    .filter((r: Record<string, string>) => r.link)
    .map((r: Record<string, string>) => {
      let domain = ''
      try {
        domain = new URL(r.link).hostname.replace('www.', '')
      } catch { /* ignore */ }

      return {
        company_name: r.title ?? domain,
        website: r.link,
        domain,
        description: r.snippet,
        source_url: r.link,
      } as SearchResult
    })
}

// --- FETCH CONTENIDO WEB (para enriquecimiento) ---
export async function scrapeWebContent(url: string): Promise<ScrapedWebContent> {
  if (!url) throw new Error('URL requerida')

  const fullUrl = url.startsWith('http') ? url : `https://${url}`

  try {
    const res = await fetch(fullUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MediaConnector-Bot/1.0; +https://mymediaconnect.com)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html = await res.text()

    // Extracción básica de texto sin dependencias
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? ''
    const description =
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1]?.trim() ??
      ''

    // Eliminar tags HTML y scripts
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000) // Límite para no saturar AI

    return { title, description, content: text, url: fullUrl }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    throw new Error(`No se pudo scrapear ${url}: ${message}`)
  }
}

// --- HUNTER.IO: Buscar email de empresa ---
export async function findEmailWithHunter(
  domain: string
): Promise<{ email?: string; confidence?: number }> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) return {}

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=1`
    )
    if (!res.ok) return {}

    const data = await res.json()
    const emails = data.data?.emails ?? []
    if (emails.length === 0) return {}

    return {
      email: emails[0].value,
      confidence: emails[0].confidence,
    }
  } catch {
    return {}
  }
}

// --- FACTORY: elegir proveedor según configuración ---
export async function searchLeads(
  query: string,
  provider: 'serpapi' | 'manual' = 'serpapi',
  options: { country?: string; num?: number } = {}
): Promise<SearchResult[]> {
  switch (provider) {
    case 'serpapi':
      return searchWithSerpApi(query, options.country ?? 'es', options.num ?? 10)
    default:
      return []
  }
}
