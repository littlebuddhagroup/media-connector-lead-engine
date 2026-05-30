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

// ─── Artwork Signal Search ──────────────────────────────────────────────────
// Detecta señales de los 4 dolores de MyMediaConnect en internet:
//   1. Complejidad de SKUs / versiones de packaging
//   2. Flujos manuales de aprobación de artes finales
//   3. Riesgo regulatorio / compliance de etiquetado
//   4. Expansión global / multi-mercado

export interface ArtworkSignalResult {
  title: string
  snippet: string
  url: string
  date?: string
}

export interface ArtworkSignal {
  query: string
  dimension: 'complejidad' | 'proceso' | 'regulatorio' | 'global'
  results: ArtworkSignalResult[]
}

/**
 * searchArtworkSignals — Busca en internet señales de los problemas de artwork
 * que resuelve MyMediaConnect. Hace 3 búsquedas SerpAPI en paralelo.
 * Devuelve vacío (sin throw) si la API key no está o falla.
 */
export async function searchArtworkSignals(
  companyName: string,
  domain?: string,
  country = 'es'
): Promise<ArtworkSignal[]> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) return []

  const gl = country?.slice(0, 2).toLowerCase() || 'es'

  const queries: Array<{ q: string; dimension: ArtworkSignal['dimension'] }> = [
    {
      // Señales de complejidad: lanzamientos, nuevos SKUs, variantes, gamas
      q: `"${companyName}" nuevo producto lanzamiento packaging gama SKU referencia`,
      dimension: 'complejidad',
    },
    {
      // Señales regulatorias: compliance, retiradas, etiquetado, normativa
      q: `"${companyName}" etiquetado normativa regulatorio retirada recall compliance`,
      dimension: 'regulatorio',
    },
    {
      // Señales de expansión: mercados internacionales, exportación
      q: `"${companyName}" exportación mercado internacional expansión distribución`,
      dimension: 'global',
    },
  ]

  const settled = await Promise.allSettled(
    queries.map(async ({ q, dimension }) => {
      const params = new URLSearchParams({
        api_key: apiKey,
        engine: 'google',
        q,
        gl,
        hl: 'es',
        num: '5',
      })

      const res = await fetch(`https://serpapi.com/search?${params}`, {
        signal: AbortSignal.timeout(9000),
      })
      if (!res.ok) throw new Error(`SerpAPI ${res.status}`)

      const data = await res.json()
      const organic = (data.organic_results ?? []) as Array<{
        title?: string
        snippet?: string
        link?: string
        date?: string
      }>

      const signal: ArtworkSignal = {
        query: q,
        dimension,
        results: organic.slice(0, 4).map(r => ({
          title: r.title ?? '',
          snippet: r.snippet ?? '',
          url: r.link ?? '',
          ...(r.date ? { date: r.date } : {}),
        })),
      }
      return signal
    })
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<ArtworkSignal> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(r => r.results.length > 0)
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
