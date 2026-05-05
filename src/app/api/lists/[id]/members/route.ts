import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/lists/[id]/members  — añadir leads a la lista
// Body: { lead_ids: string[] }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Verificar que la lista pertenece al usuario
  const { data: list } = await supabase
    .from('lead_lists')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!list) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })

  const body = await request.json()
  const lead_ids: string[] = body.lead_ids ?? []
  if (!lead_ids.length) return NextResponse.json({ added: 0 })

  const rows = lead_ids.map(lid => ({ list_id: params.id, lead_id: lid }))

  const { error } = await supabase
    .from('lead_list_members')
    .upsert(rows, { onConflict: 'list_id,lead_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: lead_ids.length })
}

// DELETE /api/lists/[id]/members — quitar leads de la lista
// Body: { lead_ids: string[] }
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: list } = await supabase
    .from('lead_lists')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!list) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })

  const body = await request.json()
  const lead_ids: string[] = body.lead_ids ?? []

  const { error } = await supabase
    .from('lead_list_members')
    .delete()
    .eq('list_id', params.id)
    .in('lead_id', lead_ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ removed: lead_ids.length })
}
