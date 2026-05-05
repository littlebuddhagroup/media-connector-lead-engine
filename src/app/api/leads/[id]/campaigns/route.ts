import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET — Campañas a las que pertenece este lead
// Combina: leads.campaign_id (directo) + campaign_leads (junction, si existe)
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Obtener el lead para ver su campaign_id directo
  const { data: lead } = await admin
    .from('leads')
    .select('campaign_id')
    .eq('id', id)
    .single()

  const seen = new Set<string>()
  const result: Array<{ campaign_id: string; campaign: { id: string; name: string; status: string } }> = []

  // Fuente 1: campaign_id directo en leads
  if (lead?.campaign_id) {
    const { data: camp } = await admin
      .from('campaigns')
      .select('id, name, status')
      .eq('id', lead.campaign_id)
      .single()
    if (camp) {
      seen.add(camp.id)
      result.push({ campaign_id: camp.id, campaign: camp })
    }
  }

  // Fuente 2: campaign_leads junction (si la tabla existe)
  try {
    const { data: junctionRows, error } = await admin
      .from('campaign_leads')
      .select('campaign_id, campaign:campaigns(id, name, status)')
      .eq('lead_id', id)
      .order('added_at', { ascending: false })

    if (!error && junctionRows) {
      for (const row of junctionRows) {
        const r = row as { campaign_id: string; campaign: { id: string; name: string; status: string } | null }
        if (r.campaign && !seen.has(r.campaign_id)) {
          seen.add(r.campaign_id)
          result.push({ campaign_id: r.campaign_id, campaign: r.campaign })
        }
      }
    }
  } catch { /* campaign_leads no existe aún */ }

  return NextResponse.json({ data: result })
}

// POST — Añadir este lead a una campaña
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { campaign_id } = await request.json()
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id requerido' }, { status: 400 })

  // Verificar que la campaña existe
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id, name')
    .eq('id', campaign_id)
    .single()
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  // Intentar insertar en campaign_leads (si la tabla existe)
  let usedJunction = false
  try {
    const { error } = await admin
      .from('campaign_leads')
      .upsert(
        { campaign_id, lead_id: id, user_id: user.id, added_by: user.id },
        { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true }
      )
    if (!error) usedJunction = true
  } catch { /* tabla no existe, usar fallback */ }

  // Fallback: actualizar campaign_id en leads (solo si junction falló)
  if (!usedJunction) {
    const { error } = await admin
      .from('leads')
      .update({ campaign_id })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.from('activity_logs').insert({
    lead_id: id,
    user_id: user.id,
    campaign_id,
    type: 'campaign_assigned',
    title: `Añadido a campaña: ${campaign.name}`,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE — Quitar este lead de una campaña
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { campaign_id } = await request.json()
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id requerido' }, { status: 400 })

  // Intentar borrar de campaign_leads (si la tabla existe)
  let usedJunction = false
  try {
    const { error } = await admin
      .from('campaign_leads')
      .delete()
      .eq('campaign_id', campaign_id)
      .eq('lead_id', id)
    if (!error) usedJunction = true
  } catch { /* tabla no existe */ }

  // Fallback: limpiar campaign_id directo si es la misma campaña
  if (!usedJunction) {
    const { data: lead } = await admin
      .from('leads').select('campaign_id').eq('id', id).single()
    if (lead?.campaign_id === campaign_id) {
      await admin.from('leads').update({ campaign_id: null }).eq('id', id)
    }
  }

  return NextResponse.json({ ok: true })
}
