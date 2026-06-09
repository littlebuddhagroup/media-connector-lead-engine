import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getTeamUserIds } from '@/lib/teams'

type Params = { params: Promise<{ id: string }> }

// GET — Leads disponibles para asignar (no están ya en esta campaña)
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''

  const teamIds = await getTeamUserIds(user.id)
  const admin = createAdminClient()

  // Obtener lead_ids ya asignados a esta campaña (ambas fuentes: junction + campo directo)
  const [junctionRes, directRes] = await Promise.all([
    admin.from('campaign_leads').select('lead_id').eq('campaign_id', id),
    admin.from('leads').select('id').eq('campaign_id', id).in('user_id', teamIds),
  ])
  const existingIds = [
    ...(junctionRes.data ?? []).map((r: { lead_id: string }) => r.lead_id),
    ...(directRes.data ?? []).map((r: { id: string }) => r.id),
  ]
  const uniqueExistingIds = [...new Set(existingIds)]

  let query = admin
    .from('leads')
    .select('id, company_name, email, status, score, sector')
    .in('user_id', teamIds)
    .order('score', { ascending: false })
    .limit(200)

  // Excluir los que ya están en la campaña (por cualquier vía)
  if (uniqueExistingIds.length > 0) {
    query = query.not('id', 'in', `(${uniqueExistingIds.join(',')})`
    )
  }

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — Asignar leads a esta campaña (many-to-many via campaign_leads)
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { lead_ids } = await request.json()

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return NextResponse.json({ error: 'lead_ids array requerido' }, { status: 400 })
  }

  // Verificar que la campaña existe
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  const teamIds = await getTeamUserIds(user.id)

  // Verificar que los leads pertenecen al equipo
  const { data: validLeads } = await admin
    .from('leads')
    .select('id')
    .in('id', lead_ids)
    .in('user_id', teamIds)

  const validIds = (validLeads ?? []).map((l: { id: string }) => l.id)
  if (validIds.length === 0) {
    return NextResponse.json({ error: 'No se encontraron leads válidos' }, { status: 400 })
  }

  // Insertar en campaign_leads (ignorar duplicados)
  const inserts = validIds.map((lid: string) => ({
    campaign_id: id,
    lead_id: lid,
    user_id: user.id,
  }))

  const { error } = await admin
    .from('campaign_leads')
    .upsert(inserts, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar actividad
  await admin.from('activity_logs').insert(
    validIds.map((lid: string) => ({
      lead_id: lid,
      user_id: user.id,
      campaign_id: id,
      type: 'campaign_assigned',
      title: `Asignado a campaña: ${campaign.name}`,
    }))
  )

  return NextResponse.json({ data: { assigned: validIds.length } })
}

// DELETE — Quitar leads de esta campaña (solo desvincula, no borra el lead)
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { lead_ids } = await request.json()

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return NextResponse.json({ error: 'lead_ids array requerido' }, { status: 400 })
  }

  // Quitar de junction table
  const { error: junctionError } = await admin
    .from('campaign_leads')
    .delete()
    .eq('campaign_id', id)
    .in('lead_id', lead_ids)

  if (junctionError) return NextResponse.json({ error: junctionError.message }, { status: 500 })

  // También resetear campaign_id directo en los leads (en lotes de 500)
  const CHUNK = 500
  for (let i = 0; i < lead_ids.length; i += CHUNK) {
    const chunk = lead_ids.slice(i, i + CHUNK)
    await admin
      .from('leads')
      .update({ campaign_id: null })
      .eq('campaign_id', id)
      .in('id', chunk)
  }

  return NextResponse.json({ data: { removed: lead_ids.length } })
}
