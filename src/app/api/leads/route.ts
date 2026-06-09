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

  // ── Select con INNER JOINs según filtros activos ────────────────────────
  // Usamos !inner para evitar URL overflow que ocurre con .in('id', [N+ UUIDs]).
  // PostgREST hace el JOIN en el servidor y la paginación funciona correctamente.
  const joins: string[] = []
  if (list_id)     joins.push('_llm:lead_list_members!inner(list_id)')
  if (campaign_id) joins.push('_cl:campaign_leads!inner(campaign_id)')
  const selectStr = ['*', 'campaign:campaigns(id,name)', ...joins].join(', ')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = admin
    .from('leads')
    .select(selectStr, { count: 'exact' })
    .in('user_id', teamUserIds)

  if (list_id)     query = query.eq('_llm.list_id', list_id)
  if (campaign_id) query = query.eq('_cl.campaign_id', campaign_id)
  if (status)            query = query.eq('status', status)
  if (priority)          query = query.eq('priority', priority)
  if (sector)            query = query.ilike('sector', `%${sector}%`)
  if (country)           query = query.ilike('country', `%${country}%`)
  if (score_min)         query = query.gte('score', parseInt(score_min))
  if (score_max)         query = query.lte('score', parseInt(score_max))
  if (tag)               query = query.contains('tags', [tag])
  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,email.ilike.%${search}%,domain.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    )
  }

  query = query.order(sort_by, { ascending: sort_order === 'asc' })
  const from = (page - 1) * per_page
  query = query.range(from, from + per_page - 1)

  const { data, error, count } = await query
  if (error) {
    console.error('[GET /api/leads] query error:', error.message, { list_id, campaign_id })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Eliminar campos auxiliares de los JOINs antes de devolver
  const returnData = (list_id || campaign_id)
    ? (data ?? []).map((row: Record<string, unknown>) => {
        delete row._llm
        delete row._cl
        return row
      })
    : (data ?? [])

  return NextResponse.json({
    data: returnData,
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
