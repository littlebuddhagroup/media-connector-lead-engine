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

  // Campos base (siempre existentes)
  const coreFields = {
    email_from_address: body.email_from_address,
    email_from_name: body.email_from_name,
    email_signature: body.email_signature,
    email_daily_limit: body.email_daily_limit,
    ai_model: body.ai_model,
    default_language: body.default_language,
    default_tone: body.default_tone,
    scraping_provider: body.scraping_provider,
  }

  // Campos v2 (requieren migración leads_v2_and_settings.sql)
  const v2Fields: Record<string, unknown> = {}
  if (body.ai_provider !== undefined) v2Fields.ai_provider = body.ai_provider
  if (body.sender_email !== undefined) v2Fields.sender_email = body.sender_email

  // Intentar guardado completo primero
  const { data, error } = await supabase
    .from('settings')
    .upsert({ ...coreFields, ...v2Fields, user_id: user.id }, { onConflict: 'user_id' })
    .select()
    .single()

  if (!error) return NextResponse.json({ data })

  // Si falla por columnas v2 no existentes, reintentar solo con core
  const isSchemaError = error.message?.includes('column') || error.code === '42703'
  if (isSchemaError && Object.keys(v2Fields).length > 0) {
    const { data: data2, error: error2 } = await supabase
      .from('settings')
      .upsert({ ...coreFields, user_id: user.id }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error2) return NextResponse.json({ error: error2.message }, { status: 500 })
    return NextResponse.json({
      data: data2,
      warning: 'Ejecuta supabase/leads_v2_and_settings.sql para guardar proveedor IA y email remitente',
    })
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
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
