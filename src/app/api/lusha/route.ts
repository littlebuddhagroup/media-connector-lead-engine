// ============================================================
// LUSHA — Gestión de la integración
// GET  /api/lusha  → Estado de la conexión (créditos, plan)
// POST /api/lusha  → Conectar (valida token y guarda)
// DELETE /api/lusha → Desconectar
// ============================================================

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { testLushaConnection } from '@/services/lushaService'

// ─── GET: Estado ─────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: integration } = await supabase
    .from('api_integrations')
    .select('api_key, updated_at')
    .eq('user_id', user.id)
    .eq('provider', 'lusha')
    .single()

  if (!integration?.api_key) {
    return NextResponse.json({ connected: false })
  }

  const status = await testLushaConnection(integration.api_key)

  return NextResponse.json({
    connected: status.ok,
    credits: status.credits,
    plan: status.plan,
    error: status.error,
    last_updated: integration.updated_at,
  })
}

// ─── POST: Conectar ───────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { api_key } = await request.json()
  if (!api_key) return NextResponse.json({ error: 'api_key requerida' }, { status: 400 })

  // Verificar que funciona
  const status = await testLushaConnection(api_key)
  if (!status.ok) {
    return NextResponse.json({ error: `API key inválida: ${status.error}` }, { status: 400 })
  }

  // Guardar en api_integrations
  const admin = createAdminClient()
  const { error } = await admin
    .from('api_integrations')
    .upsert({
      user_id: user.id,
      provider: 'lusha',
      api_key,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    connected: true,
    credits: status.credits,
    plan: status.plan,
  })
}

// ─── DELETE: Desconectar ──────────────────────────────────────
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  await admin
    .from('api_integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'lusha')

  return NextResponse.json({ ok: true, connected: false })
}
