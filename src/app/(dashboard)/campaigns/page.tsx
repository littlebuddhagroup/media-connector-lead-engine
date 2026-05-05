'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import {
  Plus, Users, Mail, TrendingUp, Calendar, Zap, Target,
  Search, Filter, ArrowUpDown, ChevronRight, Play, Pause,
  BarChart3, Clock, CheckCircle2, XCircle, AlertCircle,
  Loader2, RefreshCw, Star, MessageSquare
} from 'lucide-react'

type CampaignStats = {
  leads: number
  contacted: number
  replied: number
  meetings: number
  closed: number
  avg_score: number
  contact_rate: number
  emails_sent: number
  open_rate: number
  reply_rate: number
  active_sequences: number
  last_activity: string | null
}

type Campaign = {
  id: string
  name: string
  description: string | null
  status: string
  country: string | null
  sector: string | null
  language: string
  created_at: string
  start_date: string | null
  end_date: string | null
  goal_leads: number
  goal_meetings: number
  goal_replies: number
  stats: CampaignStats
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; dot: string }> = {
  active:   { label: 'Activa',    color: 'bg-green-100 text-green-700 border-green-200',   icon: <Play className="w-3 h-3" />,         dot: 'bg-green-500' },
  paused:   { label: 'Pausada',   color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: <Pause className="w-3 h-3" />,        dot: 'bg-amber-500' },
  draft:    { label: 'Borrador',  color: 'bg-gray-100 text-gray-600 border-gray-200',      icon: <AlertCircle className="w-3 h-3" />,  dot: 'bg-gray-400' },
  completed:{ label: 'Completada',color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: <CheckCircle2 className="w-3 h-3" />, dot: 'bg-blue-500' },
  cancelled:{ label: 'Cancelada', color: 'bg-red-100 text-red-700 border-red-200',         icon: <XCircle className="w-3 h-3" />,      dot: 'bg-red-400' },
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function GoalChip({ current, goal, label, color }: { current: number; goal: number; label: string; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 shrink-0">{label} {pct}%</span>
    </div>
  )
}

function CampaignCard({ campaign, onStatusChange }: { campaign: Campaign; onStatusChange: (id: string, status: string) => void }) {
  const cfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
  const { stats } = campaign
  const hasGoals = campaign.goal_leads > 0 || campaign.goal_meetings > 0 || campaign.goal_replies > 0
  const [toggling, setToggling] = useState(false)

  async function toggleStatus() {
    setToggling(true)
    const next = campaign.status === 'active' ? 'paused' : 'active'
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    onStatusChange(campaign.id, next)
    setToggling(false)
  }

  return (
    <div className="card p-5 hover:shadow-md hover:border-brand-200 transition-all flex flex-col gap-3 group relative">
      {/* Header */}
      <div className="flex items-start gap-2">
        {/* Status dot */}
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <Link href={`/campaigns/${campaign.id}`} className="block">
            <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-700 leading-snug">
              {campaign.name}
            </h3>
          </Link>
          {campaign.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{campaign.description}</p>
          )}
        </div>
        {/* Status badge */}
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      {/* Tags */}
      {(campaign.country || campaign.sector) && (
        <div className="flex items-center gap-1 flex-wrap -mt-1">
          {campaign.country && (
            <span className="text-[10px] bg-gray-50 border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
              🌍 {campaign.country}
            </span>
          )}
          {campaign.sector && (
            <span className="text-[10px] bg-brand-50 border border-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full">
              {campaign.sector}
            </span>
          )}
          {stats.active_sequences > 0 && (
            <span className="text-[10px] bg-purple-50 border border-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" /> {stats.active_sequences} seq.
            </span>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-base font-bold text-gray-900 leading-none">{stats.leads}</p>
          <p className="text-[9px] text-gray-400 mt-0.5 flex items-center justify-center gap-0.5">
            <Users className="w-2.5 h-2.5" /> Leads
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-base font-bold text-blue-700 leading-none">{stats.contact_rate}%</p>
          <p className="text-[9px] text-blue-400 mt-0.5 flex items-center justify-center gap-0.5">
            <Mail className="w-2.5 h-2.5" /> Contact.
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <p className="text-base font-bold text-green-700 leading-none">{stats.open_rate}%</p>
          <p className="text-[9px] text-green-400 mt-0.5 flex items-center justify-center gap-0.5">
            <BarChart3 className="w-2.5 h-2.5" /> Opens
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-2 text-center">
          <p className="text-base font-bold text-purple-700 leading-none">{stats.reply_rate}%</p>
          <p className="text-[9px] text-purple-400 mt-0.5 flex items-center justify-center gap-0.5">
            <MessageSquare className="w-2.5 h-2.5" /> Reply
          </p>
        </div>
      </div>

      {/* Mini funnel */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>Funnel</span>
          <span>{stats.leads} leads → {stats.contacted} contact. → {stats.replied} resp. → {stats.meetings} reunión</span>
        </div>
        <MiniBar value={stats.contacted} max={Math.max(stats.leads, 1)} color="bg-blue-400" />
      </div>

      {/* Goal progress */}
      {hasGoals && (
        <div className="space-y-1 border-t border-gray-100 pt-2">
          {campaign.goal_leads > 0 && (
            <GoalChip current={stats.leads} goal={campaign.goal_leads} label="Leads" color="bg-brand-500" />
          )}
          {campaign.goal_meetings > 0 && (
            <GoalChip current={stats.meetings} goal={campaign.goal_meetings} label="Reuniones" color="bg-green-500" />
          )}
          {campaign.goal_replies > 0 && (
            <GoalChip current={stats.replied} goal={campaign.goal_replies} label="Respuestas" color="bg-purple-500" />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-auto">
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          {stats.last_activity ? (
            <><Clock className="w-3 h-3" /> {formatRelative(stats.last_activity)}</>
          ) : (
            <><Calendar className="w-3 h-3" /> {new Date(campaign.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Quick toggle active/pause */}
          {(campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft') && (
            <button
              onClick={e => { e.preventDefault(); toggleStatus() }}
              disabled={toggling}
              className="p-1 rounded-md text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title={campaign.status === 'active' ? 'Pausar' : 'Activar'}
            >
              {toggling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : campaign.status === 'active'
                  ? <Pause className="w-3.5 h-3.5" />
                  : <Play className="w-3.5 h-3.5" />
              }
            </button>
          )}
          <Link
            href={`/campaigns/${campaign.id}`}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-800 px-2 py-1 rounded-md hover:bg-brand-50 transition-colors"
          >
            Ver <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'leads', label: 'Más leads' },
  { value: 'open_rate', label: 'Mayor apertura' },
  { value: 'contact_rate', label: 'Mayor contacto' },
]

const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'completed', label: 'Completadas' },
]

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('recent')

  const fetchCampaigns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/campaigns')
      const json = await res.json()
      if (json.data) setCampaigns(json.data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  function handleStatusChange(id: string, status: string) {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  // Filter + sort
  let filtered = campaigns
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.sector?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q)
    )
  }
  if (statusFilter) {
    filtered = filtered.filter(c => c.status === statusFilter)
  }
  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'leads': return b.stats.leads - a.stats.leads
      case 'open_rate': return b.stats.open_rate - a.stats.open_rate
      case 'contact_rate': return b.stats.contact_rate - a.stats.contact_rate
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  // Aggregate stats for header
  const totalLeads = campaigns.reduce((s, c) => s + c.stats.leads, 0)
  const totalEmails = campaigns.reduce((s, c) => s + c.stats.emails_sent, 0)
  const avgOpenRate = campaigns.length > 0
    ? Math.round(campaigns.reduce((s, c) => s + c.stats.open_rate, 0) / campaigns.length)
    : 0
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Campañas"
        subtitle={`${campaigns.length} campañas · ${totalLeads} leads totales`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCampaigns(true)}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/campaigns/new" className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Nueva campaña
            </Link>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 md:space-y-5">
        {/* Summary KPIs */}
        {campaigns.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{activeCampaigns}</p>
                <p className="text-xs text-gray-500">Campañas activas</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{totalLeads}</p>
                <p className="text-xs text-gray-500">Leads en campaña</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{totalEmails}</p>
                <p className="text-xs text-gray-500">Emails enviados</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{avgOpenRate}%</p>
                <p className="text-xs text-gray-500">Apertura media</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {campaigns.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar campaña..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-8 py-1.5 text-xs"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 ml-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="input py-1 text-xs pr-6"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="card flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-5">
              <Target className="w-8 h-8 text-brand-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Crea tu primera campaña</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">
              Organiza tus leads en campañas, asigna secuencias de email y mide el rendimiento en tiempo real.
            </p>
            <Link href="/campaigns/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Nueva campaña
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <Filter className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No hay campañas que coincidan con los filtros</p>
            <button
              onClick={() => { setSearch(''); setStatusFilter('') }}
              className="mt-3 text-xs text-brand-600 hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
