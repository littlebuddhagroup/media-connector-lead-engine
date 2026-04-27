import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractDomain } from '@/lib/utils'

// Busca email de un dominio con Hunter.io
async function findEmail(domain: string): Promise<{ email?: string; confidence?: number; first_name?: string; last_name?: string; position?: string }> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey || apiKey === 'tu-hunter-key') return {}
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=3`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return {}
    const data = await res.json()
    const emails = data.data?.emails ?? []
    if (emails.length === 0) return {}
    // Preferir emails con cargo directivo o de mayor confianza
    const sorted = [...emails].sort((a: Record<string, number>, b: Record<string, number>) => (b.confidence ?? 0) - (a.confidence ?? 0))
    const best = sorted[0]
    return {
      email: best.value,
      confidence: best.confidence,
      first_name: best.first_name,
      last_name: best.last_name,
      position: best.position,
    }
  } catch {
    return {}
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { query, country = 'es', num = 10 } = await request.json()
  if (!query?.trim()) return NextResponse.json({ error: 'Búsqueda requerida' }, { status: 400 })

  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'SerpAPI no configurado' }, { status: 400 })

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: 'google',
    q: query,
    gl: country,
    hl: 'es',
    num: String(num),
  })

  const res = await fetch(`https://serpapi.com/search?${params}`)
  if (!res.ok) return NextResponse.json({ error: `SerpAPI error: ${res.status}` }, { status: 500 })

  const data = await res.json()
  const organic = data.organic_results ?? []

  // Dominios ya existentes en el CRM
  const { data: existing } = await supabase
    .from('leads').select('domain, email').eq('user_id', user.id)
  const existingDomains = new Set((existing ?? []).map((l: { domain: string }) => l.domain?.toLowerCase()).filter(Boolean))

  // Procesar resultados + buscar emails en paralelo
  const rawResults = organic
    .filter((r: Record<string, string>) => r.link)
    .map((r: Record<string, string>) => {
      let domain = ''
      try { domain = new URL(r.link).hostname.replace('www.', '') } catch { /* ignore */ }
      return {
        company_name: r.title ?? domain,
        website: r.link,
        domain,
        description: r.snippet ?? '',
        already_exists: existingDomains.has(domain.toLowerCase()),
      }
    })

  // Buscar emails para todos los dominios en paralelo
  const withEmails = await Promise.all(
    rawResults.map(async (r: { company_name: string; website: string; domain: string; description: string; already_exists: boolean }) => {
      const emailData = r.domain ? await findEmail(r.domain) : {}
      return { ...r, ...emailData }
    })
  )

  return NextResponse.json({ data: withEmails })
}

// Añadir lead desde descubrimiento
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { company_name, website, domain: rawDomain, description, email, campaign_id } = await request.json()
  if (!company_name) return NextResponse.json({ error: 'company_name requerido' }, { status: 400 })

  const domain = rawDomain || extractDomain(website)

  const { data, error } = await supabase
    .from('leads')
    .insert({
      company_name, website, domain, description,
      email: email || null,
      campaign_id: campaign_id || null,
      user_id: user.id,
      source: 'serpapi',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    lead_id: data.id,
    user_id: user.id,
    campaign_id: campaign_id || null,
    type: 'lead_created',
    title: `Lead descubierto: ${company_name}`,
    description: email ? `Email encontrado: ${email}` : 'Sin email encontrado',
  })

  return NextResponse.json({ data }, { status: 201 })
}
