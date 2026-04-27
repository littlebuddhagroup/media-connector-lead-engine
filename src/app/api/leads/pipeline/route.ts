import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/leads/pipeline — Actualizar estado de lead desde el Kanban
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { lead_id, status } = await request.json()
  if (!lead_id || !status) {
    return NextResponse.json({ error: 'lead_id y status son requeridos' }, { status: 400 })
  }

  const VALID_STATUSES = ['new', 'contacted', 'interested', 'meeting_scheduled', 'closed', 'not_interested']
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status inválido. Válidos: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', lead_id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar el cambio en activity_logs
  await supabase.from('activity_logs').insert({
    lead_id,
    user_id: user.id,
    type: 'status_changed',
    title: `Estado actualizado a "${status}"`,
    description: 'Movido desde el pipeline Kanban',
  })

  return NextResponse.json({ data })
}

// GET /api/leads/pipeline — Obtener leads agrupados por estado para el Kanban
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaign_id')

  let query = supabase
    .from('leads')
    .select('id, company_name, email, sector, country, status, priority, score, website, updated_at, campaign_id')
    .eq('user_id', user.id)
    .not('status', 'in', '("discarded")')
    .order('score', { ascending: false })

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
