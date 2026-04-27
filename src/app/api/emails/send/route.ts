import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/services/emailService'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Resend API Key no configurada. Ve a Configuración.' }, { status: 400 })
  }

  const body = await request.json()
  const { lead_id, to_email, to_name, subject, email_body, message_id, campaign_id } = body

  if (!lead_id || !to_email || !subject || !email_body) {
    return NextResponse.json(
      { error: 'lead_id, to_email, subject y email_body son requeridos' },
      { status: 400 }
    )
  }

  try {
    const result = await sendEmail(
      { lead_id, to_email, to_name, subject, body: email_body, message_id },
      user.id,
      campaign_id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ data: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error enviando email'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
