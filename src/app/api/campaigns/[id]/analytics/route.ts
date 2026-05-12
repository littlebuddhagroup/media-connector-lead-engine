import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

type EmailRow = { lead_id: string; status: string; opened_at: string | null; clicked_at: string | null; created_at: string; subject: string | null }
type SeqRow = { lead_id: string; status: string; created_at: string }

// GET — Analíticas por lead de una campaña
// Devuelve: por cada lead → emails enviados, abiertos, clicados, respondidos
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Verificar acceso a la campaña
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id, name, user_id')
    .eq('id', id)
    .single()
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  // Obtener todos los leads de la campaña con su info básica
  const { data: leads, error: leadsErr } = await admin
    .from('leads')
    .select('id, company_name, email, first_name, last_name, status, score, sector, country')
    .eq('campaign_id', id)
    .order('score', { ascending: false })

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })
  if (!leads || leads.length === 0) return NextResponse.json({ data: [], campaign: campaign.name })

  const leadIds = leads.map((l: { id: string }) => l.id)

  // Obtener emails de la campaña para estos leads (todas las columnas de tracking)
  const { data: emails, error: emailsErr } = await admin
    .from('emails')
    .select('lead_id, status, opened_at, clicked_at, created_at, subject')
    .eq('campaign_id', id)
    .in('lead_id', leadIds)

  if (emailsErr) return NextResponse.json({ error: emailsErr.message }, { status: 500 })

  // Obtener secuencias activas/completadas por lead
  const { data: sequences } = await admin
    .from('sequences')
    .select('lead_id, status, created_at')
    .eq('campaign_id', id)
    .in('lead_id', leadIds)

  // Agrupar emails por lead_id
  const emailsByLead = new Map<string, EmailRow[]>()
  for (const email of (emails ?? []) as EmailRow[]) {
    const arr = emailsByLead.get(email.lead_id) ?? []
    arr.push(email)
    emailsByLead.set(email.lead_id, arr)
  }

  // Agrupar secuencias por lead_id
  const seqByLead = new Map<string, SeqRow[]>()
  for (const seq of (sequences ?? []) as SeqRow[]) {
    if (!seq) continue
    const arr = seqByLead.get(seq.lead_id) ?? []
    arr.push(seq)
    seqByLead.set(seq.lead_id, arr)
  }

  // Construir fila por lead
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (leads as any[]).map((lead: Record<string, unknown>) => {
    const leadEmails = emailsByLead.get(lead.id as string) ?? []
    const leadSeqs = seqByLead.get(lead.id as string) ?? []

    const sent = leadEmails.length
    const opened = leadEmails.filter((e: EmailRow) => e.opened_at || e.status === 'opened').length
    const clicked = leadEmails.filter((e: EmailRow) => e.clicked_at || e.status === 'clicked').length
    const replied = leadEmails.filter((e: EmailRow) => e.status === 'replied').length
    const bounced = leadEmails.filter((e: EmailRow) => e.status === 'bounced').length
    const lastEmailAt = leadEmails.length > 0
      ? [...leadEmails].sort((a: EmailRow, b: EmailRow) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null
    const hasActiveSeq = leadSeqs.some((s: SeqRow) => s?.status === 'active')
    const seqCompleted = leadSeqs.some((s: SeqRow) => s?.status === 'completed')

    return {
      lead_id: lead.id as string,
      company_name: lead.company_name as string,
      email: (lead.email as string) ?? '',
      contact_name: [lead.first_name as string, lead.last_name as string].filter(Boolean).join(' ') || null,
      status: lead.status as string,
      score: (lead.score as number) ?? 0,
      sector: (lead.sector as string) ?? '',
      country: (lead.country as string) ?? '',
      sent,
      opened,
      clicked,
      replied,
      bounced,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      click_rate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      last_email_at: lastEmailAt,
      has_active_sequence: hasActiveSeq,
      sequence_completed: seqCompleted,
    }
  })

  return NextResponse.json({ data: rows, campaign: campaign.name, total: rows.length })
}
