import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

// POST — Invitar a un usuario por email
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { email } = await request.json()

  if (!email?.trim()) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  // Verificar que el usuario tiene equipo y es owner/admin
  const { data: membership } = await admin
    .from('team_members')
    .select('team_id, role, team:teams(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return NextResponse.json({ error: 'No perteneces a ningún equipo' }, { status: 403 })
  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Solo los administradores pueden invitar miembros' }, { status: 403 })
  }

  // Verificar que no está ya en el equipo
  const { data: existingInvite } = await admin
    .from('team_invitations')
    .select('id, status')
    .eq('team_id', membership.team_id)
    .eq('invited_email', email.toLowerCase())
    .eq('status', 'pending')
    .maybeSingle()

  if (existingInvite) {
    return NextResponse.json({ error: 'Ya existe una invitación pendiente para ese email' }, { status: 409 })
  }

  // Crear invitación
  const { data: invitation, error: invError } = await admin
    .from('team_invitations')
    .insert({
      team_id: membership.team_id,
      invited_email: email.toLowerCase(),
      invited_by: user.id,
    })
    .select()
    .single()

  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 })

  // Enviar email de invitación via Resend
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://lead.littlebuddhagroup.com'
    const joinUrl = `${appUrl}/join?token=${invitation.token}`
    const teamName = (membership.team as { name?: string })?.name ?? 'el equipo'

    const { data: inviterData } = await admin.auth.admin.getUserById(user.id)
    const inviterEmail = inviterData?.user?.email ?? user.email ?? 'Un compañero'

    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME ?? 'Media Connector'} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@mymediaconnect.com'}>`,
      to: email,
      subject: `${inviterEmail} te invita a unirte a "${teamName}" en Media Connector`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Tienes una invitación de equipo</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            <strong>${inviterEmail}</strong> te ha invitado a colaborar en el equipo
            <strong>"${teamName}"</strong> dentro de Media Connector Lead Engine.
          </p>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Al aceptar, podrás ver y trabajar con todos los leads, campañas y actividad del equipo de forma compartida.
          </p>
          <a href="${joinUrl}" style="
            display: inline-block;
            margin-top: 24px;
            padding: 14px 28px;
            background: #6c47ff;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 15px;
          ">Unirme al equipo</a>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            Este enlace caduca en 7 días. Si no esperabas esta invitación, ignora este email.
          </p>
        </div>
      `,
    })
  }

  return NextResponse.json({ data: invitation }, { status: 201 })
}

// DELETE — Cancelar/revocar invitación
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { invitation_id } = await request.json()

  const { error } = await admin
    .from('team_invitations')
    .update({ status: 'expired' })
    .eq('id', invitation_id)
    .eq('invited_by', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}
