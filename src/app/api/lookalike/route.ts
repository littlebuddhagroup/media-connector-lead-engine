// ============================================================
// LOOKALIKE PROSPECTING API — POST /api/lookalike
//
// Dado un lead de referencia (o una empresa introducida manualmente),
// busca empresas similares usando SerpAPI con consultas contextuales
// que detectan el mismo perfil de ICP:
//   · Sector + tamaño similar + país objetivo
//   · Keywords de packaging / FMCG / artwork proofing
//   · Competidores y pares del sector
//
// Devuelve un array de ResultadoLookalike con nombre, dominio,
// descripción y email si Hunter lo encuentra.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchWithSerpApi, findEmailWithHunter } from '@/services/scrapingService'

// Países soportados para la búsqueda
const SUPPORTED_COUNTRIES: Record<string, string> = {
  es: 'España',
  fr: 'Francia',
  de: 'Alemania',
  it: 'Italia',
  pt: 'Portugal',
  gb: 'Reino Unido',
  mx: 'México',
  co: 'Colombia',
  ar: 'Argentina',
  us: 'Estados Unidos',
  be: 'Bélgica',
  nl: 'Países Bajos',
}

// Palabras de ruido que normalmente no son clientes objetivo
const NOISE_DOMAINS = [
  'linkedin.com', 'wikipedia.org', 'facebook.com', 'twitter.com', 'instagram.com',
  'youtube.com', 'amazon.com', 'google.com', 'bloomberg.com', 'reuters.com',
  'eleconomista.es', 'expansion.com', 'cincodias.elpais.com', 'europapress.es',
]

function isNoiseDomain(domain: string): boolean {
  return NOISE_DOMAINS.some(n => domain.includes(n))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const {
    // lead_id: buscar lookalikes de un lead existente (opcional)
    lead_id,
    // company_name / sector / country: búsqueda manual directa
    company_name,
    sector,
    country = 'es',
    // num: número de resultados por query (total puede ser hasta 3x)
    num = 6,
  } = body

  // ── 1. Obtener datos del lead de referencia (si se proporciona) ──
  let refName = company_name as string | undefined
  let refSector = sector as string | undefined
  let refCountry = (country as string) || 'es'

  if (lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('company_name, sector, country')
      .eq('id', lead_id)
      .eq('user_id', user.id)
      .single()

    if (lead) {
      refName = refName || (lead.company_name as string)
      refSector = refSector || (lead.sector as string) || undefined
      refCountry = refCountry || (lead.country as string) || 'es'
    }
  }

  if (!refName && !refSector) {
    return NextResponse.json({ error: 'Proporciona company_name o sector para buscar lookalikes' }, { status: 400 })
  }

  // ── 2. Construir queries de búsqueda SerpAPI ──────────────────
  // Generamos 3 ángulos distintos para cubrir más variedad de empresas similares
  const gl = refCountry.slice(0, 2).toLowerCase()

  // Palabras clave ICP de MyMediaConnect para filtrar por perfil relevante
  const icpKeywords = 'packaging artwork etiquetado branding FMCG'

  const queries: string[] = []

  if (refName && refSector) {
    // Ángulo 1: competidores directos en el mismo sector
    queries.push(`empresas similares a "${refName}" ${refSector} marca propia packaging`)
    // Ángulo 2: sector amplio con foco en gestión de packaging
    queries.push(`${refSector} empresas líderes ${icpKeywords} ${refCountry !== 'es' ? SUPPORTED_COUNTRIES[gl] ?? '' : 'España'}`)
    // Ángulo 3: players del sector con referencias de artwork
    queries.push(`${refSector} fabricantes distribuidores packaging artwork approval workflow`)
  } else if (refName) {
    queries.push(`empresas como "${refName}" sector alimentación bebidas cosmética retail`)
    queries.push(`competidores "${refName}" FMCG packaging marca propia`)
  } else {
    // Solo sector
    queries.push(`${refSector} empresas líderes ${icpKeywords}`)
    queries.push(`${refSector} fabricantes packaging artwork gestión etiquetas`)
    queries.push(`${refSector} empresas FMCG marcas packaging multi-SKU`)
  }

  // ── 3. Ejecutar búsquedas SerpAPI en paralelo ─────────────────
  const searchResults = await Promise.allSettled(
    queries.map(q => searchWithSerpApi(q, gl, num + 4))
  )

  // Combinar, deduplicar por dominio, filtrar ruido
  const seen = new Set<string>()
  const combined = searchResults
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => (r as PromiseFulfilledResult<typeof searchResults[0] extends PromiseSettledResult<infer T> ? T : never>).value as Array<{ company_name: string; website?: string; domain?: string; description?: string }>)
    .filter(r => {
      if (!r.domain || isNoiseDomain(r.domain)) return false
      // Excluir la empresa de referencia
      if (refName && r.company_name.toLowerCase().includes(refName.toLowerCase())) return false
      if (seen.has(r.domain)) return false
      seen.add(r.domain)
      return true
    })
    .slice(0, num * 2) // límite generoso antes del enriquecimiento

  // ── 4. Buscar email via Hunter para los primeros resultados ───
  // Solo para los primeros `num` para no consumir créditos de Hunter en exceso
  const withEmail = await Promise.all(
    combined.slice(0, num).map(async r => {
      if (!r.domain) return { ...r, email: null, email_confidence: null }
      const hunter = await findEmailWithHunter(r.domain).catch(() => null)
      return {
        ...r,
        email: hunter?.email ?? null,
        email_confidence: hunter?.confidence ?? null,
      }
    })
  )

  // ── 5. Ordenar: primero los que tienen email ──────────────────
  const sorted = [
    ...withEmail.filter(r => r.email),
    ...withEmail.filter(r => !r.email),
  ]

  return NextResponse.json({
    data: sorted,
    reference: { name: refName, sector: refSector, country: refCountry },
    total: sorted.length,
  })
}
