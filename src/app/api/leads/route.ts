import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractDomain } from '@/lib/utils'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const campaign_id = searchParams.get('campaign_id')
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const per_page = parseInt(searchParams.get('per_page') ?? '25')
  const sort_by = searchParams.get('sort_by') ?? 'created_at'
  const sort_order = searchParams.get('sort_order') ?? 'desc'

  let query = supabase
    .from('leads')
    .select('*, campaign:campaigns(id,name)', { count: 'exact' })
    .eq('user_id', user.id)

  if (campaign_id) query = query.eq('campaign_id', campaign_id)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,email.ilike.%${search}%,domain.ilike.%${search}%`
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

  return NextResponse.json({ data }, { status: 201 })
}
