import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// PATCH — Cambiar rol de un miembro (owner/admin solamente)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { member_user_id, new_role } = await request.json()

  if (!member_user_id || !new_role) {
    return NextResponse.json({ error: 'member_user_id y new_role son requeridos' }, { status: 400 })
  }

  if (!['admin', 'member'].includes(new_role)) {
    return NextResponse.json({ error: 'Rol inválido. Usa "admin" o "member"' }, { status: 400 })
  }

  // Verificar que quien hace la petición es owner del equipo
  const { data: myMembership } = await admin
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!myMembership) return NextResponse.json({ error: 'No perteneces a ningún equipo' }, { status: 403 })
  if (myMembership.role !== 'owner') {
    return NextResponse.json({ error: 'Solo el propietario puede cambiar roles' }, { status: 403 })
  }

  // No permitir cambiar el rol del propio owner
  if (member_user_id === user.id) {
    return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
  }

  // Actualizar rol
  const { error } = await admin
    .from('team_members')
    .update({ role: new_role })
    .eq('team_id', myMembership.team_id)
    .eq('user_id', member_user_id)
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}

// DELETE — Eliminar un miembro del equipo (owner/admin solamente)
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { member_user_id } = await request.json()

  if (!member_user_id) {
    return NextResponse.json({ error: 'member_user_id es requerido' }, { status: 400 })
  }

  // Verificar que quien hace la petición es owner o admin
  const { data: myMembership } = await admin
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!myMembership) return NextResponse.json({ error: 'No perteneces a ningún equipo' }, { status: 403 })
  if (!['owner', 'admin'].includes(myMembership.role)) {
    return NextResponse.json({ error: 'Solo los administradores pueden eliminar miembros' }, { status: 403 })
  }

  // El owner no puede ser eliminado
  if (member_user_id === user.id) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo. Usa "Disolver equipo" en su lugar.' }, { status: 400 })
  }

  // Verificar que el miembro a eliminar no es owner
  const { data: targetMember } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', myMembership.team_id)
    .eq('user_id', member_user_id)
    .eq('status', 'active')
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Miembro no encontrado en el equipo' }, { status: 404 })
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'No puedes eliminar al propietario del equipo' }, { status: 400 })
  }

  // Marcar como inactivo
  const { error } = await admin
    .from('team_members')
    .update({ status: 'inactive' })
    .eq('team_id', myMembership.team_id)
    .eq('user_id', member_user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}
