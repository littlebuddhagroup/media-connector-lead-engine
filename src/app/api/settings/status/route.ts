import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Devuelve qué servicios están activos según variables de entorno (sin exponer los valores)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const provider = process.env.AI_PROVIDER ?? 'gemini'
  const aiActive = provider === 'groq'
    ? Boolean(process.env.GROQ_API_KEY)
    : Boolean(process.env.GEMINI_API_KEY)

  return NextResponse.json({
    data: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      ai_active: aiActive,
      ai_provider: provider,
      resend: Boolean(process.env.RESEND_API_KEY),
      serpapi: Boolean(process.env.SERPAPI_API_KEY),
      hunter: Boolean(process.env.HUNTER_API_KEY),
      apollo: Boolean(process.env.APOLLO_API_KEY),
      resend_from: process.env.RESEND_FROM_EMAIL ?? '',
    }
  })
}
