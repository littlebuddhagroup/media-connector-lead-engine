'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import { Search, Plus, ChevronLeft, ChevronRight, X, Telescope } from 'lucide-react'
import { statusLabel, statusColor, priorityColor, scoreToBg, formatDateRelative } from '@/lib/utils'
import type { Lead, Campaign } from '@/types'
import Modal from '@/components/ui/Modal'

const STATUSES = [
  'new','enriched','pending_review','approved','contacted',
  'replied','interested','not_interested','meeting_scheduled','closed','discarded'
]
const PRIORITIES = ['low','medium','high']

const EMPTY_LEAD = {
  company_name: '', website: '', email: '', phone: '',
  country: '', city: '', sector: '', description: '', linkedin_url: '',
  priority: 'medium', campaign_id: '',
}

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

  // Modal nuevo lead
  const [showNewLead, setShowNewLead] = useState(false)
  const [newLead, setNewLead] = useState(EMPTY_LEAD)
  const [savingLead, setSavingLead] = useState(false)
  const [saveError, setSaveError] = useState('')

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

  useEffect(() => { fetchLeads() }, [fetchLeads])
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

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLead.company_name.trim()) { setSaveError('El nombre de la empresa es obligatorio'); return }
    setSavingLead(true)
    setSaveError('')
    const body: Record<string, string> = { ...newLead, source: 'manual' }
    if (!body.campaign_id) delete body.campaign_id
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSavingLead(false)
    if (res.ok) {
      setShowNewLead(false)
      setNewLead(EMPTY_LEAD)
      fetchLeads()
    } else {
      const json = await res.json()
      setSaveError(json.error || 'Error al crear el lead')
    }
  }

  const field = (key: keyof typeof newLead, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input text-sm"
        type={type}
        placeholder={placeholder}
        value={newLead[key]}
        onChange={e => setNewLead(prev => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  )

  return (
    <div className="animate-fade-in">
      <TopBar
        title="CRM / Leads"
        subtitle={`${total} leads en total`}
        actions={
          <div className="flex gap-2">
            <Link href="/discover" className="btn-secondary text-xs py-1.5">
              <Telescope className="w-3.5 h-3.5" /> Buscar empresas
            </Link>
            <button onClick={() => setShowNewLead(true)} className="btn-secondary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Nuevo lead
            </button>
            <Link href="/imports" className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Importar CSV
            </Link>
          </div>
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
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando leads...</td></tr>
                )}
                {!loading && leads.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-gray-400 mb-3">No hay leads con estos filtros.</p>
                    <button onClick={() => setShowNewLead(true)} className="btn-primary text-xs">
                      <Plus className="w-3.5 h-3.5" /> Crear primer lead
                    </button>
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
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{lead.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                      {(lead as unknown as { campaign?: { name: string } }).campaign?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select className="text-xs border-0 bg-transparent cursor-pointer focus:outline-none"
                        value={lead.status} onChange={(e) => updateLeadStatus(lead.id, e.target.value)}>
                        {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${priorityColor(lead.priority)}`}>{lead.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge font-semibold tabular-nums ${scoreToBg(lead.score)}`}>{lead.score}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDateRelative(lead.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="text-xs text-brand-600 hover:text-brand-700">Ver →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} de {total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  className="btn-secondary text-xs py-1.5 disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                  className="btn-secondary text-xs py-1.5 disabled:opacity-40">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nuevo lead manual */}
      <Modal isOpen={showNewLead} onClose={() => { setShowNewLead(false); setSaveError('') }} title="Nuevo lead" size="lg">
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Empresa <span className="text-red-400">*</span></label>
              <input className="input text-sm" placeholder="Nombre de la empresa" required
                value={newLead.company_name}
                onChange={e => setNewLead(p => ({ ...p, company_name: e.target.value }))} />
            </div>
            {field('website', 'Web', 'url', 'https://empresa.com')}
            {field('email', 'Email de contacto', 'email', 'contacto@empresa.com')}
            {field('phone', 'Teléfono', 'tel', '+34 600 000 000')}
            {field('country', 'País', 'text', 'España')}
            {field('city', 'Ciudad', 'text', 'Madrid')}
            {field('sector', 'Sector', 'text', 'Media, Tecnología...')}
            {field('linkedin_url', 'LinkedIn', 'url', 'https://linkedin.com/company/...')}
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input text-sm resize-none" rows={2} placeholder="Breve descripción de la empresa..."
              value={newLead.description}
              onChange={e => setNewLead(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prioridad</label>
              <select className="input text-sm" value={newLead.priority}
                onChange={e => setNewLead(p => ({ ...p, priority: e.target.value }))}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="label">Campaña</label>
              <select className="input text-sm" value={newLead.campaign_id}
                onChange={e => setNewLead(p => ({ ...p, campaign_id: e.target.value }))}>
                <option value="">Sin campaña</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setShowNewLead(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" disabled={savingLead} className="btn-primary text-xs">
              <Plus className="w-3.5 h-3.5" /> {savingLead ? 'Guardando...' : 'Crear lead'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
