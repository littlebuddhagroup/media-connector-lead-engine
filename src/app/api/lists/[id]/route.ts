import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/lists/[id] — editar nombre/color/icon
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { name, description, color, icon } = body

  const { data, error } = await supabase
    .from('lead_lists')
    .update({ name, description, color, icon, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/lists/[id]?delete_leads=true
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const deleteLeads = searchParams.get('delete_leads') === 'true'

  if (deleteLeads) {
    // Obtener los lead_ids de los miembros de esta lista
    const { data: members } = await supabase
      .from('lead_list_members')
      .select('lead_id')
      .eq('list_id', params.id)

    const leadIds = (members ?? []).map((m: { lead_id: string }) => m.lead_id).filter(Boolean)

    if (leadIds.length > 0) {
      const { error: leadsErr } = await supabase
        .from('leads')
        .delete()
        .in('id', leadIds)
        .eq('user_id', user.id)

      if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })
    }
  }

  // Borrar la lista (cascade borra lead_list_members automáticamente)
  const { error } = await supabase
    .from('lead_lists')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted_leads: deleteLeads })
}
