// ============================================================
// PIPEDRIVE PIPELINES — Obtener pipelines y stages disponibles
// GET /api/pipedrive/pipelines  → Lista de pipelines
// GET /api/pipedrive/pipelines?pipeline_id=X → Stages del pipeline
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPipedriveClient } from '@/services/pipedriveService'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: integration } = await supabase
    .from('api_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('provider', 'pipedrive')
    .single()

  if (!integration?.api_key) {
    return NextResponse.json({ error: 'Pipedrive no conectado' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const pipelineId = searchParams.get('pipeline_id') ? Number(searchParams.get('pipeline_id')) : undefined

  const client = await getPipedriveClient(integration.api_key)

  if (pipelineId) {
    const stages = await client.getStages(pipelineId)
    return NextResponse.json({ data: stages })
  }

  const pipelines = await client.getPipelines()
  return NextResponse.json({ data: pipelines })
}
