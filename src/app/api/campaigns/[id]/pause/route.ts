import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// POST /api/campaigns/[id]/pause
// Body: { action: 'pause' | 'resume' }
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { action } = await request.json() as { action: 'pause' | 'resume' }
  if (action !== 'pause' && action !== 'resume') {
    return NextResponse.json({ error: 'Acción inválida. Usa "pause" o "resume"' }, { status: 400 })
  }

  // Verificar que la campaña existe y el usuario tiene acceso (RLS lo garantiza)
  const { data: campaign, error: campError } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', id)
    .single()

  if (campError || !campaign) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (action === 'pause') {
    if (campaign.status === 'paused') {
      return NextResponse.json({ error: 'La campaña ya está pausada' }, { status: 400 })
    }

    // 1. Pausar la campaña
    await supabase
      .from('campaigns')
      .update({ status: 'paused', updated_at: now })
      .eq('id', id)

    // 2. Pausar todas las secuencias activas de esta campaña
    //    Guardamos paused_reason = 'campaign_paused' para distinguirlas
    //    de las pausadas por respuesta del lead
    const { data: pausedSeqs } = await admin
      .from('sequences')
      .update({ status: 'paused', paused_reason: 'campaign_paused', updated_at: now })
      .eq('campaign_id', id)
      .eq('status', 'active')
      .select('id')

    // 3. Log de actividad
    await admin.from('activity_logs').insert({
      lead_id: null,
      user_id: user.id,
      campaign_id: id,
      type: 'status_changed',
      title: 'Campaña pausada',
      description: `${pausedSeqs?.length ?? 0} secuencias pausadas`,
      metadata: { from: campaign.status, to: 'paused', sequences_paused: pausedSeqs?.length ?? 0 },
    })

    return NextResponse.json({
      message: 'Campaña pausada',
      sequences_paused: pausedSeqs?.length ?? 0,
    })
  }

  // action === 'resume'
  if (campaign.status !== 'paused') {
    return NextResponse.json({ error: 'La campaña no está pausada' }, { status: 400 })
  }

  // 1. Reanudar la campaña
  await supabase
    .from('campaigns')
    .update({ status: 'active', updated_at: now })
    .eq('id', id)

  // 2. Reanudar SOLO las secuencias que fueron pausadas por esta campaña
  //    (no tocamos las pausadas por respuesta del lead)
  const { data: resumedSeqs } = await admin
    .from('sequences')
    .update({ status: 'active', paused_reason: null, updated_at: now })
    .eq('campaign_id', id)
    .eq('status', 'paused')
    .eq('paused_reason', 'campaign_paused')
    .select('id')

  // 3. Log de actividad
  await admin.from('activity_logs').insert({
    lead_id: null,
    user_id: user.id,
    campaign_id: id,
    type: 'status_changed',
    title: 'Campaña reanudada',
    description: `${resumedSeqs?.length ?? 0} secuencias reactivadas`,
    metadata: { from: 'paused', to: 'active', sequences_resumed: resumedSeqs?.length ?? 0 },
  })

  return NextResponse.json({
    message: 'Campaña reanudada',
    sequences_resumed: resumedSeqs?.length ?? 0,
  })
}
