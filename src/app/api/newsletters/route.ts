import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// NEWSLETTERS — CRUD de newsletters
// GET  /api/newsletters         — listar
// POST /api/newsletters         — crear
// ============================================================

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const {
    name, subject, body_html, body_text,
    from_email, from_name, reply_to,
    scheduled_for, target_type, target_list_id, target_filters,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!subject?.trim()) return NextResponse.json({ error: 'Asunto requerido' }, { status: 400 })
  if (!body_html?.trim()) return NextResponse.json({ error: 'Cuerpo del newsletter requerido' }, { status: 400 })

  // Obtener configuración de email del usuario como fallback
  const admin = createAdminClient()
  const { data: settings } = await admin.from('settings')
    .select('email_from_address, email_from_name')
    .eq('user_id', user.id)
    .single()

  const { data, error } = await supabase
    .from('newsletters')
    .insert({
      user_id: user.id,
      name: name.trim(),
      subject: subject.trim(),
      body_html,
      body_text: body_text ?? '',
      from_email: from_email || settings?.email_from_address || '',
      from_name: from_name || settings?.email_from_name || '',
      reply_to: reply_to || '',
      status: scheduled_for ? 'scheduled' : 'draft',
      scheduled_for: scheduled_for || null,
      target_type: target_type || 'all',
      target_list_id: target_list_id || null,
      target_filters: target_filters || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
