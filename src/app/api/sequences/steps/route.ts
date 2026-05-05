import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// SEQUENCE STEPS — Editar contenido y programación de un paso
// ============================================================

// PATCH — Actualizar subject, body y/o scheduled_for de un paso
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { step_id, subject, body, scheduled_for } = await request.json()

  if (!step_id) {
    return NextResponse.json({ error: 'step_id es requerido' }, { status: 400 })
  }

  // Verificar que el paso pertenece al usuario
  const { data: step } = await supabase
    .from('sequence_steps')
    .select('id, user_id, status')
    .eq('id', step_id)
    .eq('user_id', user.id)
    .single()

  if (!step) {
    return NextResponse.json({ error: 'Paso no encontrado' }, { status: 404 })
  }

  if (step.status === 'sent') {
    return NextResponse.json({ error: 'No se puede editar un paso ya enviado' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (subject !== undefined) updateData.subject = subject
  if (body !== undefined) updateData.body = body
  if (scheduled_for !== undefined) updateData.scheduled_for = scheduled_for

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sequence_steps')
    .update(updateData)
    .eq('id', step_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
