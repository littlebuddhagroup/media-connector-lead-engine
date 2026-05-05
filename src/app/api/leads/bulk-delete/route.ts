import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// LEADS — Eliminación masiva
// DELETE /api/leads/bulk-delete  { lead_ids: string[] }
// ============================================================

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const lead_ids: string[] = body?.lead_ids ?? []

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return NextResponse.json({ error: 'lead_ids debe ser un array no vacío' }, { status: 400 })
  }

  if (lead_ids.length > 500) {
    return NextResponse.json({ error: 'No se pueden eliminar más de 500 leads a la vez' }, { status: 400 })
  }

  // Verificar que todos los leads pertenecen al usuario antes de eliminar
  const { data: owned, error: checkError } = await supabase
    .from('leads')
    .select('id')
    .in('id', lead_ids)
    .eq('user_id', user.id)

  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 })
  }

  const ownedIds = (owned ?? []).map((l: { id: string }) => l.id)

  if (ownedIds.length === 0) {
    return NextResponse.json({ error: 'No se encontraron leads válidos para eliminar' }, { status: 404 })
  }

  const { error: deleteError } = await supabase
    .from('leads')
    .delete()
    .in('id', ownedIds)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: ownedIds.length,
    skipped: lead_ids.length - ownedIds.length,
  })
}
