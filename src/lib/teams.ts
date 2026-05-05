import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// Devuelve todos los user_id del equipo al que pertenece el usuario (incluido él mismo)
export async function getTeamUserIds(userId: string): Promise<string[]> {
  const supabase = createAdminClient()

  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (!membership) return [userId]

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', membership.team_id)
    .eq('status', 'active')

  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id)
  return ids.length > 0 ? ids : [userId]
}

// Devuelve el equipo del usuario (si tiene uno)
export async function getUserTeam(userId: string) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('team_members')
    .select(`
      role,
      team:teams(
        id, name, owner_id, created_at,
        team_members(
          id, user_id, role, status, created_at
        ),
        team_invitations(
          id, invited_email, status, expires_at, created_at
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  return data
}
