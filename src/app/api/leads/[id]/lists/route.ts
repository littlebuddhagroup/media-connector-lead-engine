import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

// GET /api/leads/[id]/lists — listas a las que pertenece el lead
export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('lead_list_members')
    .select('list_id, lead_lists(id, name, color, icon)')
    .eq('lead_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/leads/[id]/lists — añadir el lead a una lista
// Body: { list_id: string }
export async function POST(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { list_id } = await request.json()
  if (!list_id) return NextResponse.json({ error: 'list_id es obligatorio' }, { status: 400 })

  // Verificar que la lista pertenece al usuario
  const { data: list } = await supabase
    .from('lead_lists')
    .select('id')
    .eq('id', list_id)
    .eq('user_id', user.id)
    .single()

  if (!list) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })

  const { error } = await supabase
    .from('lead_list_members')
    .upsert({ list_id, lead_id: params.id }, { onConflict: 'list_id,lead_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/leads/[id]/lists — quitar el lead de una lista
// Body: { list_id: string }
export async function DELETE(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { list_id } = await request.json()
  if (!list_id) return NextResponse.json({ error: 'list_id es obligatorio' }, { status: 400 })

  const { error } = await supabase
    .from('lead_list_members')
    .delete()
    .eq('list_id', list_id)
    .eq('lead_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
