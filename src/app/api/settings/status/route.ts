import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Devuelve qué servicios están activos según variables de entorno (sin exponer los valores)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  return NextResponse.json({
    data: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      resend: Boolean(process.env.RESEND_API_KEY),
      serpapi: Boolean(process.env.SERPAPI_API_KEY),
      hunter: Boolean(process.env.HUNTER_API_KEY),
      resend_from: process.env.RESEND_FROM_EMAIL ?? '',
    }
  })
}
