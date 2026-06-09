'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import {
  Search, Plus, ChevronLeft, ChevronRight, Telescope, Zap, Loader2,
  CheckSquare, Square, X, Target, Check, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
  List, Eye, Tag, Bookmark, BookmarkPlus, FolderPlus, Folder, ChevronDown, ChevronRight as ChevronRightIcon,
  MoreHorizontal, Pencil, Save, Layers,
} from 'lucide-react'
import { statusLabel, priorityColor, scoreToBg, formatDateRelative } from '@/lib/utils'
import CompanyLogo from '@/components/ui/CompanyLogo'
import type { Lead, Campaign } from '@/types'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'

// ─── Types ───────────────────────────────────────────────────────────────────

const STATUSES = [
  'new','enriched','pending_review','approved','contacted',
  'replied','interested','not_interested','meeting_scheduled','closed','discarded',
]
const PRIORITIES = ['low','medium','high']

const EMPTY_LEAD = {
  company_name: '', first_name: '', last_name: '', job_title: '', department: '',
  website: '', email: '', phone: '',
  country: '', city: '', sector: '', description: '', linkedin_url: '',
  priority: 'medium', campaign_id: '',
}

type SortField = 'company_name' | 'score' | 'created_at' | 'status' | 'sector' | 'first_name' | 'department'
type SortDir = 'asc' | 'desc'

interface LeadList { id: string; name: string; color: string; icon: string; member_count: number }
interface SavedView { id: string; name: string; filters: Record<string, string> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <ArrowUpDown className="w-3 h-3 text-gray-300 inline ml-1" />
  return dir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-brand-500 inline ml-1" />
    : <ArrowDown className="w-3 h-3 text-brand-500 inline ml-1" />
}

const LIST_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4']
const LIST_ICONS  = ['📋','📁','⭐','🔥','🎯','💼','🏷️','📌','🚀','💡','✅','🌍']

// ─── Tag chip component ───────────────────────────────────────────────────────

function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-brand-50 text-brand-700 text-xs rounded-full border border-brand-100 whitespace-nowrap">
      {tag}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}

// ─── Inline tag editor ────────────────────────────────────────────────────────

