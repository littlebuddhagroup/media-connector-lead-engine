import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET — detalle de newsletter con recipients
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('newsletters')
    .select(`
      *,
      newsletter_recipients(id, email, name, status, sent_at, opened_at, open_count, lead_id)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: 'Newsletter no encontrado' }, { status: 404 })
  return NextResponse.json({ data })
}

// PATCH — actualizar newsletter (solo si está en draft/scheduled)
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()

  // Verificar estado actual
  const { data: current } = await supabase
    .from('newsletters')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!current) return NextResponse.json({ error: 'Newsletter no encontrado' }, { status: 404 })
  if (['sending', 'sent'].includes(current.status)) {
    return NextResponse.json({ error: 'No se puede editar un newsletter ya enviado' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('newsletters')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE — borrar newsletter (solo drafts)
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: current } = await supabase
    .from('newsletters')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (current.status === 'sending') {
    return NextResponse.json({ error: 'No se puede borrar un newsletter en envío' }, { status: 409 })
  }

  await supabase.from('newsletter_recipients').delete().eq('newsletter_id', id)
  const { error } = await supabase.from('newsletters').delete().eq('id', id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
