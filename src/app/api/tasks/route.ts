import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { lead_id, title, description, due_date, priority, campaign_id } = await request.json()
  if (!lead_id || !title?.trim()) {
    return NextResponse.json({ error: 'lead_id y title son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({ lead_id, user_id: user.id, title, description, due_date, priority: priority ?? 'medium', campaign_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    lead_id,
    user_id: user.id,
    type: 'task_created',
    title: `Tarea creada: ${title}`,
  })

  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  if (updates.is_completed) updates.completed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('tasks').update(updates).eq('id', id).eq('user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
