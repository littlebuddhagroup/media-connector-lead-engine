'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import { Search, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { statusLabel, statusColor, priorityColor, scoreToBg, formatDateRelative } from '@/lib/utils'
import type { Lead, Campaign } from '@/types'

const STATUSES = [
  'new','enriched','pending_review','approved','contacted',
  'replied','interested','not_interested','meeting_scheduled','closed','discarded'
]
const PRIORITIES = ['low','medium','high']

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [campaignId, setCampaignId] = useState('')

  const perPage = 25

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), per_page: String(perPage),
      sort_by: 'score', sort_order: 'desc',
    })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    if (campaignId) params.set('campaign_id', campaignId)

    const res = await fetch(`/api/leads?${params}`)
    const json = await res.json()
    setLeads(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, search, status, priority, campaignId])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(j => setCampaigns(j.data ?? []))
  }, [])

  const totalPages = Math.ceil(total / perPage)

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchLeads()
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title="CRM / Leads"
        subtitle={`${total} leads en total`}
        actions={
          <Link href="/imports" className="btn-primary text-xs py-1.5">
            <Plus className="w-3.5 h-3.5" /> Importar leads
          </Link>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filtros */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9 text-sm"
                placeholder="Buscar empresa, email, dominio..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>

            <select className="input w-auto text-sm"
              value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
              <option value="">Todos los estados</option>
              {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>

            <select className="input w-auto text-sm"
              value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}>
              <option value="">Toda prioridad</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select className="input w-auto text-sm"
              value={campaignId} onChange={e => { setCampaignId(e.target.value); setPage(1) }}>
              <option value="">Todas las campañas</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Empresa', 'Email', 'Campaña', 'Estado', 'Prioridad', 'Score', 'Añadido', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando leads...</td></tr>
                )}
                {!loading && leads.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No hay leads con estos filtros.
                  </td></tr>
                )}
                {!loading && leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                        {lead.company_name}
                      </Link>
                      {lead.website && (
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{lead.domain || lead.website}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">
                      {lead.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                      {(lead as unknown as { campaign?: { name: string } }).campaign?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="text-xs border-0 bg-transparent cursor-pointer focus:outline-none"
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{statusLabel(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${priorityColor(lead.priority)}`}>{lead.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge font-semibold tabular-nums ${scoreToBg(lead.score)}`}>
                        {lead.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDateRelative(lead.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`}
                        className="text-xs text-brand-600 hover:text-brand-700 whitespace-nowrap">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} de {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  className="btn-secondary text-xs py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                  className="btn-secondary text-xs py-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
