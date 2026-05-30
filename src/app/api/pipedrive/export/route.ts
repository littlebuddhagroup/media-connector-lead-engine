// ============================================================
// PIPEDRIVE EXPORT — Exportar leads de la app hacia Pipedrive
// POST /api/pipedrive/export
//
// Body: {
//   lead_ids?: string[]     — IDs específicos (vacío = exportar todos)
//   campaign_id?: string    — Exportar leads de una campaña
//   stage_id?: number       — Stage de Pipedrive donde crear los deals
//   add_notes?: boolean     — Añadir nota con fit score y estado
//   overwrite?: boolean     — Si true, actualiza deals ya exportados
// }
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exportToPipedrive } from '@/services/pipedriveService'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Verificar API key
  const { data: integration } = await supabase
    .from('api_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('provider', 'pipedrive')
    .single()

  if (!integration?.api_key) {
    return NextResponse.json({ error: 'Pipedrive no está conectado. Añade tu API token en Configuración → Pipedrive.' }, { status: 400 })
  }

  const body = await request.json()
  const {
    lead_ids,
    campaign_id,
    stage_id,
    add_notes = true,
  } = body

  // Construir query de leads a exportar
  let query = supabase
    .from('leads')
    .select('id, company_name, first_name, last_name, email, phone, website, sector, country, score, status, priority')

  if (lead_ids?.length) {
    query = query.in('id', lead_ids)
  } else if (campaign_id) {
    query = query.eq('campaign_id', campaign_id)
  } else {
    // Sin filtro: exportar leads activos (no descartados, con email)
    query = query
      .not('status', 'eq', 'discarded')
      .not('email', 'is', null)
      .limit(100)
  }

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ error: 'No se encontraron leads para exportar' }, { status: 400 })

  // Exportar a Pipedrive
  const exportResult = await exportToPipedrive(
    integration.api_key,
    leads,
    { stage_id, add_notes }
  )

  // Registrar actividad
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    campaign_id: campaign_id ?? null,
    type: 'export',
    title: `Exportados ${exportResult.exported} leads a Pipedrive`,
    description: `${exportResult.skipped} omitidos. ${exportResult.errors} errores.`,
    metadata: { source: 'pipedrive', direction: 'export', total: leads.length, exported: exportResult.exported },
  })

  return NextResponse.json({
    ok: true,
    exported: exportResult.exported,
    skipped: exportResult.skipped,
    errors: exportResult.errors,
    pipedrive_ids: exportResult.pipedrive_ids,
    message: `Se exportaron ${exportResult.exported} leads a Pipedrive como deals. ${exportResult.errors} errores.`,
  })
}
