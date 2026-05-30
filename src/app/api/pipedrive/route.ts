// ============================================================
// PIPEDRIVE — Status y gestión de la integración
// GET /api/pipedrive  → Estado de la conexión + stats
// DELETE /api/pipedrive → Desconectar (borrar API key guardada)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { testPipedriveConnection } from '@/services/pipedriveService'

// ─── GET: Estado de la conexión ──────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Obtener API key guardada
  const { data: integration } = await supabase
    .from('api_integrations')
    .select('api_key, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('provider', 'pipedrive')
    .single()

  if (!integration?.api_key) {
    return NextResponse.json({ connected: false })
  }

  // Test de conexión con Pipedrive
  const status = await testPipedriveConnection(integration.api_key)

  return NextResponse.json({
    connected: status.ok,
    user: status.user,
    company: status.company,
    error: status.error,
    last_updated: integration.updated_at,
  })
}

// ─── POST: Guardar API key y verificar conexión ───────────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { api_token } = await request.json()
  if (!api_token) return NextResponse.json({ error: 'api_token requerido' }, { status: 400 })

  // Verificar que el token funciona antes de guardarlo
  const status = await testPipedriveConnection(api_token)
  if (!status.ok) {
    return NextResponse.json({ error: `Token inválido: ${status.error}` }, { status: 400 })
  }

  // Guardar en api_integrations (upsert)
  const admin = createAdminClient()
  const { error } = await admin
    .from('api_integrations')
    .upsert({
      user_id: user.id,
      provider: 'pipedrive',
      api_key: api_token,   // En producción, usar encriptación real
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    connected: true,
    user: status.user,
    company: status.company,
  })
}

// ─── DELETE: Desconectar Pipedrive ────────────────────────────
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  await admin
    .from('api_integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'pipedrive')

  return NextResponse.json({ ok: true, connected: false })
}
