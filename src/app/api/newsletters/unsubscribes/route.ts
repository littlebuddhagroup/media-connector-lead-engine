import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// GET  /api/newsletters/unsubscribes — lista de bajas del usuario
// DELETE /api/newsletters/unsubscribes?email=xxx — reactivar
// POST /api/newsletters/unsubscribes — dar de baja manualmente
// ============================================================

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('newsletter_unsubscribes')
    .select(`
      id, email, reason, unsubscribed_at,
      lead:leads(id, company_name, first_name, last_name),
      newsletter:newsletters(id, name)
    `)
    .eq('user_id', user.id)
    .order('unsubscribed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Eliminar de la lista negra
  const { error } = await admin
    .from('newsletter_unsubscribes')
    .delete()
    .eq('email', email)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si hay un newsletter_recipient, quitar el unsubscribed_at y restaurar status
  await admin
    .from('newsletter_recipients')
    .update({ unsubscribed_at: null, status: 'sent' })
    .eq('email', email)
    .eq('user_id', user.id)
    .not('unsubscribed_at', 'is', null)

  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { email, lead_id, reason } = body
  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })

  const admin = createAdminClient()

  const { error } = await admin
    .from('newsletter_unsubscribes')
    .upsert({
      email,
      user_id: user.id,
      lead_id: lead_id ?? null,
      reason: reason ?? 'manual',
      unsubscribed_at: new Date().toISOString(),
    }, { onConflict: 'email,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
