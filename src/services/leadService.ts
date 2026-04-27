import { createAdminClient } from '@/lib/supabase/server'
import { extractDomain } from '@/lib/utils'
import type { CreateLeadInput, LeadFilters } from '@/types'

// ============================================================
// LEAD SERVICE — CRUD y lógica de leads
// ============================================================

export async function createLead(input: CreateLeadInput, userId: string) {
  const supabase = createAdminClient()

  // Extraer dominio de la web si no se proporcionó
  const domain = input.domain || extractDomain(input.website)

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      ...input,
      domain,
      user_id: userId,
      source: input.source ?? 'manual',
    })
    .select()
    .single()

  if (error) throw new Error('Error creando lead: ' + error.message)

  // Registrar actividad
  await supabase.from('activity_logs').insert({
    lead_id: lead.id,
    user_id: userId,
    campaign_id: input.campaign_id,
    type: 'lead_created',
    title: `Lead creado: ${lead.company_name}`,
    description: `Fuente: ${input.source ?? 'manual'}`,
  })

  // Actualizar contador de campaña
  if (input.campaign_id) {
    await supabase
      .from('campaigns')
      .update({ total_leads: supabase.rpc('increment', { x: 1 }) as unknown as number })
      .eq('id', input.campaign_id)
  }

  return lead
}

export async function getLeads(filters: LeadFilters, userId: string) {
  const supabase = createAdminClient()

  let query = supabase
    .from('leads')
    .select('*, campaign:campaigns(id,name)', { count: 'exact' })
    .eq('user_id', userId)

  if (filters.campaign_id) query = query.eq('campaign_id', filters.campaign_id)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.min_score !== undefined) query = query.gte('score', filters.min_score)
  if (filters.max_score !== undefined) query = query.lte('score', filters.max_score)
  if (filters.search) {
    query = query.or(
      `company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,domain.ilike.%${filters.search}%`
    )
  }

  // Ordenar
  const sortBy = filters.sort_by ?? 'created_at'
  const sortOrder = { ascending: filters.sort_order !== 'desc' }
  query = query.order(sortBy as string, sortOrder)

  // Paginación
  const page = filters.page ?? 1
  const perPage = filters.per_page ?? 25
  const from = (page - 1) * perPage
  query = query.range(from, from + perPage - 1)

  const { data, error, count } = await query
  if (error) throw new Error('Error obteniendo leads: ' + error.message)

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getLeadById(id: string, userId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      campaign:campaigns(id, name, status),
      enrichment:lead_enrichments(*),
      messages(*),
      emails(*),
      notes(*),
      tasks(*),
      activity_logs(*)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error('Lead no encontrado')
  return data
}

export async function updateLead(
  id: string,
  updates: Record<string, unknown>,
  userId: string
) {
  const supabase = createAdminClient()

  // Si cambia el status, registrar en actividad
  const { data: current } = await supabase
    .from('leads')
    .select('status, company_name, campaign_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error('Error actualizando lead: ' + error.message)

  if (updates.status && current?.status !== updates.status) {
    await supabase.from('activity_logs').insert({
      lead_id: id,
      user_id: userId,
      campaign_id: current?.campaign_id,
      type: 'status_changed',
      title: `Estado cambiado a "${updates.status}"`,
      description: `Anterior: ${current?.status}`,
      metadata: { from: current?.status, to: updates.status },
    })
  }

  return data
}

export async function deleteLead(id: string, userId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error('Error eliminando lead: ' + error.message)
}

export async function getDashboardStats(userId: string) {
  const supabase = createAdminClient()

  const [leadsRes, emailsRes, campaignsRes] = await Promise.all([
    supabase
      .from('leads')
      .select('status, score, created_at')
      .eq('user_id', userId),
    supabase
      .from('emails')
      .select('status, sent_at')
      .eq('user_id', userId),
    supabase
      .from('campaigns')
      .select('status')
      .eq('user_id', userId),
  ])

  const leads = leadsRes.data ?? []
  const emails = emailsRes.data ?? []
  const campaigns = campaignsRes.data ?? []

  const total_leads = leads.length
  const contacted = leads.filter((l: { status: string }) => ['contacted','replied','interested','meeting_scheduled','closed'].includes(l.status)).length
  const replied = leads.filter((l: { status: string }) => ['replied','interested','meeting_scheduled','closed'].includes(l.status)).length
  const newLeads = leads.filter((l: { status: string }) => l.status === 'new').length
  const meetings = leads.filter((l: { status: string }) => l.status === 'meeting_scheduled').length
  const sentEmails = emails.filter((e: { status: string }) => e.status === 'sent').length
  const activeCampaigns = campaigns.filter((c: { status: string }) => c.status === 'active').length

  // Leads nuevos en últimas 24h
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const newToday = leads.filter((l: { created_at: string }) => l.created_at > yesterday).length

  return {
    total_leads,
    new_leads: newToday,
    contacted_leads: contacted,
    replied_leads: replied,
    emails_sent: sentEmails,
    reply_rate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
    active_campaigns: activeCampaigns,
    meetings_scheduled: meetings,
  }
}