function TagEditor({ leadId, initialTags, onSaved }: {
  leadId: string; initialTags: string[]; onSaved: (tags: string[]) => void
}) {
  const [tags, setTags] = useState(initialTags)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async () => {
    const val = input.trim().toLowerCase().replace(/\s+/g, '-')
    if (!val || tags.includes(val)) { setInput(''); return }
    const next = [...tags, val]
    setTags(next)
    setInput('')
    await save(next)
  }

  const remove = async (t: string) => {
    const next = tags.filter(x => x !== t)
    setTags(next)
    await save(next)
  }

  const save = async (newTags: string[]) => {
    setSaving(true)
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    setSaving(false)
    onSaved(newTags)
  }

  return (
    <div className="flex items-center flex-wrap gap-1 min-w-[120px]">
      {tags.map(t => <TagChip key={t} tag={t} onRemove={() => remove(t)} />)}
      <input
        className="text-xs border-0 outline-none bg-transparent w-20 text-gray-500 placeholder:text-gray-300"
        placeholder={saving ? '...' : '+etiqueta'}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !input && tags.length) remove(tags[tags.length - 1])
        }}
        onBlur={add}
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [tag, setTag] = useState('')
  const [sector, setSector] = useState('')
  const [country, setCountry] = useState('')

  // Ordenación
  const [sortBy, setSortBy] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Selección masiva
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [enrichJob, setEnrichJob] = useState<{ done: number; total: number; errors: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showSelectMenu, setShowSelectMenu] = useState(false)

  // Asignar a campaña
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignCampaignId, setAssignCampaignId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Añadir a lista
  const [showAddToListModal, setShowAddToListModal] = useState(false)
  const [addToListId, setAddToListId] = useState('')
  const [addingToList, setAddingToList] = useState(false)

  // Modal nuevo lead
  const [showNewLead, setShowNewLead] = useState(false)
  const [newLead, setNewLead] = useState(EMPTY_LEAD)
  const [savingLead, setSavingLead] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Listas y vistas
  const [lists, setLists] = useState<LeadList[]>([])
  const [views, setViews] = useState<SavedView[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  // Panel lateral móvil
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Panel lateral: crear lista
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListColor, setNewListColor] = useState(LIST_COLORS[0])
  const [newListIcon, setNewListIcon] = useState(LIST_ICONS[0])
  const [savingList, setSavingList] = useState(false)

  // Editar lista
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editListName, setEditListName] = useState('')
  const [editListColor, setEditListColor] = useState(LIST_COLORS[0])
  const [editListIcon, setEditListIcon] = useState(LIST_ICONS[0])
  const [savingListEdit, setSavingListEdit] = useState(false)

  // Eliminar lista
  const [deleteListModal, setDeleteListModal] = useState<{ id: string; name: string; memberCount: number } | null>(null)
  const [deleteLeadsAlso, setDeleteLeadsAlso] = useState(false)
  const [deletingList, setDeletingList] = useState(false)

  // Guardar vista
  const [showSaveView, setShowSaveView] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [savingView, setSavingView] = useState(false)

  // Editar vista
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [editViewName, setEditViewName] = useState('')
  const [savingViewEdit, setSavingViewEdit] = useState(false)

  // Tags locales (para actualización optimista en tabla)
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({})

  const [perPage, setPerPage] = useState(50)

  // Agrupación por empresa y auto-enriquecimiento
  // true por defecto: en MMC los leads se ven más útiles agrupados por empresa
  const [groupByCompany, setGroupByCompany] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [enrichingLead, setEnrichingLead] = useState<{ id: string; name: string } | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), per_page: String(perPage),
      sort_by: sortBy, sort_order: sortDir,
    })
    if (search)       params.set('search', search)
    if (status)       params.set('status', status)
    if (priority)     params.set('priority', priority)
    if (campaignId)   params.set('campaign_id', campaignId)
    if (tag)          params.set('tag', tag)
    if (sector)       params.set('sector', sector)
    if (country)      params.set('country', country)
    if (activeListId) params.set('list_id', activeListId)

    const res = await fetch(`/api/leads?${params}`)
    const json = await res.json()
    if (!res.ok) {
      console.error('[fetchLeads] API error:', json.error)
      setLeads([])
      setTotal(0)
      setLoading(false)
      return
    }
    setLeads(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
    setSelected(new Set())
  }, [page, perPage, search, status, priority, campaignId, tag, sector, country, activeListId, sortBy, sortDir])

  const fetchSidebar = useCallback(async () => {
    const [listsRes, viewsRes] = await Promise.all([
      fetch('/api/lists').then(r => r.json()),
      fetch('/api/views').then(r => r.json()),
    ])
    setLists(listsRes.data ?? [])
    setViews(viewsRes.data ?? [])
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(j => setCampaigns(j.data ?? []))
    fetchSidebar()
  }, [fetchSidebar])

  const totalPages = Math.ceil(total / perPage)

  // ─── Limpiar todos los filtros ────────────────────────────────
  const clearFilters = () => {
    setSearch(''); setStatus(''); setPriority(''); setCampaignId('')
    setTag(''); setSector(''); setCountry('')
    setActiveListId(null); setActiveViewId(null)
    setPage(1)
  }

  const hasFilters = search || status || priority || campaignId || tag || sector || country || activeListId

  // ─── Aplicar vista guardada ───────────────────────────────────
  const applyView = (view: SavedView) => {
    clearFilters()
    const f = view.filters
    if (f.search)      setSearch(f.search)
    if (f.status)      setStatus(f.status)
    if (f.priority)    setPriority(f.priority)
    if (f.campaign_id) setCampaignId(f.campaign_id)
    if (f.tag)         setTag(f.tag)
    if (f.sector)      setSector(f.sector)
    if (f.country)     setCountry(f.country)
    setActiveViewId(view.id)
    setActiveListId(null)
    setPage(1)
  }

  const applyList = (listId: string | null) => {
    clearFilters()
    setActiveListId(listId)
    setActiveViewId(null)
    setPage(1)
  }

  // ─── Ordenación ───────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (field === sortBy) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
    setPage(1)
  }

  // ─── Selección masiva ─────────────────────────────────────────
  const [selectAllPages, setSelectAllPages] = useState(false)
  const [loadingSelectAll, setLoadingSelectAll] = useState(false)
  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id))
  const someSelected = selected.size > 0
  const toggleAll = () => {
    if (allSelected) { setSelected(new Set()); setSelectAllPages(false) }
    else { setSelected(new Set(leads.map(l => l.id))); setSelectAllPages(false) }
  }
  const toggleOne = (id: string) => {
    setSelectAllPages(false)
    setSelected(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  const toggleGroup = (groupLeads: Lead[]) => {
    const ids = groupLeads.map(l => l.id)
    const allGroupSelected = ids.every(id => selected.has(id))
    setSelectAllPages(false)
    setSelected(prev => {
      const next = new Set(prev)
      if (allGroupSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  // Seleccionar TODOS los leads que coinciden con los filtros actuales (todas las páginas)
  const handleSelectAllPages = async () => {
    setLoadingSelectAll(true)
    const params = new URLSearchParams({ sort_by: sortBy, sort_order: sortDir })
    if (search)       params.set('search', search)
    if (status)       params.set('status', status)
    if (priority)     params.set('priority', priority)
    if (campaignId)   params.set('campaign_id', campaignId)
    if (tag)          params.set('tag', tag)
    if (sector)       params.set('sector', sector)
    if (country)      params.set('country', country)
    if (activeListId) params.set('list_id', activeListId)
    const res = await fetch(`/api/leads/ids?${params}`)
    const json = await res.json()
    setSelected(new Set(json.ids ?? []))
    setSelectAllPages(true)
    setLoadingSelectAll(false)
  }

  // ─── Borrado masivo ───────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selected.size} lead(s) definitivamente? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const ids = Array.from(selected)
    const res = await fetch('/api/leads/bulk-delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_ids: ids }),
    })
    setDeleting(false)
    if (res.ok) {
      toast.success('Leads eliminados', `${ids.length} leads borrados correctamente.`)
      setSelected(new Set()); fetchLeads()
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudieron eliminar los leads.')
    }
  }

  // ─── Enriquecimiento masivo (no-bloqueante) ──────────────────
  const handleBulkEnrich = async () => {
    const ids = Array.from(selected)
    if (!ids.length) return

    // Liberar la selección inmediatamente → el usuario puede seguir trabajando
    setSelected(new Set())
    setEnrichJob({ done: 0, total: ids.length, errors: 0 })

    const CONCURRENCY = 3
    let done = 0
    let errors = 0

    // Procesar en paralelo con concurrencia controlada, lead a lead
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY)
      await Promise.all(chunk.map(async (leadId) => {
        try {
          const res = await fetch(`/api/leads/${leadId}/enrich`, { method: 'POST' })
          if (!res.ok) errors++
        } catch {
          errors++
        }
        done++
        setEnrichJob({ done, total: ids.length, errors })
      }))
    }

    setEnrichJob(null)
    fetchLeads()
    if (errors > 0) {
      toast.warning(`${ids.length - errors} enriquecidos`, `${errors} no pudieron procesarse.`)
    } else {
      toast.success('Enriquecimiento completado', `${ids.length} leads analizados con IA.`)
    }
  }

  // ─── Asignar a campaña ────────────────────────────────────────
  const handleAssignToCampaign = async () => {
    if (!assignCampaignId) return
    const ids = Array.from(selected)
    setAssigning(true)
    const res = await fetch(`/api/campaigns/${assignCampaignId}/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_ids: ids }),
    })
    const json = await res.json()
    setAssigning(false); setShowAssignModal(false); setAssignCampaignId('')
    if (res.ok) {
      const campName = campaigns.find(c => c.id === assignCampaignId)?.name ?? 'campaña'
      toast.success('Leads asignados', `${ids.length} leads asignados a "${campName}"`)
      setSelected(new Set()); fetchLeads()
    } else {
      toast.error('Error', json.error ?? 'No se pudieron asignar los leads')
    }
  }

  // ─── Añadir a lista ───────────────────────────────────────────
  const handleAddToList = async () => {
    if (!addToListId) return
    const ids = Array.from(selected)
    setAddingToList(true)
    const res = await fetch(`/api/lists/${addToListId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_ids: ids }),
    })
    const json = await res.json()
    setAddingToList(false); setShowAddToListModal(false); setAddToListId('')
    if (res.ok) {
      const listName = lists.find(l => l.id === addToListId)?.name ?? 'lista'
      toast.success('Añadidos a lista', `${ids.length} leads añadidos a "${listName}"`)
      setSelected(new Set()); fetchSidebar()
    } else {
      toast.error('Error', json.error ?? 'No se pudieron añadir a la lista')
    }
  }

  // ─── Crear lista ──────────────────────────────────────────────
  const handleCreateList = async () => {
    if (!newListName.trim()) return
    setSavingList(true)
    const res = await fetch('/api/lists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName, color: newListColor, icon: newListIcon }),
    })
    const json = await res.json()
    setSavingList(false)
    if (res.ok) {
      setNewListName(''); setShowNewList(false)
      fetchSidebar()
      toast.success('Lista creada', `"${json.data.name}" lista creada correctamente.`)
    } else {
      toast.error('Error', json.error)
    }
  }

  // ─── Eliminar lista ───────────────────────────────────────────
  const handleDeleteList = (listId: string, name: string, memberCount: number) => {
    setDeleteLeadsAlso(false)
    setDeleteListModal({ id: listId, name, memberCount })
  }

  const handleConfirmDeleteList = async () => {
    if (!deleteListModal) return
    setDeletingList(true)
    const url = deleteLeadsAlso
      ? `/api/lists/${deleteListModal.id}?delete_leads=true`
      : `/api/lists/${deleteListModal.id}`
    await fetch(url, { method: 'DELETE' })
    setDeletingList(false)
    if (activeListId === deleteListModal.id) applyList(null)
    setDeleteListModal(null)
    fetchSidebar()
    fetchLeads()
    toast.success(
      'Lista eliminada',
      deleteLeadsAlso
        ? `"${deleteListModal.name}" y sus ${deleteListModal.memberCount} leads han sido eliminados.`
        : `"${deleteListModal.name}" eliminada. Los leads se han conservado.`
    )
  }

  // ─── Guardar vista ────────────────────────────────────────────
  const handleSaveView = async () => {
    if (!newViewName.trim()) return
    const filters: Record<string, string> = {}
    if (search)     filters.search     = search
    if (status)     filters.status     = status
    if (priority)   filters.priority   = priority
    if (campaignId) filters.campaign_id = campaignId
    if (tag)        filters.tag        = tag
    if (sector)     filters.sector     = sector
    if (country)    filters.country    = country
    setSavingView(true)
    const res = await fetch('/api/views', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newViewName, filters }),
    })
    const json = await res.json()
    setSavingView(false)
    if (res.ok) {
      setNewViewName(''); setShowSaveView(false)
      fetchSidebar()
      toast.success('Vista guardada', `"${json.data.name}" guardada.`)
    } else {
      toast.error('Error', json.error)
    }
  }

  const handleDeleteView = async (viewId: string) => {
    await fetch(`/api/views/${viewId}`, { method: 'DELETE' })
    if (activeViewId === viewId) clearFilters()
    fetchSidebar()
  }

  const handleOpenEditView = (v: SavedView) => {
    setEditingViewId(v.id)
    setEditViewName(v.name)
  }

  const handleSaveViewEdit = async () => {
    if (!editingViewId || !editViewName.trim()) return
    setSavingViewEdit(true)
    await fetch(`/api/views/${editingViewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editViewName }),
    })
    setSavingViewEdit(false)
    setEditingViewId(null)
    fetchSidebar()
  }

  const handleOpenEditList = (l: LeadList) => {
    setEditingListId(l.id)
    setEditListName(l.name)
    setEditListColor(l.color)
    setEditListIcon(l.icon)
  }

  const handleSaveListEdit = async () => {
    if (!editingListId || !editListName.trim()) return
    setSavingListEdit(true)
    await fetch(`/api/lists/${editingListId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editListName, color: editListColor, icon: editListIcon }),
    })
    setSavingListEdit(false)
    setEditingListId(null)
    fetchSidebar()
  }

  // ─── Crear lead ───────────────────────────────────────────────
  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchLeads()
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLead.company_name.trim()) { setSaveError('El nombre de la empresa es obligatorio'); return }
    setSavingLead(true); setSaveError('')
    const body: Record<string, string> = { ...newLead, source: 'manual' }
    if (!body.campaign_id) delete body.campaign_id
    const res = await fetch('/api/leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSavingLead(false)
    if (res.ok) {
      const json = await res.json()
      // Si estamos dentro de una lista, añadir el lead a esa lista automáticamente
      if (activeListId && json.data?.id) {
        await fetch(`/api/lists/${activeListId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids: [json.data.id] }),
        })
      }
      setShowNewLead(false); setNewLead(EMPTY_LEAD); fetchLeads()
      // Auto-enriquecimiento si hay dominio/web
      if (json.shouldEnrich && json.data?.id) {
        const leadName = json.data.company_name
        setEnrichingLead({ id: json.data.id, name: leadName })
        fetch(`/api/leads/${json.data.id}/enrich`, { method: 'POST' })
          .then(async r => {
            const enrichJson = await r.json()
            setEnrichingLead(null)
            if (r.ok) {
              toast.success('Lead enriquecido', `${leadName} — Score: ${enrichJson.data?.score ?? '—'}/100`)
              fetchLeads()
            } else {
              toast.error('Enriquecimiento fallido', enrichJson.error ?? 'No se pudo enriquecer')
            }
          })
          .catch(() => { setEnrichingLead(null) })
      }
    } else { const json = await res.json(); setSaveError(json.error || 'Error al crear el lead') }
  }

  const field = (key: keyof typeof newLead, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input className="input text-sm" type={type} placeholder={placeholder}
        value={newLead[key]}
        onChange={e => setNewLead(prev => ({ ...prev, [key]: e.target.value }))} />
    </div>
  )

  const thSort = (label: string, f: SortField) => (
    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-brand-600 select-none"
      onClick={() => handleSort(f)}>
      {label}<SortIcon field={f} current={sortBy} dir={sortDir} />
    </th>
  )

  // ─── Active context label ─────────────────────────────────────
  const contextLabel = activeListId
    ? lists.find(l => l.id === activeListId)?.name ?? 'Lista'
    : activeViewId
    ? views.find(v => v.id === activeViewId)?.name ?? 'Vista'
    : null

  // Contenido del panel lateral (reutilizado en desktop y drawer móvil)
  const sidebarContent = (
    <div className="p-3 space-y-1 flex-1 overflow-y-auto">{/* contenido se inyecta abajo */}</div>
  )
  void sidebarContent

  return (
    <div className="animate-fade-in flex h-full min-w-0">

      {/* ── Overlay móvil para el sidebar ───────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Panel lateral izquierdo ──────────────────────────── */}
      {/* Desktop: siempre visible | Móvil: drawer desde la izquierda */}
      <aside className={`
        shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col overflow-y-auto
        md:w-52 md:static md:translate-x-0
        fixed top-14 bottom-16 left-0 z-40 w-64 transition-transform duration-300
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-3 space-y-1">

          {/* Todos los leads */}
          <button
            onClick={() => applyList(null)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
              !activeListId && !activeViewId ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <List className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 truncate">Todos los leads</span>
            {!activeListId && !activeViewId && (
              <span className="text-xs text-brand-500 font-semibold tabular-nums">{total}</span>
            )}
          </button>

          {/* ── Vistas guardadas ─────────────────────────────── */}
          <div className="pt-3">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vistas</span>
              <button
                onClick={() => { setShowSaveView(true) }}
                title="Guardar vista actual"
                className="text-gray-400 hover:text-brand-600 transition-colors"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
              </button>
            </div>
            {views.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">
                Aplica filtros y guárdalos como vista.
              </p>
            )}
            {views.map(v => (
              <div key={v.id}>
                {editingViewId === v.id ? (
                  <div className="mx-1 mb-1 p-2 bg-white border border-brand-200 rounded-lg space-y-1.5">
                    <input
                      autoFocus
                      className="input text-xs py-1 w-full"
                      value={editViewName}
                      onChange={e => setEditViewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveViewEdit(); if (e.key === 'Escape') setEditingViewId(null) }}
                    />
                    <div className="flex gap-1">
                      <button onClick={handleSaveViewEdit} disabled={savingViewEdit || !editViewName.trim()}
                        className="flex-1 text-xs bg-brand-600 text-white py-1 rounded-md hover:bg-brand-700 disabled:opacity-40 transition-colors">
                        {savingViewEdit ? '...' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingViewId(null)}
                        className="flex-1 text-xs border border-gray-200 py-1 rounded-md hover:bg-gray-50 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-center gap-0.5">
                    <button
                      onClick={() => applyView(v)}
                      className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left ${
                        activeViewId === v.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Eye className="w-3 h-3 shrink-0" />
                      <span className="truncate text-xs">{v.name}</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditView(v)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-brand-500 transition-all"
                      title="Renombrar vista"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteView(v.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
                      title="Eliminar vista"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Listas ───────────────────────────────────────── */}
          <div className="pt-3">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Listas</span>
              <button
                onClick={() => setShowNewList(true)}
                title="Nueva lista"
                className="text-gray-400 hover:text-brand-600 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
            {lists.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">
                Crea listas para agrupar leads manualmente.
              </p>
            )}
            {lists.map(l => (
              <div key={l.id}>
                {editingListId === l.id ? (
                  <div className="mx-1 mb-1 p-2 bg-white border border-brand-200 rounded-lg space-y-1.5">
                    <input
                      autoFocus
                      className="input text-xs py-1 w-full"
                      value={editListName}
                      onChange={e => setEditListName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingListId(null) }}
                    />
                    <div className="flex gap-1 flex-wrap">
                      {LIST_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setEditListColor(c)}
                          className={`w-4 h-4 rounded-full transition-transform ${editListColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                    <div className="flex gap-0.5 flex-wrap">
                      {LIST_ICONS.map(ic => (
                        <button key={ic} type="button" onClick={() => setEditListIcon(ic)}
                          className={`text-sm p-0.5 rounded transition-colors ${editListIcon === ic ? 'bg-brand-100' : 'hover:bg-gray-100'}`}>
                          {ic}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={handleSaveListEdit} disabled={savingListEdit || !editListName.trim()}
                        className="flex-1 text-xs bg-brand-600 text-white py-1 rounded-md hover:bg-brand-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1">
                        <Save className="w-3 h-3" />{savingListEdit ? '...' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingListId(null)}
                        className="flex-1 text-xs border border-gray-200 py-1 rounded-md hover:bg-gray-50 transition-colors">
                        Cancelar
                      </button>
                      <button
                        onClick={() => { setEditingListId(null); handleDeleteList(l.id, l.name, l.member_count) }}
                        className="text-xs border border-red-200 text-red-500 py-1 px-2 rounded-md hover:bg-red-50 transition-colors flex items-center gap-1"
                        title="Eliminar lista"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-center gap-0.5">
                    <button
                      onClick={() => applyList(l.id)}
                      className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left ${
                        activeListId === l.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span style={{ color: l.color }}>{l.icon}</span>
                      <span className="flex-1 truncate text-xs">{l.name}</span>
                      <span className="text-xs tabular-nums text-gray-400">{l.member_count}</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditList(l)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-brand-500 transition-all"
                      title="Editar lista"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Crear nueva lista (inline) */}
        {showNewList && (
          <div className="mx-3 mb-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm space-y-2">
            <p className="text-xs font-semibold text-gray-700">Nueva lista</p>
            <input
              autoFocus
              className="input text-xs py-1"
              placeholder="Nombre de la lista"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateList() }}
            />
            <div>
              <p className="text-xs text-gray-400 mb-1">Color</p>
              <div className="flex gap-1 flex-wrap">
                {LIST_COLORS.map(c => (
                  <button key={c} type="button"
                    onClick={() => setNewListColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${newListColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Icono</p>
              <div className="flex gap-0.5 flex-wrap">
                {LIST_ICONS.map(ic => (
                  <button key={ic} type="button"
                    onClick={() => setNewListIcon(ic)}
                    className={`text-base p-0.5 rounded transition-colors ${newListIcon === ic ? 'bg-brand-100' : 'hover:bg-gray-100'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 pt-1">
              <button onClick={handleCreateList} disabled={savingList || !newListName.trim()}
                className="flex-1 text-xs bg-brand-600 text-white py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors">
                {savingList ? '...' : 'Crear'}
              </button>
              <button onClick={() => setShowNewList(false)}
                className="flex-1 text-xs border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Contenido principal ──────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <TopBar
          title={contextLabel ? `${contextLabel}` : 'CRM / Leads'}
          subtitle={`${total} leads${contextLabel ? ` en ${contextLabel}` : ' en total'}`}
          actions={
            <div className="flex gap-1.5 flex-wrap">
              {/* Botón abrir sidebar solo en móvil */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden btn-secondary text-xs py-1.5 px-2"
                title="Listas y vistas"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <Link href="/discover" className="btn-secondary text-xs py-1.5">
                <Telescope className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Buscar</span>
              </Link>
              <button onClick={() => setShowNewLead(true)} className="btn-secondary text-xs py-1.5">
                <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Nuevo</span>
              </button>
              <button
                onClick={() => { setGroupByCompany(g => !g); setExpandedGroups(new Set()) }}
                className={`btn-secondary text-xs py-1.5 ${groupByCompany ? 'bg-brand-50 text-brand-700 border-brand-200' : ''}`}
                title="Agrupar por empresa"
              >
                <Layers className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Agrupar</span>
              </button>
              <Link
                href={activeListId
                  ? `/imports?list=${activeListId}&listName=${encodeURIComponent(lists.find(l => l.id === activeListId)?.name ?? '')}`
                  : '/imports'}
                className="btn-primary text-xs py-1.5"
              >
                <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Importar</span>
              </Link>
            </div>
          }
        />

        {/* Banner de auto-enriquecimiento en curso */}
        {enrichingLead && (
          <div className="flex items-center gap-3 px-5 py-3 text-sm bg-brand-50 border-b border-brand-100">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-brand-700">Enriqueciendo lead con IA</span>
              <span className="ml-2 text-xs text-brand-500">{enrichingLead.name}</span>
            </div>
            <div className="w-24 h-1 bg-brand-200 rounded-full overflow-hidden shrink-0">
              <div className="h-full bg-brand-500 rounded-full" style={{ animation: 'progress-indeterminate 1.5s ease-in-out infinite', width: '40%' }} />
            </div>
          </div>
        )}

        <div className="p-2 md:p-4 space-y-2 md:space-y-3">

          {/* Filtros */}
          <div className="card p-2 md:p-3">
            {/* Búsqueda siempre visible */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input className="input pl-8 text-sm py-1.5 w-full"
                placeholder="Buscar empresa, nombre, email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
            {/* Filtros secundarios — en móvil van en grid 2 columnas */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-1.5">
              <select className="input text-xs py-1.5" value={status}
                onChange={e => { setStatus(e.target.value); setPage(1) }}>
                <option value="">Estado</option>
                {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <select className="input text-xs py-1.5" value={priority}
                onChange={e => { setPriority(e.target.value); setPage(1) }}>
                <option value="">Prioridad</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="input text-xs py-1.5" value={campaignId}
                onChange={e => { setCampaignId(e.target.value); setPage(1) }}>
                <option value="">Campaña</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="input text-xs py-1.5" placeholder="Sector"
                value={sector} onChange={e => { setSector(e.target.value); setPage(1) }} />
              <input className="input text-xs py-1.5" placeholder="País"
                value={country} onChange={e => { setCountry(e.target.value); setPage(1) }} />
              <div className="relative">
                <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input className="input pl-6 text-xs py-1.5 w-full" placeholder="Etiqueta"
                  value={tag} onChange={e => { setTag(e.target.value); setPage(1) }} />
              </div>
              {hasFilters && (
                <div className="col-span-2 md:col-span-1 flex gap-1.5 items-center">
                  <button
                    onClick={() => { setShowSaveView(true); setNewViewName('') }}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 border border-brand-200 bg-brand-50 px-2 py-1.5 rounded-lg transition-colors"
                  >
                    <Bookmark className="w-3 h-3" /> Guardar vista
                  </button>
                  <button onClick={clearFilters}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1.5 rounded-lg transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Barra de acciones masivas */}
          {someSelected && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl">
                <span className="text-sm font-medium text-brand-800">
                  {selectAllPages
                    ? <><CheckSquare className="w-4 h-4 inline mr-1 text-brand-600" />{selected.size} leads seleccionados (todas las páginas)</>
                    : <>{selected.size} lead{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</>
                  }
                </span>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <>
                    <button onClick={() => { setAddToListId(''); setShowAddToListModal(true) }}
                      className="btn-secondary text-xs py-1.5">
                      <Folder className="w-3.5 h-3.5" /> Añadir a lista
                    </button>
                    <button onClick={() => { setAssignCampaignId(''); setShowAssignModal(true) }}
                      className="btn-secondary text-xs py-1.5">
                      <Target className="w-3.5 h-3.5" /> Asignar campaña
                    </button>
                    <button onClick={handleBulkEnrich} disabled={!!enrichJob} className="btn-secondary text-xs py-1.5 disabled:opacity-50">
                      <Zap className="w-3.5 h-3.5" /> Enriquecer con IA
                    </button>
                    <button onClick={handleBulkDelete} disabled={deleting}
                      className="text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5">
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Eliminar
                    </button>
                  </>
                  <button onClick={() => { setSelected(new Set()); setSelectAllPages(false) }} className="btn-secondary text-xs py-1.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {selectAllPages && (
                <div className="flex items-center justify-center gap-3 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
                  <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                  <span>Todos los <strong>{selected.size}</strong> leads están seleccionados.</span>
                  <button
                    onClick={() => { setSelected(new Set(leads.map(l => l.id))); setSelectAllPages(false) }}
                    className="underline hover:text-green-900"
                  >
                    Cancelar selección global
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tabla */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto -mx-px">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-2 md:px-3 py-3 w-10 relative">
                      <div className="flex items-center gap-0.5">
                        <button onClick={toggleAll} className="transition-colors" style={{ color: allSelected ? '#D80003' : 'var(--text-dim, #9ca3af)' }}>
                          {allSelected
                            ? <CheckSquare className="w-4 h-4" style={{ color: '#D80003' }} />
                            : someSelected
                            ? <div style={{ width: '16px', height: '16px', border: '2px solid #9ca3af', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '8px', height: '2px', background: '#9ca3af', borderRadius: '1px' }} />
                              </div>
                            : <Square className="w-4 h-4" />
                          }
                        </button>
                        <button
                          onClick={() => setShowSelectMenu(m => !m)}
                          className="text-gray-300 hover:text-gray-500 transition-colors"
                          style={{ padding: '1px' }}
                          title="Opciones de selección"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      {showSelectMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowSelectMenu(false)} />
                          <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[220px] mt-1" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                            <button
                              onClick={() => { setSelected(new Set(leads.map(l => l.id))); setSelectAllPages(false); setShowSelectMenu(false) }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 transition-colors"
                            >
                              <Square className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span>Esta página <span className="text-gray-400 ml-1">({leads.length})</span></span>
                            </button>
                            <button
                              onClick={() => { handleSelectAllPages(); setShowSelectMenu(false) }}
                              disabled={loadingSelectAll}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                              {loadingSelectAll
                                ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ color: '#D80003' }} />
                                : <CheckSquare className="w-3.5 h-3.5 shrink-0" style={{ color: '#D80003' }} />
                              }
                              <span className="font-semibold">Seleccionar todo <span className="font-normal text-gray-400 ml-1">({total})</span></span>
                            </button>
                            {someSelected && (
                              <>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={() => { setSelected(new Set()); setSelectAllPages(false); setShowSelectMenu(false) }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5 shrink-0" />
                                  Deseleccionar todo
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </th>
                    {thSort('Empresa', 'company_name')}
                    {/* Columnas solo visibles en md+ */}
                    <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Nombre</th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Apellido</th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cargo</th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Dpto.</th>
                    <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Sector</th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Etiquetas</th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Campaña</th>
                    {thSort('Estado', 'status')}
                    {thSort('Score', 'score')}
                    <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Añadido</th>
                    <th className="px-2 md:px-3 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Cargando leads...
                    </td></tr>
                  )}
                  {!loading && leads.length === 0 && (
                    <tr><td colSpan={13} className="px-4 py-12 text-center">
                      <p className="text-gray-400 mb-3">
                        {activeListId ? 'Esta lista está vacía. Selecciona leads y usa "Añadir a lista".' : 'No hay leads con estos filtros.'}
                      </p>
                      {!activeListId && (
                        <button onClick={() => setShowNewLead(true)} className="btn-primary text-xs">
                          <Plus className="w-3.5 h-3.5" /> Crear primer lead
                        </button>
                      )}
                    </td></tr>
                  )}
                  {!loading && (() => {
                    if (!groupByCompany) {
                      return leads.map((lead) => {
                        const leadTags = localTags[lead.id] ?? (lead as unknown as { tags?: string[] }).tags ?? []
                        return (
                          <tr key={lead.id}
                            className={`transition-colors ${selected.has(lead.id) ? 'bg-brand-50/40' : 'odd:bg-white even:bg-indigo-50/30 hover:bg-indigo-50/60'}`}>
                            <td className="px-3 py-2.5">
                              <button onClick={() => toggleOne(lead.id)} className="text-gray-400 hover:text-brand-600 transition-colors">
                                {selected.has(lead.id) ? <CheckSquare className="w-4 h-4 text-brand-600" /> : <Square className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <CompanyLogo website={lead.website} companyName={lead.company_name} size={24} />
                                <div className="min-w-0">
                                  <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-brand-700 block truncate max-w-[120px]">
                                    {lead.company_name}
                                  </Link>
                                  {lead.website && <p className="text-xs text-gray-400 truncate max-w-[120px]">{lead.domain || lead.website}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="hidden md:table-cell px-3 py-2.5 text-gray-700 text-sm whitespace-nowrap font-medium">
                              {lead.first_name || <span className="text-gray-300 font-normal text-xs">—</span>}
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2.5 text-gray-700 text-sm whitespace-nowrap font-medium">
                              {lead.last_name || <span className="text-gray-300 font-normal text-xs">—</span>}
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2.5 text-gray-600 text-sm max-w-[140px] truncate">
                              {(lead as unknown as { job_title?: string }).job_title || <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2.5 text-gray-600 text-sm max-w-[120px] truncate">
                              {lead.department || <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="hidden md:table-cell px-3 py-2.5 text-gray-700 text-sm max-w-[160px] truncate">{lead.email || <span className="text-gray-300 text-xs">—</span>}</td>
                            <td className="hidden lg:table-cell px-3 py-2.5 text-gray-600 text-sm max-w-[110px] truncate">{lead.sector || <span className="text-gray-300 text-xs">—</span>}</td>
                            <td className="hidden lg:table-cell px-3 py-2.5 max-w-[180px]">
                              <TagEditor
                                leadId={lead.id}
                                initialTags={leadTags}
                                onSaved={tags => setLocalTags(prev => ({ ...prev, [lead.id]: tags }))}
                              />
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">
                              {(lead as unknown as { campaign?: { name: string } }).campaign?.name || '—'}
                            </td>
                            <td className="px-2 md:px-3 py-2.5">
                              <select className="text-xs border-0 bg-transparent cursor-pointer focus:outline-none max-w-[80px] md:max-w-none"
                                value={lead.status} onChange={(e) => updateLeadStatus(lead.id, e.target.value)}>
                                {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                              </select>
                            </td>
                            <td className="px-2 md:px-3 py-2.5">
                              <span className={`badge font-semibold tabular-nums ${scoreToBg(lead.score)}`}>{lead.score}</span>
                            </td>
                            <td className="hidden md:table-cell px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDateRelative(lead.created_at)}</td>
                            <td className="px-2 md:px-3 py-2.5">
                              <Link href={`/leads/${lead.id}`} className="text-xs text-brand-600 hover:text-brand-700">Ver →</Link>
                            </td>
                          </tr>
                        )
                      })
                    }

                    // ── Agrupado por empresa ──────────────────────────────
                    const groups = new Map<string, Lead[]>()
                    for (const lead of leads) {
                      const key = (lead.company_name ?? '').trim().toLowerCase() || '(sin empresa)'
                      if (!groups.has(key)) groups.set(key, [])
                      groups.get(key)!.push(lead)
                    }
                    const groupEntries = Array.from(groups.entries())
                    return groupEntries.map(([groupKey, groupLeads]) => {
                      const first = groupLeads[0]
                      const isExpanded = expandedGroups.has(groupKey)
                      const maxScore = Math.max(...groupLeads.map(l => l.score ?? 0))
                      const toggle = () => setExpandedGroups(prev => {
                        const next = new Set(prev)
                        next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey)
                        return next
                      })
                      return (
                        <>
                          {/* Fila de grupo */}
                          <tr key={`group-${groupKey}`}
                            className="bg-gray-50/80 hover:bg-brand-50/30 cursor-pointer border-b border-gray-100 transition-colors"
                            onClick={toggle}>
                            <td className="px-3 py-3 w-10" onClick={e => e.stopPropagation()}>
                              {(() => {
                                const ids = groupLeads.map(l => l.id)
                                const allSel = ids.every(id => selected.has(id))
                                const someSel = ids.some(id => selected.has(id))
                                return (
                                  <button onClick={() => toggleGroup(groupLeads)} className="transition-colors" style={{ color: allSel ? '#D80003' : 'var(--text-dim, #9ca3af)' }}>
                                    {allSel
                                      ? <CheckSquare className="w-4 h-4" style={{ color: '#D80003' }} />
                                      : someSel
                                      ? <div style={{ width: '16px', height: '16px', border: '2px solid #9ca3af', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <div style={{ width: '8px', height: '2px', background: '#9ca3af', borderRadius: '1px' }} />
                                        </div>
                                      : <Square className="w-4 h-4" />
                                    }
                                  </button>
                                )
                              })()}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                                </span>
                                <CompanyLogo website={first.website} companyName={first.company_name} size={24} />
                                <span className="font-semibold text-sm text-gray-900 truncate">{first.company_name}</span>
                                <span className="ml-1 text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">
                                  {groupLeads.length} contacto{groupLeads.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                            <td className="hidden md:table-cell px-3 py-3 text-xs text-gray-400" colSpan={7}>
                              {first.website || first.domain || ''}
                            </td>
                            <td className="hidden lg:table-cell px-3 py-3" colSpan={2}></td>
                            <td className="px-2 md:px-3 py-3">
                              <span className={`badge font-semibold tabular-nums ${scoreToBg(maxScore)}`}>{maxScore}</span>
                            </td>
                            <td className="hidden md:table-cell px-3 py-3"></td>
                            <td className="px-2 md:px-3 py-3"></td>
                          </tr>
                          {/* Filas de contactos (expandido) */}
                          {isExpanded && groupLeads.map(lead => {
                            const leadTags = localTags[lead.id] ?? (lead as unknown as { tags?: string[] }).tags ?? []
                            return (
                              <tr key={lead.id}
                                className={`border-l-2 border-brand-300 transition-colors ${selected.has(lead.id) ? 'bg-brand-50/40' : 'odd:bg-white even:bg-indigo-50/30 hover:bg-indigo-50/60'}`}>
                                <td className="pl-8 pr-3 py-2.5">
                                  <button onClick={e => { e.stopPropagation(); toggleOne(lead.id) }} className="text-gray-400 hover:text-brand-600 transition-colors">
                                    {selected.has(lead.id) ? <CheckSquare className="w-4 h-4 text-brand-600" /> : <Square className="w-4 h-4" />}
                                  </button>
                                </td>
                                <td className="px-3 py-2.5">
                                  <Link href={`/leads/${lead.id}`} className="font-medium text-gray-700 hover:text-brand-700 block truncate max-w-[130px] text-sm">
                                    {lead.first_name && lead.last_name ? `${lead.first_name} ${lead.last_name}` : lead.email || lead.company_name}
                                  </Link>
                                </td>
                                <td className="hidden md:table-cell px-3 py-2.5 text-gray-700 text-sm whitespace-nowrap font-medium">
                                  {lead.first_name || <span className="text-gray-300 font-normal text-xs">—</span>}
                                </td>
                                <td className="hidden lg:table-cell px-3 py-2.5 text-gray-700 text-sm whitespace-nowrap font-medium">
                                  {lead.last_name || <span className="text-gray-300 font-normal text-xs">—</span>}
                                </td>
                                <td className="hidden lg:table-cell px-3 py-2.5 text-gray-600 text-sm max-w-[140px] truncate">
                                  {(lead as unknown as { job_title?: string }).job_title || <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="hidden lg:table-cell px-3 py-2.5 text-gray-600 text-sm max-w-[120px] truncate">
                                  {lead.department || <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="hidden md:table-cell px-3 py-2.5 text-gray-700 text-sm max-w-[160px] truncate">{lead.email || <span className="text-gray-300 text-xs">—</span>}</td>
                                <td className="hidden lg:table-cell px-3 py-2.5 text-gray-600 text-sm max-w-[110px] truncate">{lead.sector || <span className="text-gray-300 text-xs">—</span>}</td>
                                <td className="hidden lg:table-cell px-3 py-2.5 max-w-[180px]">
                                  <TagEditor
                                    leadId={lead.id}
                                    initialTags={leadTags}
                                    onSaved={tags => setLocalTags(prev => ({ ...prev, [lead.id]: tags }))}
                                  />
                                </td>
                                <td className="hidden lg:table-cell px-3 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">
                                  {(lead as unknown as { campaign?: { name: string } }).campaign?.name || '—'}
                                </td>
                                <td className="px-2 md:px-3 py-2.5">
                                  <select className="text-xs border-0 bg-transparent cursor-pointer focus:outline-none max-w-[80px] md:max-w-none"
                                    value={lead.status} onChange={(e) => updateLeadStatus(lead.id, e.target.value)}>
                                    {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 md:px-3 py-2.5">
                                  <span className={`badge font-semibold tabular-nums ${scoreToBg(lead.score)}`}>{lead.score}</span>
                                </td>
                                <td className="hidden md:table-cell px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDateRelative(lead.created_at)}</td>
                                <td className="px-2 md:px-3 py-2.5">
                                  <Link href={`/leads/${lead.id}`} className="text-xs text-brand-600 hover:text-brand-700">Ver →</Link>
                                </td>
                              </tr>
                            )
                          })}
                        </>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">
                  {total === 0 ? '0' : `${((page - 1) * perPage) + 1}–${Math.min(page * perPage, total)}`} de {total} leads
                </p>
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                  value={perPage}
                  onChange={e => { setPerPage(parseInt(e.target.value)); setPage(1) }}
                >
                  {[25, 50, 75, 100, 200, 300].map(n => (
                    <option key={n} value={n}>{n} por página</option>
                  ))}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Pág. {page} / {totalPages}</span>
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                    className="btn-secondary text-xs py-1.5 disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                    className="btn-secondary text-xs py-1.5 disabled:opacity-40"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────────── */}

      {/* Guardar vista */}
      <Modal isOpen={showSaveView} onClose={() => setShowSaveView(false)} title="Guardar vista" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Guarda los filtros activos como una vista con nombre para acceder rápidamente.</p>
          <input autoFocus className="input" placeholder="Ej: Sin contactar · España · Alimentación"
            value={newViewName} onChange={e => setNewViewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveView() }} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSaveView(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleSaveView} disabled={savingView || !newViewName.trim()} className="btn-primary text-xs">
              {savingView ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : <><Save className="w-3.5 h-3.5" /> Guardar</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Añadir a lista */}
      <Modal isOpen={showAddToListModal} onClose={() => setShowAddToListModal(false)}
        title={`Añadir ${selected.size} lead(s) a lista`} size="sm">
        <div className="space-y-4">
          {lists.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tienes listas. Créalas en el panel izquierdo.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lists.map(l => (
                <button key={l.id} onClick={() => setAddToListId(l.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    addToListId === l.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    addToListId === l.id ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`}>
                    {addToListId === l.id && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span style={{ color: l.color }}>{l.icon}</span>
                  <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
                  <span className="ml-auto text-xs text-gray-400">{l.member_count} leads</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setShowAddToListModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleAddToList} disabled={!addToListId || addingToList} className="btn-primary text-xs disabled:opacity-50">
              {addingToList ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Añadiendo...</> : <><Folder className="w-3.5 h-3.5" /> Añadir a lista</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Asignar a campaña */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)}
        title={`Asignar ${selected.size} lead(s) a campaña`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Selecciona la campaña destino.</p>
          {campaigns.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay campañas creadas.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {campaigns.map(c => (
                <button key={c.id} onClick={() => setAssignCampaignId(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    assignCampaignId === c.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    assignCampaignId === c.id ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`}>
                    {assignCampaignId === c.id && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setShowAssignModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleAssignToCampaign} disabled={!assignCampaignId || assigning} className="btn-primary text-xs disabled:opacity-50">
              {assigning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Asignando...</> : <><Target className="w-3.5 h-3.5" /> Asignar</>}
            </button>
          </div>
        </div>
      </Modal>

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
            {field('first_name', 'Nombre', 'text', 'María')}
            {field('last_name', 'Apellidos', 'text', 'García López')}
            {field('job_title', 'Cargo', 'text', 'Director de Marketing, Brand Manager...')}
            {field('department', 'Departamento', 'text', 'Marketing, Operaciones...')}
            {field('website', 'Web', 'url', 'https://empresa.com')}
            {field('email', 'Email de contacto', 'email', 'contacto@empresa.com')}
            {field('phone', 'Teléfono', 'tel', '+34 600 000 000')}
            {field('country', 'País', 'text', 'España')}
            {field('city', 'Ciudad', 'text', 'Madrid')}
            {field('sector', 'Sector', 'text', 'Alimentación, Cosmética...')}
            {field('linkedin_url', 'LinkedIn', 'url', 'https://linkedin.com/in/...')}
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input text-sm resize-none" rows={2} placeholder="Breve descripción..."
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

      {/* ─── Banner flotante de enriquecimiento en background ─── */}
      {enrichJob && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-brand-200 shadow-2xl rounded-2xl px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 w-[calc(100vw-32px)] md:min-w-[320px] md:w-auto max-w-sm">
          <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Enriqueciendo con IA</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {enrichJob.done} de {enrichJob.total} completados
              {enrichJob.errors > 0 && <span className="text-red-500 ml-1">· {enrichJob.errors} errores</span>}
            </p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((enrichJob.done / enrichJob.total) * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-bold text-brand-600 shrink-0">
            {Math.round((enrichJob.done / enrichJob.total) * 100)}%
          </span>
        </div>
      )}

      {/* Modal: Eliminar lista */}
      <Modal
        isOpen={!!deleteListModal}
        onClose={() => !deletingList && setDeleteListModal(null)}
        title="Eliminar lista"
        size="sm"
      >
        {deleteListModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Vas a eliminar la lista <strong>&ldquo;{deleteListModal.name}&rdquo;</strong>
              {deleteListModal.memberCount > 0
                ? ` que contiene ${deleteListModal.memberCount} lead${deleteListModal.memberCount !== 1 ? 's' : ''}.`
                : '.'}
            </p>

            {deleteListModal.memberCount > 0 && (
              <label className="flex items-start gap-3 p-3 rounded-xl border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors">
                <input
                  type="checkbox"
                  checked={deleteLeadsAlso}
                  onChange={e => setDeleteLeadsAlso(e.target.checked)}
                  className="mt-0.5 accent-red-600 w-4 h-4 shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    Eliminar también los {deleteListModal.memberCount} leads de esta lista
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">
                    Esta acción es irreversible. Los leads se borrarán permanentemente.
                  </p>
                </div>
              </label>
            )}

            {!deleteLeadsAlso && (
              <p className="text-xs text-gray-400">
                Los leads se conservarán en la base de datos. Solo se eliminará la lista y sus asignaciones.
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setDeleteListModal(null)}
                disabled={deletingList}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteList}
                disabled={deletingList}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 ${
                  deleteLeadsAlso ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-800'
                }`}
              >
                {deletingList
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Eliminando…</>
                  : deleteLeadsAlso
                    ? <><Trash2 className="w-3.5 h-3.5" /> Eliminar lista y leads</>
                    : <><Trash2 className="w-3.5 h-3.5" /> Eliminar solo la lista</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
