import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { extractDomain } from '@/lib/utils'
import { getTeamUserIds } from '@/lib/teams'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const campaign_id = searchParams.get('campaign_id')
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const search = searchParams.get('search')
  const sector = searchParams.get('sector')
  const country = searchParams.get('country')
  const tag = searchParams.get('tag')
  const list_id = searchParams.get('list_id')
  const score_min = searchParams.get('score_min')
  const score_max = searchParams.get('score_max')
  const page = parseInt(searchParams.get('page') ?? '1')
  const per_page = parseInt(searchParams.get('per_page') ?? '25')
  const sort_by = searchParams.get('sort_by') ?? 'created_at'
  const sort_order = searchParams.get('sort_order') ?? 'desc'

  // Incluir leads de compañeros de equipo
  const teamUserIds = await getTeamUserIds(user.id)
  const admin = createAdminClient()

  // Si filtramos por lista, primero obtenemos los lead_ids de esa lista
  let listLeadIds: string[] | null = null
  if (list_id) {
    const { data: members } = await admin
      .from('lead_list_members')
      .select('lead_id')
      .eq('list_id', list_id)
    listLeadIds = (members ?? []).map((m: { lead_id: string }) => m.lead_id)
    // Si la lista está vacía, retornamos directamente sin hacer la query completa
    if (listLeadIds!.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, per_page, total_pages: 0 })
    }
  }

  // Si filtramos por campaña, combinamos las dos fuentes de verdad:
  // 1. leads con campaign_id directo (datos existentes)
  // 2. campaign_leads junction table (datos many-to-many nuevos)
  let campaignLeadIds: string[] | null = null
  if (campaign_id) {
    // Fuente 1: leads con campaign_id directo (siempre disponible)
    const directRes = await admin
      .from('leads').select('id').eq('campaign_id', campaign_id).in('user_id', teamUserIds)
    const directIds = (directRes.data ?? []).map((r: { id: string }) => r.id)

    // Fuente 2: campaign_leads junction (si existe la tabla)
    let junctionIds: string[] = []
    try {
      const junctionRes = await admin
        .from('campaign_leads').select('lead_id').eq('campaign_id', campaign_id)
      if (!junctionRes.error) {
        junctionIds = (junctionRes.data ?? []).map((r: { lead_id: string }) => r.lead_id)
      }
    } catch { /* tabla aún no existe */ }

    campaignLeadIds = [...new Set([...directIds, ...junctionIds])]
    if (campaignLeadIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, per_page, total_pages: 0 })
    }
  }

  let query = admin
    .from('leads')
    .select('*, campaign:campaigns(id,name)', { count: 'exact' })
    .in('user_id', teamUserIds)

  if (campaignLeadIds != null) query = query.in('id', campaignLeadIds)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (sector) query = query.ilike('sector', `%${sector}%`)
  if (country) query = query.ilike('country', `%${country}%`)
  if (score_min) query = query.gte('score', parseInt(score_min))
  if (score_max) query = query.lte('score', parseInt(score_max))
  if (tag) query = query.contains('tags', [tag])
  if (listLeadIds != null) query = query.in('id', listLeadIds)
  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,email.ilike.%${search}%,domain.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    )
  }

  query = query.order(sort_by, { ascending: sort_order === 'asc' })
  const from = (page - 1) * per_page
  query = query.range(from, from + per_page - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    per_page,
    total_pages: Math.ceil((count ?? 0) / per_page),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  if (!body.company_name?.trim()) {
    return NextResponse.json({ error: 'El nombre de empresa es requerido' }, { status: 400 })
  }

  const domain = body.domain || extractDomain(body.website)

  const { data, error } = await supabase
    .from('leads')
    .insert({ ...body, domain, user_id: user.id, source: body.source ?? 'manual' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar creación
  await supabase.from('activity_logs').insert({
    lead_id: data.id,
    user_id: user.id,
    campaign_id: body.campaign_id,
    type: 'lead_created',
    title: `Lead creado: ${data.company_name}`,
    description: `Fuente: ${body.source ?? 'manual'}`,
  })

  const shouldEnrich = Boolean(data.domain || data.website)
  return NextResponse.json({ data, shouldEnrich }, { status: 201 })
}
