import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import { formatDateRelative } from '@/lib/utils'
import { getTeamUserIds } from '@/lib/teams'
import ActivityExportButtons from '@/components/activity/ActivityExportButtons'
import {
  ArrowUpRight, ChevronLeft, ChevronRight, Activity, Filter
} from 'lucide-react'

// ============================================================
// ACTIVIDAD — Historial completo con paginación y filtros
// ============================================================

const PER_PAGE = 25

const EVENT_LABELS: Record<string, string> = {
  email_sent:        'Email enviado',
  email_opened:      'Email abierto',
  email_clicked:     'Click en email',
  email_bounced:     'Email rebotado',
  email_replied:     'Email respondido',
  reply_detected:    'Respuesta detectada',
  sequence_replied:  'Secuencia — respuesta',
  enriched:          'Lead enriquecido',
  lead_created:      'Lead creado',
  imported:          'Lead importado',
  note_added:        'Nota añadida',
  task_completed:    'Tarea completada',
  status_changed:    'Estado cambiado',
  campaign_assigned: 'Asignado a campaña',
}

const EVENT_ICONS: Record<string, string> = {
  email_sent:        '📧',
  email_opened:      '👁',
  email_clicked:     '🖱️',
  email_bounced:     '⚠️',
  email_replied:     '💬',
  reply_detected:    '💬',
  sequence_replied:  '✅',
  enriched:          '🔍',
  lead_created:      '✨',
  imported:          '📥',
  note_added:        '📝',
  task_completed:    '✅',
  status_changed:    '🔄',
  campaign_assigned: '🎯',
}

const EVENT_COLORS: Record<string, string> = {
  email_sent:        'bg-blue-50 text-blue-600',
  email_opened:      'bg-purple-50 text-purple-600',
  email_clicked:     'bg-green-50 text-green-600',
  email_bounced:     'bg-red-50 text-red-500',
  email_replied:     'bg-emerald-50 text-emerald-600',
  reply_detected:    'bg-emerald-50 text-emerald-600',
  enriched:          'bg-amber-50 text-amber-600',
  lead_created:      'bg-brand-50 text-brand-600',
  imported:          'bg-gray-50 text-gray-600',
  campaign_assigned: 'bg-orange-50 text-orange-600',
}

const EVENT_FILTER_GROUPS = [
  { label: 'Todos', value: '' },
  { label: 'Emails', value: 'email' },
  { label: 'Respuestas', value: 'reply' },
  { label: 'Leads', value: 'lead' },
  { label: 'Enriquecidos', value: 'enriched' },
  { label: 'Campañas', value: 'campaign' },
]

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { page, filter } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? '1', 10))
  const currentFilter = filter ?? ''

  const admin = createAdminClient()
  const teamUserIds = await getTeamUserIds(user.id)

  // Construir query con filtro opcional
  let query = admin
    .from('activity_logs')
    .select('id, type, title, description, created_at, lead_id, campaign_id', { count: 'exact' })
    .in('user_id', teamUserIds)
    .order('created_at', { ascending: false })

  if (currentFilter === 'email') {
    query = query.in('type', ['email_sent', 'email_opened', 'email_clicked', 'email_bounced', 'email_replied'])
  } else if (currentFilter === 'reply') {
    query = query.in('type', ['email_replied', 'reply_detected', 'sequence_replied'])
  } else if (currentFilter === 'lead') {
    query = query.in('type', ['lead_created', 'imported', 'status_changed', 'note_added'])
  } else if (currentFilter === 'enriched') {
    query = query.eq('type', 'enriched')
  } else if (currentFilter === 'campaign') {
    query = query.in('type', ['campaign_assigned', 'email_sent'])
  }

  const { data: activities, count } = await query
    .range((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE - 1)

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))

  type ActivityRow = {
    id: string
    type: string
    title: string
    description?: string
    created_at: string
    lead_id?: string
    campaign_id?: string
  }

  // Obtener nombres de leads en batch
  const leadIds = [...new Set((activities ?? [])
    .map((a: ActivityRow) => a.lead_id)
    .filter(Boolean))] as string[]

  const leadNames: Record<string, string> = {}
  if (leadIds.length > 0) {
    const { data: leadsData } = await admin
      .from('leads')
      .select('id, company_name')
      .in('id', leadIds)
    ;(leadsData ?? []).forEach((l: { id: string; company_name: string }) => {
      leadNames[l.id] = l.company_name
    })
  }

  const buildHref = (p: number, f?: string) => {
    const params = new URLSearchParams()
    if (p > 1) params.set('page', String(p))
    if ((f ?? currentFilter)) params.set('filter', f ?? currentFilter)
    const qs = params.toString()
    return `/activity${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Actividad"
        subtitle={`${count ?? 0} eventos registrados`}
        actions={
          <div className="flex items-center gap-2">
            <ActivityExportButtons filter={currentFilter} totalCount={count ?? 0} />
            <Link href="/dashboard" className="btn-secondary text-xs py-1.5">
              <ChevronLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4">

        {/* Filtros por tipo */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          {EVENT_FILTER_GROUPS.map(group => (
            <Link
              key={group.value}
              href={buildHref(1, group.value)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                currentFilter === group.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {group.label}
            </Link>
          ))}
        </div>

        {/* Lista de actividad */}
        <div className="card overflow-hidden">
          {(!activities || activities.length === 0) ? (
            <div className="py-16 text-center">
              <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Sin actividad en esta categoría.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(activities as ActivityRow[]).map((act) => {
                const emoji = EVENT_ICONS[act.type] ?? '📌'
                const colorClass = EVENT_COLORS[act.type] ?? 'bg-gray-50 text-gray-500'
                const leadName = act.lead_id ? leadNames[act.lead_id] : null

                return (
                  <div key={act.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                    {/* Icono */}
                    <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center shrink-0 mt-0.5 text-sm`}>
                      {emoji}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 truncate">{act.title}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                          {EVENT_LABELS[act.type] ?? act.type}
                        </span>
                      </div>
                      {act.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{act.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">{formatDateRelative(act.created_at)}</span>
                        {leadName && (
                          <span className="text-xs text-gray-400">· {leadName}</span>
                        )}
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-1 shrink-0">
                      {act.lead_id && (
                        <Link
                          href={`/leads/${act.lead_id}`}
                          className="p-1.5 text-gray-300 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                          title={leadName ?? 'Ver lead'}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {act.campaign_id && (
                        <Link
                          href={`/campaigns/${act.campaign_id}`}
                          className="p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Ver campaña"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/30">
              <span className="text-xs text-gray-500">
                {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, count ?? 0)} de {count ?? 0} eventos
              </span>
              <div className="flex items-center gap-1">
                <Link
                  href={buildHref(currentPage - 1)}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 font-medium transition-colors ${
                    currentPage <= 1
                      ? 'opacity-30 pointer-events-none text-gray-400'
                      : 'text-gray-600 hover:bg-white hover:border-gray-300'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </Link>
                <span className="text-xs text-gray-400 px-2">
                  {currentPage} / {totalPages}
                </span>
                <Link
                  href={buildHref(currentPage + 1)}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 font-medium transition-colors ${
                    currentPage >= totalPages
                      ? 'opacity-30 pointer-events-none text-gray-400'
                      : 'text-gray-600 hover:bg-white hover:border-gray-300'
                  }`}
                >
                  Siguiente <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
