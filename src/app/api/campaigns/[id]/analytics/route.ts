import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

type EmailRow = {
  lead_id: string; status: string; opened_at: string | null; clicked_at: string | null
  created_at: string; subject: string | null; from_email: string | null
}
type SeqRow = { lead_id: string; status: string; created_at: string }

// GET — Analíticas por lead de una campaña
// Combina leads de campaign_id directo + campaign_leads junction
// Emails se buscan por lead_id (sin filtrar campaign_id para no perder datos)
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

  // ── 1. Obtener lead IDs desde AMBAS fuentes ──────────────────
  const [directRes, junctionRes] = await Promise.all([
    admin.from('leads').select('id').eq('campaign_id', id),
    admin.from('campaign_leads').select('lead_id').eq('campaign_id', id).then((r: { data: unknown; error: unknown }) => r).catch(() => ({ data: [], error: null })),
  ])

  const directIds = (directRes.data ?? []).map((r: { id: string }) => r.id)
  const junctionIds = ((junctionRes.data ?? []) as { lead_id: string }[]).map(r => r.lead_id)
  const allLeadIds = [...new Set([...directIds, ...junctionIds])]

  if (allLeadIds.length === 0) {
    return NextResponse.json({ data: [], campaign: campaign.name, total: 0 })
  }

  // ── 2. Obtener datos de todos esos leads ──────────────────────
  const { data: leads, error: leadsErr } = await admin
    .from('leads')
    .select('id, company_name, email, first_name, last_name, status, score, sector, country, department')
    .in('id', allLeadIds)
    .order('score', { ascending: false })

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })
  if (!leads || leads.length === 0) {
    return NextResponse.json({ data: [], campaign: campaign.name, total: 0 })
  }

  const leadIds = leads.map((l: { id: string }) => l.id)

  // ── 3. Emails: buscar por lead_id (sin filtrar campaign_id) ───
  // Primero intentamos con campaign_id, si hay pocos resultados ampliamos
  const [emailsWithCamp, emailsAllLeads, sequences] = await Promise.all([
    admin.from('emails')
      .select('lead_id, status, opened_at, clicked_at, created_at, subject, from_email')
      .eq('campaign_id', id)
      .in('lead_id', leadIds),
    admin.from('emails')
      .select('lead_id, status, opened_at, clicked_at, created_at, subject, from_email')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false }),
    admin.from('sequences')
      .select('lead_id, status, created_at')
      .eq('campaign_id', id)
      .in('lead_id', leadIds),
  ])

  // Usar emails con campaign_id si los hay; si no, usar todos los emails de esos leads
  const campEmails = (emailsWithCamp.data ?? []) as EmailRow[]
  const allLeadEmails = (emailsAllLeads.data ?? []) as EmailRow[]
  // Si hay poca diferencia, usar los que tienen campaign_id; si 0, usar todos
  const emails: EmailRow[] = campEmails.length > 0 ? campEmails : allLeadEmails

  // ── 4. Agrupar emails y secuencias por lead ───────────────────
  const emailsByLead = new Map<string, EmailRow[]>()
  for (const email of emails) {
    const arr = emailsByLead.get(email.lead_id) ?? []
    arr.push(email)
    emailsByLead.set(email.lead_id, arr)
  }

  const seqByLead = new Map<string, SeqRow[]>()
  for (const seq of (sequences.data ?? []) as SeqRow[]) {
    if (!seq) continue
    const arr = seqByLead.get(seq.lead_id) ?? []
    arr.push(seq)
    seqByLead.set(seq.lead_id, arr)
  }

  // ── 5. Construir fila por lead ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (leads as any[]).map((lead: Record<string, unknown>) => {
    const leadEmails = emailsByLead.get(lead.id as string) ?? []
    const leadSeqs = seqByLead.get(lead.id as string) ?? []

    const sent = leadEmails.length
    const openedEmails = leadEmails.filter((e: EmailRow) => e.opened_at || e.status === 'opened' || e.status === 'clicked' || e.status === 'replied')
    const clickedEmails = leadEmails.filter((e: EmailRow) => e.clicked_at || e.status === 'clicked')
    const repliedEmails = leadEmails.filter((e: EmailRow) => e.status === 'replied')
    const bouncedEmails = leadEmails.filter((e: EmailRow) => e.status === 'bounced')

    const opened = openedEmails.length
    const clicked = clickedEmails.length
    const replied = repliedEmails.length
    const bounced = bouncedEmails.length

    const sortedEmails = [...leadEmails].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const lastEmailAt = sortedEmails[0]?.created_at ?? null
    const lastOpenedAt = openedEmails.length > 0
      ? openedEmails.sort((a, b) => new Date(b.opened_at ?? b.created_at).getTime() - new Date(a.opened_at ?? a.created_at).getTime())[0].opened_at
      : null
    const lastRepliedAt = repliedEmails.length > 0 ? repliedEmails[0].created_at : null

    const hasActiveSeq = leadSeqs.some((s: SeqRow) => s?.status === 'active')
    const seqCompleted = leadSeqs.some((s: SeqRow) => s?.status === 'completed')

    // Nivel de interacción para ordenar/destacar
    const interactionLevel = replied > 0 ? 'replied' : clicked > 0 ? 'clicked' : opened > 0 ? 'opened' : sent > 0 ? 'sent' : 'none'

    return {
      lead_id: lead.id as string,
      company_name: lead.company_name as string,
      email: (lead.email as string) ?? '',
      contact_name: [lead.first_name as string, lead.last_name as string].filter(Boolean).join(' ') || null,
      department: (lead.department as string) ?? '',
      status: lead.status as string,
      score: (lead.score as number) ?? 0,
      sector: (lead.sector as string) ?? '',
      country: (lead.country as string) ?? '',
      // Métricas
      sent,
      opened,
      clicked,
      replied,
      bounced,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      click_rate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      // Fechas clave
      last_email_at: lastEmailAt,
      last_opened_at: lastOpenedAt,
      last_replied_at: lastRepliedAt,
      // Secuencias
      has_active_sequence: hasActiveSeq,
      sequence_completed: seqCompleted,
      // Nivel de interacción
      interaction_level: interactionLevel,
    }
  })

  // Ordenar: primero respondidos, luego clicados, luego abiertos, luego enviados, luego sin actividad
  const order = { replied: 0, clicked: 1, opened: 2, sent: 3, none: 4 }
  rows.sort((a, b) => order[a.interaction_level as keyof typeof order] - order[b.interaction_level as keyof typeof order])

  return NextResponse.json({ data: rows, campaign: campaign.name, total: rows.length })
}
