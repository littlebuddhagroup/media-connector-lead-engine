import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: settings } = await supabase
    .from('settings').select('*').eq('user_id', user.id).single()

  const { data: integrations } = await supabase
    .from('api_integrations').select('provider, is_active, last_tested, test_status')
    .eq('user_id', user.id)

  return NextResponse.json({ data: { settings, integrations } })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('settings')
    .upsert({ ...body, user_id: user.id }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Guardar API key de integración
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { provider, api_key } = await request.json()
  if (!provider) return NextResponse.json({ error: 'provider requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('api_integrations')
    .upsert({
      user_id: user.id,
      provider,
      api_key,
      is_active: Boolean(api_key),
    }, { onConflict: 'user_id,provider' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
