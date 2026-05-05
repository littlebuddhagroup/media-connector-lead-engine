import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Detectar si el usuario pertenece a un equipo para ampliar visibilidad
  const { data: teamMembership } = await admin
    .from('team_members')
    .select('team_id, team:teams(owner_id)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  const visibleUserIds: string[] = [user.id]
  if (teamMembership?.team) {
    const ownerId = (teamMembership.team as { owner_id: string }).owner_id
    if (ownerId && ownerId !== user.id) visibleUserIds.push(ownerId)
  }

  const [leadRes, enrichmentRes] = await Promise.all([
    admin
      .from('leads')
      .select(`
        *,
        campaign:campaigns(id, name, status),
        messages(*),
        emails(*),
        notes(*),
        tasks(*),
        activity_logs(*)
      `)
      .eq('id', id)
      .in('user_id', visibleUserIds)
      .single(),
    // Query separada para enrichment: siempre coge el más reciente
    admin
      .from('lead_enrichments')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (leadRes.error) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  // Combinar: enrichment como array para compatibilidad con el frontend
  const data = {
    ...leadRes.data,
    enrichment: enrichmentRes.data ? [enrichmentRes.data] : [],
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Obtener estado actual para log de actividad
  const { data: current } = await supabase
    .from('leads')
    .select('status, campaign_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const body = await request.json()
  const { data, error } = await supabase
    .from('leads')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log si cambió el status
  if (body.status && current?.status !== body.status) {
    await supabase.from('activity_logs').insert({
      lead_id: id,
      user_id: user.id,
      campaign_id: current?.campaign_id,
      type: 'status_changed',
      title: `Estado cambiado a "${body.status}"`,
      description: `Anterior: ${current?.status}`,
      metadata: { from: current?.status, to: body.status },
    })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { error } = await supabase
    .from('leads').delete().eq('id', id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'Lead eliminado' })
}
