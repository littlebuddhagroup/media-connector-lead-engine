import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { lead_id, content } = await request.json()
  if (!lead_id || !content?.trim()) {
    return NextResponse.json({ error: 'lead_id y content son requeridos' }, { status: 400 })
  }

  const { data: note, error } = await supabase
    .from('notes')
    .insert({ lead_id, user_id: user.id, content: content.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar actividad
  await supabase.from('activity_logs').insert({
    lead_id,
    user_id: user.id,
    type: 'note_added',
    title: 'Nota añadida',
    description: content.slice(0, 100),
  })

  return NextResponse.json({ data: note }, { status: 201 })
}
