import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// HUNTER.IO — Email Verifier (individual y bulk)
// ============================================================

interface VerifyResult {
  email: string
  status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'unknown'
  score: number
  regexp: boolean
  gibberish: boolean
  disposable: boolean
  webmail: boolean
  mx_records: boolean
  smtp_server: boolean
  smtp_check: boolean
}

async function verifyOne(email: string, apiKey: string): Promise<VerifyResult> {
  const params = new URLSearchParams({ api_key: apiKey, email: email.trim() })
  const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`, {
    signal: AbortSignal.timeout(20000),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.details ?? `Error ${res.status}`)
  }
  return {
    email,
    status: data.data?.status ?? 'unknown',
    score: data.data?.score ?? 0,
    regexp: data.data?.regexp ?? false,
    gibberish: data.data?.gibberish ?? false,
    disposable: data.data?.disposable ?? false,
    webmail: data.data?.webmail ?? false,
    mx_records: data.data?.mx_records ?? false,
    smtp_server: data.data?.smtp_server ?? false,
    smtp_check: data.data?.smtp_check ?? false,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey || apiKey === 'tu-hunter-key') {
    return NextResponse.json({ error: 'HUNTER_API_KEY no configurada' }, { status: 400 })
  }

  const { emails } = await request.json()

  if (!emails?.length) {
    return NextResponse.json({ error: 'Introduce al menos un email' }, { status: 400 })
  }

  const list: string[] = Array.isArray(emails)
    ? emails
    : String(emails).split(/[\n,;]+/).map((e: string) => e.trim()).filter(Boolean)

  if (list.length > 20) {
    return NextResponse.json({ error: 'Máximo 20 emails por verificación' }, { status: 400 })
  }

  const results: (VerifyResult & { error?: string })[] = []

  for (const email of list) {
    try {
      const r = await verifyOne(email, apiKey)
      results.push(r)
      // Pequeña pausa para no saturar la API de Hunter
      if (list.length > 1) await new Promise(res => setTimeout(res, 300))
    } catch (err) {
      results.push({
        email,
        status: 'unknown',
        score: 0,
        regexp: false,
        gibberish: false,
        disposable: false,
        webmail: false,
        mx_records: false,
        smtp_server: false,
        smtp_check: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      })
    }
  }

  return NextResponse.json({ data: results })
}
