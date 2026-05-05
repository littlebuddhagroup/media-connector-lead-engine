import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST — Aceptar invitación con token
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { token } = await request.json()

  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  // Buscar invitación válida
  const { data: invitation } = await admin
    .from('team_invitations')
    .select('*, team:teams(name)')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invitation) {
    return NextResponse.json({ error: 'Invitación inválida o caducada' }, { status: 404 })
  }

  // Verificar que el email del usuario coincide
  const { data: userData } = await admin.auth.admin.getUserById(user.id)
  const userEmail = userData?.user?.email?.toLowerCase() ?? ''

  if (userEmail !== invitation.invited_email.toLowerCase()) {
    return NextResponse.json({
      error: `Esta invitación es para ${invitation.invited_email}. Estás logueado como ${userEmail}.`
    }, { status: 403 })
  }

  // Verificar que no está ya en un equipo
  const { data: existingMembership } = await admin
    .from('team_members')
    .select('id, team_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existingMembership) {
    if (existingMembership.team_id === invitation.team_id) {
      return NextResponse.json({ error: 'Ya eres miembro de este equipo' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Ya perteneces a otro equipo. Sal de él antes de unirte a uno nuevo.' }, { status: 409 })
  }

  // Añadir como miembro
  const { error: memberError } = await admin
    .from('team_members')
    .insert({
      team_id: invitation.team_id,
      user_id: user.id,
      role: 'member',
      status: 'active',
    })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  // Marcar invitación como aceptada
  await admin
    .from('team_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id)

  return NextResponse.json({
    data: {
      ok: true,
      team_name: (invitation.team as { name?: string })?.name ?? 'el equipo',
    }
  })
}

// GET — Validar token sin aceptar (para mostrar info de la invitación)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const admin = createAdminClient()

  const { data: invitation } = await admin
    .from('team_invitations')
    .select('invited_email, status, expires_at, team:teams(name)')
    .eq('token', token)
    .single()

  if (!invitation) return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })

  const expired = invitation.status !== 'pending' || new Date(invitation.expires_at) < new Date()

  return NextResponse.json({
    data: {
      invited_email: invitation.invited_email,
      team_name: (invitation.team as { name?: string })?.name ?? '',
      status: invitation.status,
      expired,
    }
  })
}
