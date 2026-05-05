import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET — Plantillas de secuencia de la campaña
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('sequence_templates')
    .select('*')
    .eq('campaign_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — Crear/actualizar plantilla de secuencia para la campaña
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { name, description, steps } = await request.json()

  if (!name?.trim() || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: 'name y steps son requeridos' }, { status: 400 })
  }

  // Verificar que la campaña es del usuario
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id')
    .eq('id', id)
    .single()
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  // Upsert: si ya hay una plantilla para esta campaña con el mismo nombre, actualizar
  const { data: existing } = await admin
    .from('sequence_templates')
    .select('id')
    .eq('campaign_id', id)
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .maybeSingle()

  let result
  if (existing) {
    const { data, error } = await admin
      .from('sequence_templates')
      .update({ description, steps, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await admin
      .from('sequence_templates')
      .insert({ user_id: user.id, campaign_id: id, name: name.trim(), description, steps })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  return NextResponse.json({ data: result }, { status: 201 })
}

// DELETE — Eliminar plantilla
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { template_id } = await request.json()

  const { error } = await admin
    .from('sequence_templates')
    .delete()
    .eq('id', template_id)
    .eq('user_id', user.id)
    .eq('campaign_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}
