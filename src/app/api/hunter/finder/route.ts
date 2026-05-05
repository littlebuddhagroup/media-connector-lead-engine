import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// HUNTER.IO — Email Finder
// Dado nombre + dominio, devuelve el email más probable
// ============================================================

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey || apiKey === 'tu-hunter-key') {
    return NextResponse.json({ error: 'HUNTER_API_KEY no configurada' }, { status: 400 })
  }

  const { first_name, last_name, domain, company } = await request.json()

  if (!first_name?.trim() || !last_name?.trim()) {
    return NextResponse.json({ error: 'Nombre y apellido son obligatorios' }, { status: 400 })
  }
  if (!domain?.trim() && !company?.trim()) {
    return NextResponse.json({ error: 'Introduce el dominio o nombre de empresa' }, { status: 400 })
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    first_name: first_name.trim(),
    last_name: last_name.trim(),
  })
  if (domain?.trim()) params.set('domain', domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  if (company?.trim()) params.set('company', company.trim())

  try {
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`, {
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()

    if (!res.ok) {
      const msg = data?.errors?.[0]?.details ?? `Hunter error ${res.status}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({
      email: data.data?.email ?? null,
      score: data.data?.score ?? 0,
      domain: data.data?.domain ?? domain,
      sources: data.data?.sources ?? [],
      position: data.data?.position ?? null,
      twitter: data.data?.twitter ?? null,
      linkedin: data.data?.linkedin_url ?? null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error en Hunter'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
