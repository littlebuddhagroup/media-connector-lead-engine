import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      leads(id, company_name, status, priority, score, email, created_at)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()

  // Campos que siempre existen en la tabla campaigns
  const coreFields = ['name', 'description', 'status', 'country', 'sector', 'language', 'keywords', 'target_type', 'target_size']
  // Campos de campaigns_v2.sql (pueden no existir si el migration no se ha ejecutado)
  const v2Fields = ['start_date', 'end_date', 'goal_leads', 'goal_meetings', 'goal_replies']

  // Separar campos seguros de campos v2
  const coreUpdate: Record<string, unknown> = {}
  const v2Update: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(body)) {
    if (coreFields.includes(key)) coreUpdate[key] = val
    else if (v2Fields.includes(key)) v2Update[key] = val
  }

  // Primero intentar con todos los campos
  const fullUpdate = { ...coreUpdate, ...v2Update }
  const { data, error } = await supabase
    .from('campaigns')
    .update(fullUpdate)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (!error) return NextResponse.json({ data })

  // Si falla por columnas v2 inexistentes, reintentar solo con campos core
  if (error.message.includes('column') || error.message.includes('schema cache')) {
    const { data: data2, error: error2 } = await supabase
      .from('campaigns')
      .update(coreUpdate)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error2) return NextResponse.json({ error: error2.message }, { status: 500 })
    return NextResponse.json({
      data: data2,
      warning: 'Fechas y objetivos no guardados. Ejecuta supabase/campaigns_v2.sql en Supabase SQL Editor para activar esta funcionalidad.'
    })
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Cascade: borrar pasos y secuencias de la campaña antes de borrarla
  const { data: seqs } = await supabase
    .from('sequences')
    .select('id')
    .eq('campaign_id', id)
    .eq('user_id', user.id)

  if (seqs?.length) {
    const seqIds = seqs.map(s => s.id)
    await supabase.from('sequence_steps').delete().in('sequence_id', seqIds)
    await supabase.from('sequences').delete().in('id', seqIds)
  }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'Campaña eliminada' })
}
