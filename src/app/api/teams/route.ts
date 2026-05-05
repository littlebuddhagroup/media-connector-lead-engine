import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET — Obtener equipo del usuario
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('team_members')
    .select(`
      id, role,
      team:teams(
        id, name, owner_id, created_at,
        team_members(id, user_id, role, status, created_at),
        team_invitations(id, invited_email, status, expires_at, created_at)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  // Obtener emails de los miembros via auth.users
  if (membership?.team) {
    const team = membership.team as Record<string, unknown>
    const members = (team.team_members as { user_id: string }[]) ?? []
    const memberIds = members.map(m => m.user_id)

    if (memberIds.length > 0) {
      const { data: usersData } = await admin.auth.admin.listUsers()
      const emailMap: Record<string, string> = {}
      ;(usersData?.users ?? []).forEach((u: { id: string; email?: string }) => {
        if (memberIds.includes(u.id)) emailMap[u.id] = u.email ?? ''
      })

      team.team_members = members.map(m => ({
        ...m,
        email: emailMap[m.user_id] ?? '',
        is_me: m.user_id === user.id,
      }))
    }
  }

  return NextResponse.json({ data: membership ?? null })
}

// POST — Crear equipo
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Verificar que no tiene ya equipo
  const { data: existing } = await admin
    .from('team_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ya perteneces a un equipo. Sal del equipo actual primero.' }, { status: 409 })
  }

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'El nombre del equipo es requerido' }, { status: 400 })

  // Crear equipo
  const { data: team, error: teamError } = await admin
    .from('teams')
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single()

  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 })

  // Añadir al creador como owner
  await admin.from('team_members').insert({
    team_id: team.id,
    user_id: user.id,
    role: 'owner',
    status: 'active',
  })

  return NextResponse.json({ data: team }, { status: 201 })
}

// DELETE — Salir del equipo (o disolver si eres owner)
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('team_members')
    .select('id, role, team_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return NextResponse.json({ error: 'No perteneces a ningún equipo' }, { status: 404 })

  if (membership.role === 'owner') {
    // El owner disuelve el equipo entero
    await admin.from('teams').delete().eq('id', membership.team_id)
  } else {
    // Los miembros simplemente salen
    await admin.from('team_members').update({ status: 'inactive' })
      .eq('id', membership.id)
  }

  return NextResponse.json({ data: { ok: true } })
}
