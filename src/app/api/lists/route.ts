import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET  /api/lists  — listar todas las listas del usuario (con count de miembros)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('lead_lists')
    .select('*, lead_list_members(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lists = (data ?? []).map(l => ({
    ...l,
    member_count: (l.lead_list_members as unknown as { count: number }[])?.[0]?.count ?? 0,
    lead_list_members: undefined,
  }))

  return NextResponse.json({ data: lists })
}

// POST /api/lists  — crear una lista
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { name, description, color, icon } = body

  if (!name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const { data, error } = await supabase
    .from('lead_lists')
    .insert({ user_id: user.id, name: name.trim(), description, color, icon })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
