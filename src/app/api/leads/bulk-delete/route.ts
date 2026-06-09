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

  // Procesar en lotes de 500 para evitar limitaciones de Supabase con .in()
  const CHUNK = 500
  const ownedIds: string[] = []

  for (let i = 0; i < lead_ids.length; i += CHUNK) {
    const chunk = lead_ids.slice(i, i + CHUNK)
    const { data: owned, error: checkError } = await supabase
      .from('leads')
      .select('id')
      .in('id', chunk)
      .eq('user_id', user.id)

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }
    ownedIds.push(...(owned ?? []).map((l: { id: string }) => l.id))
  }

  if (ownedIds.length === 0) {
    return NextResponse.json({ error: 'No se encontraron leads válidos para eliminar' }, { status: 404 })
  }

  // Eliminar también en lotes
  for (let i = 0; i < ownedIds.length; i += CHUNK) {
    const chunk = ownedIds.slice(i, i + CHUNK)
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .in('id', chunk)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    deleted: ownedIds.length,
    skipped: lead_ids.length - ownedIds.length,
  })
}
