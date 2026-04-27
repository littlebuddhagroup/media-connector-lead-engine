import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import {
  Users, Mail, TrendingUp, Megaphone,
  Calendar, ArrowUpRight, Clock, CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { formatDateRelative, statusLabel, statusColor, priorityColor, scoreToBg } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Stats
  const [leadsRes, emailsRes, campaignsRes, activityRes] = await Promise.all([
    supabase.from('leads').select('status, score, created_at, priority').eq('user_id', user.id),
    supabase.from('emails').select('status, sent_at').eq('user_id', user.id),
    supabase.from('campaigns').select('id, name, status, total_leads, contacted_leads, replied_leads').eq('user_id', user.id),
    supabase.from('activity_logs').select('type, title, created_at, lead_id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
  ])

  const leads = leadsRes.data ?? []
  const emails = emailsRes.data ?? []
  const campaigns = campaignsRes.data ?? []
  const activities = activityRes.data ?? []

  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const stats = {
    total_leads: leads.length,
    new_leads: leads.filter(l => l.created_at > yesterday).length,
    contacted: leads.filter(l => ['contacted','replied','interested','meeting_scheduled','closed'].includes(l.status)).length,
    replied: leads.filter(l => ['replied','interested','meeting_scheduled','closed'].includes(l.status)).length,
    emails_sent: emails.filter(e => e.status === 'sent').length,
    active_campaigns: campaigns.filter(c => c.status === 'active').length,
    meetings: leads.filter(l => l.status === 'meeting_scheduled').length,
  }
  const replyRate = stats.contacted > 0 ? Math.round((stats.replied / stats.contacted) * 100) : 0

  // Últimos leads
  const { data: recentLeads } = await supabase
    .from('leads')
    .select('id, company_name, status, priority, score, created_at, campaign:campaigns(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const statCards = [
    { label: 'Total leads', value: stats.total_leads, sub: `+${stats.new_leads} hoy`, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Contactados', value: stats.contacted, sub: `${Math.round(stats.contacted / Math.max(stats.total_leads, 1) * 100)}% del total`, icon: Mail, color: 'bg-purple-50 text-purple-600' },
    { label: 'Ratio de respuesta', value: `${replyRate}%`, sub: `${stats.replied} respondidos`, icon: TrendingUp, color: 'bg-green-50 text-green-600' },
    { label: 'Emails enviados', value: stats.emails_sent, sub: 'En total', icon: Mail, color: 'bg-orange-50 text-orange-600' },
    { label: 'Campañas activas', value: stats.active_campaigns, sub: `${campaigns.length} total`, icon: Megaphone, color: 'bg-brand-50 text-brand-600' },
    { label: 'Reuniones', value: stats.meetings, sub: 'Agendadas', icon: Calendar, color: 'bg-emerald-50 text-emerald-600' },
  ]

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Dashboard"
        subtitle="Resumen de tu actividad comercial"
        actions={
          <Link href="/leads" className="btn-primary text-xs py-1.5">
            <Users className="w-3.5 h-3.5" /> Ver todos los leads
          </Link>
        }
      />

      <div className="p-6 space-y-6">
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
              {recentLeads?.length === 0 && (
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
                    <span className={`badge text-xs font-semibold ${scoreToBg(lead.score)}`}>
                      {lead.score}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Actividad reciente</h3>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="divide-y divide-gray-50">
              {activities.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Sin actividad registrada aún.</div>
              )}
              {activities.map((act: { id?: string; title: string; created_at: string }) => (
                <div key={act.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center mt-0.5 shrink-0">
                    <CheckCircle className="w-3 h-3 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{act.title}</p>
                    <p className="text-xs text-gray-400">{formatDateRelative(act.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Campañas activas */}
        {campaigns.filter(c => c.status === 'active').length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Campañas activas</h3>
              <Link href="/campaigns" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Ver todas <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.filter(c => c.status === 'active').map((camp) => (
                <Link key={camp.id} href={`/campaigns/${camp.id}`}
                  className="p-4 border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-colors">
                  <p className="text-sm font-semibold text-gray-900 truncate">{camp.name}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span>{camp.total_leads} leads</span>
                    <span>{camp.contacted_leads} contactados</span>
                    <span>{camp.replied_leads} respuestas</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, camp.total_leads > 0 ? (camp.contacted_leads / camp.total_leads) * 100 : 0)}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
