import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getTeamUserIds } from '@/lib/teams'

// Endpoint ligero que devuelve solo los IDs de leads que coinciden con los filtros.
// Pagina internamente para superar el límite de 1000 filas de PostgREST.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const campaign_id = searchParams.get('campaign_id')
  const status      = searchParams.get('status')
  const priority    = searchParams.get('priority')
  const search      = searchParams.get('search')
  const sector      = searchParams.get('sector')
  const country     = searchParams.get('country')
  const tag         = searchParams.get('tag')
  const list_id     = searchParams.get('list_id')
  const sort_by     = searchParams.get('sort_by') ?? 'created_at'
  const sort_order  = searchParams.get('sort_order') ?? 'desc'

  const teamUserIds = await getTeamUserIds(user.id)
  const admin = createAdminClient()

  // Resolver IDs de lista
  let listLeadIds: string[] | null = null
  if (list_id) {
    const { data: members } = await admin
      .from('lead_list_members').select('lead_id').eq('list_id', list_id)
    listLeadIds = (members ?? []).map((m: { lead_id: string }) => m.lead_id)
    if (listLeadIds!.length === 0) return NextResponse.json({ ids: [] })
  }

  // Resolver IDs de campaña
  let campaignLeadIds: string[] | null = null
  if (campaign_id) {
    const directRes = await admin
      .from('leads').select('id').eq('campaign_id', campaign_id).in('user_id', teamUserIds)
    const directIds = (directRes.data ?? []).map((r: { id: string }) => r.id)
    let junctionIds: string[] = []
    try {
      const junctionRes = await admin
        .from('campaign_leads').select('lead_id').eq('campaign_id', campaign_id)
      if (!junctionRes.error) {
        junctionIds = (junctionRes.data ?? []).map((r: { lead_id: string }) => r.lead_id)
      }
    } catch { /* tabla no existe */ }
    campaignLeadIds = [...new Set([...directIds, ...junctionIds])]
    if (campaignLeadIds.length === 0) return NextResponse.json({ ids: [] })
  }

  // Paginar de 1000 en 1000 para superar el límite de PostgREST
  const CHUNK = 1000
  const allIds: string[] = []
  let offset = 0

  while (true) {
    let query = admin
      .from('leads')
      .select('id')
      .in('user_id', teamUserIds)

    if (campaignLeadIds != null) query = query.in('id', campaignLeadIds)
    if (listLeadIds != null)     query = query.in('id', listLeadIds)
    if (status)                  query = query.eq('status', status)
    if (priority)                query = query.eq('priority', priority)
    if (sector)                  query = query.ilike('sector', `%${sector}%`)
    if (country)                 query = query.ilike('country', `%${country}%`)
    if (tag)                     query = query.contains('tags', [tag])
    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,email.ilike.%${search}%,domain.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
      )
    }

    query = query.order(sort_by, { ascending: sort_order === 'asc' })
    query = query.range(offset, offset + CHUNK - 1)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break

    allIds.push(...data.map((r: { id: string }) => r.id))
    if (data.length < CHUNK) break
    offset += CHUNK
  }

  return NextResponse.json({ ids: allIds })
}
