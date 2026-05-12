import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import {
  Users, Mail, TrendingUp, Megaphone,
  Calendar, ArrowUpRight, Clock, CheckCircle,
  Zap, MailOpen, MessageSquareReply, ChevronLeft, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { formatDateRelative, statusLabel, statusColor, scoreToBg } from '@/lib/utils'
import { getTeamUserIds } from '@/lib/teams'

const ACTIVITY_PER_PAGE = 8

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ activity_page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { activity_page } = await searchParams
  const actPage = Math.max(1, parseInt(activity_page ?? '1', 10))

  const admin = createAdminClient()

  // Obtener IDs de equipo (incluye al propio usuario + miembros del equipo)
  const teamUserIds = await getTeamUserIds(user.id)

  // Stats en paralelo — todos los miembros del equipo
  const [leadsRes, emailsRes, campaignsRes, activityRes, seqEmailsRes, campaignLeadsRes, junctionRes] = await Promise.all([
    admin.from('leads')
      .select('id, status, score, created_at, priority')
      .in('user_id', teamUserIds),
    admin.from('emails')
      .select('id, status, sent_at, opened_at')
      .in('user_id', teamUserIds),
    admin.from('campaigns')
      .select('id, name, status, user_id')
      .in('user_id', teamUserIds)
      .order('created_at', { ascending: false }),
    admin.from('activity_logs')
      .select('id, type, title, created_at, lead_id', { count: 'exact' })
      .in('user_id', teamUserIds)
      .order('created_at', { ascending: false })
      .range((actPage - 1) * ACTIVITY_PER_PAGE, actPage * ACTIVITY_PER_PAGE - 1),
    // Emails enviados por secuencias
    admin.from('sequence_steps')
      .select('id, status, sent_at')
      .in('user_id', teamUserIds)
      .eq('status', 'sent'),
    // Leads por campaña — fuente directa (campaign_id en leads)
    admin.from('leads')
      .select('id, campaign_id, status')
      .in('user_id', teamUserIds)
      .not('campaign_id', 'is', null),
    // Fuente 2: junction table campaign_leads (many-to-many)
    admin.from('campaign_leads')
      .select('campaign_id, lead_id')
      .not('campaign_id', 'is', null),
  ])

  type LeadRow     = { id: string; status: string; score: number | null; created_at: string; priority: string }
  type EmailRow    = { id: string; status: string | null; sent_at: string | null; opened_at: string | null }
  type CampaignRow = { id: string; name: string; status: string; user_id: string }
  type ActivityRow = { id: string; type: string; title: string; created_at: string; lead_id?: string }
  type SeqRow      = { id: string; status: string; sent_at: string | null }

  const leads       = (leadsRes.data      ?? []) as LeadRow[]
  const emails      = (emailsRes.data     ?? []) as EmailRow[]
  const campaigns   = (campaignsRes.data  ?? []) as CampaignRow[]
  const activities      = (activityRes.data   ?? []) as ActivityRow[]
  const activityTotal   = activityRes.count ?? 0
  const activityPages   = Math.min(5, Math.max(1, Math.ceil(activityTotal / ACTIVITY_PER_PAGE)))
  const seqEmailsSent = (seqEmailsRes.data ?? []) as SeqRow[]
  // campaignLeadsRes puede fallar si la tabla no existe aún — usamos fallback vacío
  const campaignLeadsData = (!campaignLeadsRes.error ? campaignLeadsRes.data : null) ?? []
  // junction table campaign_leads — fallback vacío si no existe
  const junctionData = (!junctionRes.error ? junctionRes.data : null) ?? []

  // Mapa rápido: lead_id → status (para resolver leads de la junction table)
  const leadStatusMap: Record<string, string> = {}
  for (const l of leads) leadStatusMap[l.id] = l.status

  // Calcular stats por campaña desde ambas fuentes
  type CampStats = { total: number; contacted: number; replied: number }
  const campStatsMap: Record<string, CampStats> = {}
  const seenInCamp = new Set<string>()

  const addToCampStats = (campaignId: string, leadId: string, status: string) => {
    const key = `${campaignId}:${leadId}`
    if (seenInCamp.has(key)) return
    seenInCamp.add(key)
    if (!campStatsMap[campaignId]) campStatsMap[campaignId] = { total: 0, contacted: 0, replied: 0 }
    const m = campStatsMap[campaignId]
    m.total++
    if (['contacted','replied','interested','meeting_scheduled','closed'].includes(status)) m.contacted++
    if (['replied','interested','meeting_scheduled','closed'].includes(status)) m.replied++
  }

  // Fuente 1: leads con campaign_id directo
  for (const l of campaignLeadsData as { id: string; campaign_id: string; status: string }[]) {
    if (l.campaign_id) addToCampStats(l.campaign_id, l.id, l.status)
  }

  // Fuente 2: junction table (many-to-many) — usa leadStatusMap para resolución de status
  for (const jl of junctionData as { campaign_id: string; lead_id: string }[]) {
    if (jl.campaign_id && jl.lead_id) {
      const status = leadStatusMap[jl.lead_id] ?? 'new'
      addToCampStats(jl.campaign_id, jl.lead_id, status)
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  const totalEmailsSent = emails.length + seqEmailsSent.length
  const totalOpened = emails.filter(e => e.opened_at || e.status === 'opened' || e.status === 'replied').length
  const openRate = totalEmailsSent > 0 ? Math.round((totalOpened / totalEmailsSent) * 100) : 0

  const stats = {
    total_leads: leads.length,
    new_leads: leads.filter(l => l.created_at >= todayStr).length,
    contacted: leads.filter(l => ['contacted','replied','interested','meeting_scheduled','closed'].includes(l.status)).length,
    replied: leads.filter(l => ['replied','interested','meeting_scheduled','closed'].includes(l.status)).length,
    emails_sent: totalEmailsSent,
    active_campaigns: campaigns.filter(c => c.status === 'active').length,
    meetings: leads.filter(l => l.status === 'meeting_scheduled').length,
    open_rate: openRate,
  }
  const replyRate = stats.contacted > 0 ? Math.round((stats.replied / stats.contacted) * 100) : 0

  type RecentLead = { id: string; company_name: string; status: string; priority: string; score: number | null; created_at: string; user_id: string }
  // Últimos leads del equipo
  const { data: recentLeadsRaw } = await admin
    .from('leads')
    .select('id, company_name, status, priority, score, created_at, user_id')
    .in('user_id', teamUserIds)
    .order('created_at', { ascending: false })
    .limit(6)
  const recentLeads = (recentLeadsRaw ?? []) as RecentLead[]

  const statCards = [
    { label: 'Total leads', value: stats.total_leads, sub: `+${stats.new_leads} hoy`, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Contactados', value: stats.contacted, sub: `${Math.round(stats.contacted / Math.max(stats.total_leads, 1) * 100)}% del total`, icon: Mail, color: 'bg-purple-50 text-purple-600' },
    { label: 'Ratio respuesta', value: `${replyRate}%`, sub: `${stats.replied} respondidos`, icon: MessageSquareReply, color: 'bg-green-50 text-green-600' },
    { label: 'Emails enviados', value: stats.emails_sent, sub: `${stats.open_rate}% tasa apertura`, icon: MailOpen, color: 'bg-orange-50 text-orange-600' },
    { label: 'Campañas activas', value: stats.active_campaigns, sub: `${campaigns.length} total`, icon: Megaphone, color: 'bg-brand-50 text-brand-600' },
    { label: 'Reuniones', value: stats.meetings, sub: 'Agendadas', icon: Calendar, color: 'bg-emerald-50 text-emerald-600' },
  ]

  const activityIcons: Record<string, string> = {
    email_sent: '📧',
    email_replied: '💬',
    reply_detected: '💬',
    sequence_replied: '✅',
    enriched: '🔍',
    lead_created: '✨',
    imported: '📥',
    note_added: '📝',
    task_completed: '✅',
    status_changed: '🔄',
    email_opened: '👁',
    email_bounced: '⚠️',
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Dashboard"
        subtitle={teamUserIds.length > 1 ? `Vista de equipo (${teamUserIds.length} miembros)` : 'Resumen de tu actividad comercial'}
        actions={
          <Link href="/leads" className="btn-primary text-xs py-1.5">
            <Users className="w-3.5 h-3.5" /> Ver todos los leads
          </Link>
        }
      />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="card p-4">
              <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <card.icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs font-medium text-gray-700 mt-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Últimos leads */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Últimos leads añadidos</h3>
              <Link href="/leads" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Ver todos <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(!recentLeads || recentLeads.length === 0) && (
                <div className="py-8 text-center text-sm text-gray-400">
                  Sin leads todavía. <Link href="/imports" className="text-brand-600 hover:underline">Importa tu primer CSV</Link>
                </div>
              )}
              {recentLeads?.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-gray-600">
                      {lead.company_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{lead.company_name}</p>
                    <p className="text-xs text-gray-400">{formatDateRelative(lead.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge text-xs ${statusColor(lead.status)}`}>
                      {statusLabel(lead.status)}
                    </span>
                    <span className={`badge text-xs font-semibold ${scoreToBg(lead.score ?? 0)}`}>
                      {lead.score ?? 0}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="card flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Actividad reciente</h3>
              <Link href="/activity" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Ver todos <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50 flex-1">
              {activities.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Sin actividad registrada aún.</div>
              )}
              {activities.map((act) => {
                const a = act as { id: string; type: string; title: string; created_at: string; lead_id?: string }
                const emoji = activityIcons[a.type] ?? '📌'
                return (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mt-0.5 shrink-0 text-xs">
                      {emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400">{formatDateRelative(a.created_at)}</p>
                    </div>
                    {a.lead_id && (
                      <Link href={`/leads/${a.lead_id}`} className="text-brand-500 hover:text-brand-700 shrink-0">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Paginación */}
            {activityPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Página {actPage} de {activityPages} · {activityTotal} eventos
                </span>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/dashboard?activity_page=${actPage - 1}`}
                    className={`p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors ${actPage <= 1 ? 'pointer-events-none opacity-30' : ''}`}
                    aria-disabled={actPage <= 1}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={`/dashboard?activity_page=${actPage + 1}`}
                    className={`p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors ${actPage >= activityPages ? 'pointer-events-none opacity-30' : ''}`}
                    aria-disabled={actPage >= activityPages}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Campañas activas */}
        {(() => {
          const activeCampaigns = campaigns.filter(c => c.status === 'active')
          if (activeCampaigns.length === 0) return null
          const useListView = activeCampaigns.length > 6

          return (
            <div className="card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Campañas activas
                  <span className="ml-2 text-xs font-normal text-gray-400">{activeCampaigns.length}</span>
                </h3>
                <Link href="/campaigns" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                  Ver todas <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>

              {useListView ? (
                /* ── Vista lista compacta (>6 campañas) ── */
                <div className="divide-y divide-gray-50">
                  {/* Cabecera columnas */}
                  <div className="grid grid-cols-[1fr_60px_72px_72px_80px_32px] gap-x-3 px-5 py-2 bg-gray-50/70">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Campaña</p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">Leads</p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">Contact.</p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">Respues.</p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center">Tasa</p>
                    <span />
                  </div>
                  {activeCampaigns.map((camp) => {
                    const cs = campStatsMap[camp.id] ?? { total: 0, contacted: 0, replied: 0 }
                    const contactRate = cs.total > 0 ? Math.round((cs.contacted / cs.total) * 100) : 0
                    return (
                      <div key={camp.id} className="grid grid-cols-[1fr_60px_72px_72px_80px_32px] gap-x-3 items-center px-5 py-2.5 hover:bg-gray-50/50 transition-colors">
                        <p className="text-sm font-medium text-gray-800 truncate">{camp.name}</p>
                        <p className="text-sm font-semibold text-gray-700 text-center">{cs.total}</p>
                        <p className="text-sm font-semibold text-blue-600 text-center">{cs.contacted}</p>
                        <p className="text-sm font-semibold text-green-600 text-center">{cs.replied}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${contactRate}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-7 text-right shrink-0">{contactRate}%</span>
                        </div>
                        <Link href={`/campaigns/${camp.id}`} className="p-1 text-gray-300 hover:text-brand-500 rounded-lg transition-colors flex justify-center">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* ── Vista grid cards (≤6 campañas) ── */
                <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeCampaigns.map((camp) => {
                    const cs = campStatsMap[camp.id] ?? { total: 0, contacted: 0, replied: 0 }
                    const contactRate = cs.total > 0 ? Math.round((cs.contacted / cs.total) * 100) : 0
                    return (
                      <Link key={camp.id} href={`/campaigns/${camp.id}`}
                        className="p-4 border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-colors">
                        <p className="text-sm font-semibold text-gray-900 truncate">{camp.name}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="bg-gray-50 rounded-lg p-1.5">
                            <p className="text-sm font-bold text-gray-800">{cs.total}</p>
                            <p className="text-xs text-gray-400">leads</p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-1.5">
                            <p className="text-sm font-bold text-blue-700">{cs.contacted}</p>
                            <p className="text-xs text-blue-400">contactados</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-1.5">
                            <p className="text-sm font-bold text-green-700">{cs.replied}</p>
                            <p className="text-xs text-green-400">respuestas</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>Progreso contactación</span>
                            <span>{contactRate}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${contactRate}%` }} />
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {/* Accesos rápidos si no hay datos */}
        {leads.length === 0 && (
          <div className="card p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-brand-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Empieza a generar leads</h3>
              <p className="text-sm text-gray-500 mt-1">Importa un CSV, descubre empresas o crea tu primera campaña.</p>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/imports" className="btn-primary text-sm">📥 Importar CSV</Link>
              <Link href="/discover" className="btn-secondary text-sm">🔍 Descubrir empresas</Link>
              <Link href="/campaigns/new" className="btn-secondary text-sm">🎯 Nueva campaña</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
