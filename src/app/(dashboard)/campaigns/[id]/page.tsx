'use client'

// Sectores ICP de MyMediaConnect — empresas con packaging, artwork y gestión de etiquetado
const MMC_SECTORS = [
  'Alimentación y bebidas FMCG',
  'Pharma y parafarmacia OTC',
  'Cosmética y cuidado personal',
  'Retail y marca del distribuidor (MDD)',
  'Vinos y licores',
  'Lácteos y frescos',
  'Snacks y confitería',
  'Bebidas refrescantes',
  'Suplementos y nutrición',
  'Productos de limpieza y hogar',
  'Mascotas (pet care)',
  'Electrónica de consumo',
  'Químico / Industrial con marca propia',
  'Otro',
]

import { useState, useEffect, useCallback } from 'react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useParams, useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import {
  ArrowLeft, Users, Mail, TrendingUp, Target, Zap, Calendar,
  Plus, Search, Trash2, Send, ChevronRight, ChevronLeft, BarChart3, FileText,
  Settings, Loader2, CheckCircle, XCircle, Play, Pause,
  Star, Clock, Check, Save, Edit2, Mails, Copy, Sparkles, AlertTriangle,
  CalendarClock, ChevronDown, ChevronUp, ArrowDownToLine
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { statusLabel, statusColor, priorityColor, scoreToBg, formatDate, formatDateRelative, htmlToText, textToHtml } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

// ─── Tipos ────────────────────────────────────────────────────
interface Campaign {
  id: string; name: string; description?: string; status: string
  country?: string; sector?: string; language?: string
  start_date?: string; end_date?: string
  goal_leads?: number; goal_meetings?: number; goal_replies?: number
  created_at: string
}

interface CampaignStats {
  leads: {
    total: number; enriched: number; contacted: number; replied: number
    interested: number; meetings: number; closed: number; discarded: number; new: number
    avg_score: number; by_priority: { high: number; medium: number; low: number }
  }
  emails: {
    sent: number; opened: number; replied: number; bounced: number
    open_rate: number; reply_rate: number; click_rate: number
  }
  sequences: { active: number }
  conversion: { contact_rate: number; reply_rate: number; meeting_rate: number }
}

interface Lead {
  id: string; company_name: string; email?: string; status: string
  priority: string; score: number; is_enriched?: boolean; created_at: string; sector?: string
  campaign_id?: string | null
}

interface TemplateStep {
  step_number: number; subject: string; body: string; delay_days: number; tone: string
  scheduled_date?: string  // YYYY-MM-DD (tab editor)
  scheduled_time?: string  // HH:MM (tab editor)
  scheduled_for?: string   // datetime-local string para el modal preview
}

interface Template {
  id: string; name: string; description?: string; steps: TemplateStep[]
}

// ─── Constantes ────────────────────────────────────────────────
const TONES = ['consultivo', 'directo', 'cercano', 'formal', 'tecnico']

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'completed']
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', active: 'Activa', paused: 'Pausada', completed: 'Completada'
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
}

// ─── Subcomponentes ───────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType
}) {
  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function GoalBar({ label, current, goal, color }: {
  label: string; current: number; goal: number; color: string
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-800">{current} / {goal} <span className="font-normal text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FunnelStep({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium text-gray-800">{count} <span className="text-gray-400">({pct}%)</span></span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [sequences, setSequences] = useState<Record<string, unknown>[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'sequences' | 'analytics' | 'settings'>('overview')

  // ─── Analytics tab ────────────────────────────────────────────
  interface AnalyticsRow {
    lead_id: string; company_name: string; email: string; contact_name: string | null
    department: string; status: string; score: number; sector: string; country: string
    sent: number; opened: number; clicked: number; replied: number; bounced: number
    open_rate: number; click_rate: number; reply_rate: number
    last_email_at: string | null; last_opened_at: string | null; last_replied_at: string | null
    has_active_sequence: boolean; sequence_completed: boolean
    interaction_level: 'replied' | 'clicked' | 'opened' | 'sent' | 'none'
    last_clicked_url: string | null
  }
  const [analyticsData, setAnalyticsData] = useState<AnalyticsRow[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const [analyticsSort, setAnalyticsSort] = useState<{ col: keyof AnalyticsRow; dir: 'asc' | 'desc' }>({ col: 'sent', dir: 'desc' })
  const [analyticsSearch, setAnalyticsSearch] = useState('')

  // Asignar leads
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([])
  const [assignSearch, setAssignSearch] = useState('')
  const [selectedToAssign, setSelectedToAssign] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)

  // Quitar leads
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(new Set())
  const [removing, setRemoving] = useState(false)

  // Plantilla
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [generatingTemplate, setGeneratingTemplate] = useState(false)

  // Modal secuencia campaña (mismo flujo que lead individual)
  const [showSeqModal, setShowSeqModal] = useState(false)
  const [seqModalStep, setSeqModalStep] = useState<'info' | 'preview'>('info')
  const [seqPreviewSteps, setSeqPreviewSteps] = useState<TemplateStep[]>([])
  const [expandedSeqStep, setExpandedSeqStep] = useState<number>(1)
  const [seqPreviewBodyMode, setSeqPreviewBodyMode] = useState<Record<number, 'edit' | 'preview'>>({ 1: 'preview' })
  const [seqUseEmojis, setSeqUseEmojis] = useState(false)
  const [seqLanguage, setSeqLanguage] = useState('es')
  const [seqTotalSteps, setSeqTotalSteps] = useState<3 | 5>(3)
  const [launchingFromModal, setLaunchingFromModal] = useState(false)

  // Lusha
  const [lushaConnected, setLushaConnected] = useState<boolean | null>(null)
  const [lushaEnriching, setLushaEnriching] = useState(false)
  const [showLushaModal, setShowLushaModal] = useState(false)
  const [lushaSearching, setLushaSearching] = useState(false)
  const [lushaImporting, setLushaImporting] = useState(false)
  const [lushaProspects, setLushaProspects] = useState<Array<{ firstName?: string; lastName?: string; email?: string; phone?: string; jobTitle?: string; company?: string; companyDomain?: string; linkedin?: string; country?: string; sector?: string }>>([])
  const [lushaFilters, setLushaFilters] = useState({ jobTitles: '', industries: '', countries: '', companyNames: '', companyDomains: '', limit: 25 })
  const [prospectStates, setProspectStates] = useState<Record<number, { importing?: boolean; enriching?: boolean; imported?: boolean; leadId?: string }>>({})

  const setProspectState = (idx: number, patch: Record<string, unknown>) =>
    setProspectStates(prev => ({ ...prev, [idx]: { ...prev[idx], ...patch } }))
  const [lushaLastResult, setLushaLastResult] = useState<string | null>(null)

  // Cancelar / borrar secuencia
  const [cancellingSeq, setCancellingSeq] = useState<string | null>(null)
  const [deletingSeq, setDeletingSeq] = useState<string | null>(null)

  // Expandir secuencia para ver/editar pasos
  const [expandedSeqId, setExpandedSeqId] = useState<string | null>(null)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const [editingBodyStepId, setEditingBodyStepId] = useState<string | null>(null)
  const [stepEdits, setStepEdits] = useState<Record<string, { scheduled_for?: string; subject?: string; body?: string }>>({})
  const [savingStep, setSavingStep] = useState<string | null>(null)

  // Paginación de leads de la campaña
  const [campLeadsPage, setCampLeadsPage] = useState(1)
  const [campLeadsTotal, setCampLeadsTotal] = useState(0)
  const CAMP_LEADS_PER_PAGE = 50

  // Buscador y paginación de secuencias
  const [seqSearch, setSeqSearch] = useState('')
  const [seqPage, setSeqPage] = useState(1)
  const SEQ_PAGE_SIZE = 25

  // ─── Pausar / Reanudar campaña ────────────────────────────────
  const [togglingPause, setTogglingPause] = useState(false)

  const handleTogglePause = async () => {
    if (!campaign) return
    const action = campaign.status === 'paused' ? 'resume' : 'pause'
    setTogglingPause(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Error'); return }
      const newStatus = action === 'pause' ? 'paused' : 'active'
      setCampaign(prev => prev ? { ...prev, status: newStatus } : prev)
      const msg = action === 'pause'
        ? `Campaña pausada · ${json.sequences_paused} secuencias detenidas`
        : `Campaña reanudada · ${json.sequences_resumed} secuencias reactivadas`
      toast.success(msg)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setTogglingPause(false)
    }
  }

  // Reprogramación masiva de secuencias (3 inputs independientes)
  const [bulkDates, setBulkDates] = useState<[string, string, string]>(['', '', ''])
  const [applyingBulk, setApplyingBulk] = useState(false)
  const [deletingAllSeqs, setDeletingAllSeqs] = useState(false)

  // Genera los emails en el modal de secuencia de campaña (3 o 5 toques)
  const handleGenerateCampaignPreview = async () => {
    setGeneratingTemplate(true)
    const res = await fetch(`/api/campaigns/${id}/templates/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useEmojis: seqUseEmojis, language: seqLanguage, total_steps: seqTotalSteps }),
    })
    const json = await res.json()
    setGeneratingTemplate(false)
    if (res.ok && Array.isArray(json.data)) {
      const now = new Date()
      const delayDays = seqTotalSteps === 5 ? [0, 4, 8, 13, 18] : [0, 5, 10]
      const steps: TemplateStep[] = json.data.map((s: TemplateStep, i: number) => {
        const d = new Date(now)
        d.setDate(d.getDate() + (delayDays[i] ?? 0))
        d.setHours(9, 0, 0, 0)
        const pad = (n: number) => String(n).padStart(2, '0')
        const scheduled_for = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T09:00`
        return {
          step_number: s.step_number,
          subject: s.subject,
          body: s.body,
          delay_days: s.delay_days,
          tone: s.tone,
          scheduled_for,
        }
      })
      setSeqPreviewSteps(steps)
      setExpandedSeqStep(1)
      setSeqPreviewBodyMode(Object.fromEntries(steps.map(s => [s.step_number, 'preview' as const])))
      setSeqModalStep('preview')
    } else {
      toast.error('Error IA', json.error ?? 'No se pudo generar la secuencia.')
    }
  }

  // Guarda los steps del modal como plantilla de campaña
  const handleSaveCampaignPreview = async () => {
    setSavingTemplate(true)
    const payload = {
      id: editingTemplate?.id ?? '',
      name: `Secuencia ${seqTotalSteps} Toques`,
      description: '',
      steps: seqPreviewSteps.map(s => ({
        ...s,
        scheduled_date: s.scheduled_for ? s.scheduled_for.slice(0, 10) : undefined,
        scheduled_time: s.scheduled_for ? s.scheduled_for.slice(11, 16) : undefined,
        scheduled_for: undefined,
      })),
    }
    const res = await fetch(`/api/campaigns/${id}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSavingTemplate(false)
    if (res.ok) {
      fetchAll()
      setShowSeqModal(false)
      setSeqModalStep('info')
      toast.success('Secuencia guardada', `Los ${seqTotalSteps} toques se usarán al lanzar secuencias en bloque.`)
    } else {
      const j = await res.json()
      toast.error('Error', j.error)
    }
  }

  // Guarda la plantilla del modal y lanza secuencias para todos los leads aptos
  const handleConfirmAndLaunch = async () => {
    setLaunchingFromModal(true)
    // 1. Guardar plantilla
    const payload = {
      id: editingTemplate?.id ?? '',
      name: `Secuencia ${seqTotalSteps} Toques`,
      description: '',
      steps: seqPreviewSteps.map(s => ({
        ...s,
        scheduled_date: s.scheduled_for ? s.scheduled_for.slice(0, 10) : undefined,
        scheduled_time: s.scheduled_for ? s.scheduled_for.slice(11, 16) : undefined,
        scheduled_for: undefined,
      })),
    }
    await fetch(`/api/campaigns/${id}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    // 2. Lanzar secuencias
    const res = await fetch(`/api/campaigns/${id}/launch-sequences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts: launchAccounts.length ? launchAccounts : undefined, language: seqLanguage, total_steps: seqTotalSteps }),
    })
    const json = await res.json()
    setLaunchingFromModal(false)
    if (!res.ok) { toast.error('Error al lanzar', json.error); return }
    setShowSeqModal(false)
    setSeqModalStep('info')
    fetchAll()
    toast.success(
      `Secuencias lanzadas: ${json.launched}`,
      `${json.launched} leads · ${json.errors} errores · ${json.skipped} ya tenían secuencia`
    )
  }

  const handleCancelSequence = async (seqId: string) => {
    setCancellingSeq(seqId)
    const res = await fetch('/api/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: seqId, action: 'cancel' }),
    })
    setCancellingSeq(null)
    if (res.ok) {
      const seqRes = await fetch(`/api/sequences?campaign_id=${id}`)
      const seqJson = await seqRes.json()
      setSequences(seqJson.data ?? [])
      toast.success('Secuencia cancelada')
    } else {
      toast.error('Error', 'No se pudo cancelar la secuencia.')
    }
  }

  const handleDeleteSequence = async (seqId: string) => {
    if (!confirm('¿Borrar esta secuencia definitivamente? Podrás crear una nueva desde el lead.')) return
    setDeletingSeq(seqId)
    const res = await fetch('/api/sequences', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: seqId }),
    })
    setDeletingSeq(null)
    if (res.ok) {
      const seqRes = await fetch(`/api/sequences?campaign_id=${id}`)
      const seqJson = await seqRes.json()
      setSequences(seqJson.data ?? [])
      toast.success('Secuencia borrada')
    } else {
      toast.error('Error', 'No se pudo borrar la secuencia.')
    }
  }

  const handleSaveStep = async (stepId: string) => {
    const edits = stepEdits[stepId]
    if (!edits) return
    setSavingStep(stepId)
    const payload: Record<string, string> = { step_id: stepId }
    if (edits.scheduled_for) payload.scheduled_for = new Date(edits.scheduled_for).toISOString()
    if (edits.subject !== undefined) payload.subject = edits.subject
    // body stored in edits is already HTML (textToHtml applied on change)
    if (edits.body !== undefined) payload.body = edits.body
    const res = await fetch('/api/sequences/steps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSavingStep(null)
    if (res.ok) {
      toast.success('Paso actualizado')
      // Limpiar edits de este paso
      setStepEdits(prev => { const n = { ...prev }; delete n[stepId]; return n })
      const seqRes = await fetch(`/api/sequences?campaign_id=${id}`)
      const seqJson = await seqRes.json()
      setSequences(seqJson.data ?? [])
    } else {
      const j = await res.json()
      toast.error('Error', j.error)
    }
  }

  const handleApplyBulkDates = async () => {
    const seqList = sequences as { id: string; sequence_steps?: { id: string; step_number: number; status: string }[] }[]
    const stepsToUpdate: { stepId: string; scheduled_for: string }[] = []
    seqList.forEach(seq => {
      (seq.sequence_steps ?? []).forEach(step => {
        if (step.status === 'sent' || step.status === 'skipped') return
        const dateVal = bulkDates[step.step_number - 1]
        if (dateVal) {
          stepsToUpdate.push({ stepId: step.id, scheduled_for: new Date(dateVal).toISOString() })
        }
      })
    })
    if (!stepsToUpdate.length) { toast.error('Sin cambios', 'Introduce al menos una fecha y hora.'); return }
    setApplyingBulk(true)
    await Promise.all(stepsToUpdate.map(({ stepId, scheduled_for }) =>
      fetch('/api/sequences/steps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepId, scheduled_for }),
      })
    ))
    setApplyingBulk(false)
    setBulkDates(['', '', ''])
    const seqRes = await fetch(`/api/sequences?campaign_id=${id}`)
    const seqJson = await seqRes.json()
    setSequences(seqJson.data ?? [])
    toast.success('Fechas actualizadas', `${stepsToUpdate.length} pasos reprogramados.`)
  }

  const handleDeleteAllSequences = async () => {
    if (!confirm(`¿Borrar TODAS las ${sequences.length} secuencias de esta campaña? Esta acción no se puede deshacer.`)) return
    setDeletingAllSeqs(true)
    const seqList = sequences as { id: string }[]
    await Promise.all(seqList.map(seq =>
      fetch('/api/sequences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence_id: seq.id }),
      })
    ))
    setDeletingAllSeqs(false)
    setExpandedSeqId(null)
    fetchAll()
    toast.success('Secuencias eliminadas', 'Todas las secuencias han sido borradas.')
  }

  // Lanzamiento masivo de secuencias
  const [showLaunchModal, setShowLaunchModal] = useState(false)
  const [launchingBulk, setLaunchingBulk] = useState(false)
  const [launchAccounts, setLaunchAccounts] = useState<string[]>([
    'guillaume@mymediaconnect.com',
    'guillaume@gomymediaconnect.com',
    'guillaume@mymediaconnectgo.com',
    'guillaume@mymediaconnect.es',
  ])

  // Ajustes
  const [editSettings, setEditSettings] = useState<Partial<Campaign>>({})
  const [savingSettings, setSavingSettings] = useState(false)

  const fetchCampLeads = useCallback(async (page: number) => {
    const res = await fetch(`/api/leads?campaign_id=${id}&page=${page}&per_page=${CAMP_LEADS_PER_PAGE}`)
    const json = await res.json()
    setLeads(json.data ?? [])
    setCampLeadsTotal(json.total ?? 0)
  }, [id, CAMP_LEADS_PER_PAGE])

  useEffect(() => { fetchCampLeads(campLeadsPage) }, [campLeadsPage, fetchCampLeads])

  const fetchAll = useCallback(async () => {
    const [campRes, statsRes, leadsRes, seqRes, tmplRes] = await Promise.all([
      fetch(`/api/campaigns/${id}`),
      fetch(`/api/campaigns/${id}/stats`),
      fetch(`/api/leads?campaign_id=${id}&page=1&per_page=${CAMP_LEADS_PER_PAGE}`),
      fetch(`/api/sequences?campaign_id=${id}`),
      fetch(`/api/campaigns/${id}/templates`),
    ])
    const [campJson, statsJson, leadsJson, seqJson, tmplJson] = await Promise.all([
      campRes.json(), statsRes.json(), leadsRes.json(), seqRes.json(), tmplRes.json(),
    ])
    if (campJson.data) setCampaign(campJson.data)
    if (statsJson.data) setStats(statsJson.data)
    setLeads(leadsJson.data ?? [])
    setCampLeadsTotal(leadsJson.total ?? 0)
    setCampLeadsPage(1)
    setSequences(seqJson.data ?? [])
    const fetchedTemplates = tmplJson.data ?? []
    setTemplates(fetchedTemplates)
    // Auto-cargar el primer template si existe, o inicializar vacío
    if (fetchedTemplates.length > 0) {
      setEditingTemplate(fetchedTemplates[0])
    } else {
      setEditingTemplate({
        id: '',
        name: 'Secuencia',
        steps: [
          { step_number: 1, subject: '', body: '', delay_days: 0, tone: 'consultivo' },
          { step_number: 2, subject: '', body: '', delay_days: 5, tone: 'directo' },
          { step_number: 3, subject: '', body: '', delay_days: 10, tone: 'cercano' },
        ]
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (campaign) setEditSettings({
      name: campaign.name, description: campaign.description, status: campaign.status,
      country: campaign.country, sector: campaign.sector,
      start_date: campaign.start_date, end_date: campaign.end_date,
      goal_leads: campaign.goal_leads, goal_meetings: campaign.goal_meetings, goal_replies: campaign.goal_replies,
    })
  }, [campaign])

  // Cargar leads disponibles para asignar
  const fetchAvailable = useCallback(async () => {
    setLoadingAvailable(true)
    const res = await fetch(`/api/campaigns/${id}/leads?search=${assignSearch}`)
    const json = await res.json()
    setAvailableLeads(json.data ?? [])
    setLoadingAvailable(false)
  }, [id, assignSearch])

  useEffect(() => {
    if (showAssignModal) fetchAvailable()
  }, [showAssignModal, fetchAvailable])

  useEffect(() => {
    const t = setTimeout(() => { if (showAssignModal) fetchAvailable() }, 300)
    return () => clearTimeout(t)
  }, [assignSearch, showAssignModal, fetchAvailable])

  const handleAssign = async () => {
    if (selectedToAssign.size === 0) return
    setAssigning(true)
    const res = await fetch(`/api/campaigns/${id}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_ids: Array.from(selectedToAssign) }),
    })
    setAssigning(false)
    if (res.ok) {
      setShowAssignModal(false)
      setSelectedToAssign(new Set())
      setAssignSearch('')
      fetchAll()
      toast.success('Leads asignados', `${selectedToAssign.size} lead(s) añadidos a la campaña.`)
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudieron asignar los leads.')
    }
  }

  const handleRemoveLeads = async () => {
    if (selectedToRemove.size === 0) return
    setRemoving(true)
    const res = await fetch(`/api/campaigns/${id}/leads`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_ids: Array.from(selectedToRemove) }),
    })
    setRemoving(false)
    if (res.ok) {
      setSelectedToRemove(new Set())
      fetchAll()
      toast.success('Leads quitados', 'Los leads han sido desvinculados de la campaña.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error)
    }
  }

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return
    setSavingTemplate(true)
    const payload = {
      ...editingTemplate,
      name: editingTemplate.name || 'Secuencia',
    }
    const res = await fetch(`/api/campaigns/${id}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSavingTemplate(false)
    if (res.ok) {
      fetchAll()
      toast.success('Secuencia guardada', 'La plantilla se usará al lanzar secuencias en bloque.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error)
    }
  }

  // ── Lusha ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/lusha')
      .then(r => r.json())
      .then(j => setLushaConnected(j.connected === true))
      .catch(() => setLushaConnected(false))
  }, [])

  const handleLushaEnrichCampaign = async () => {
    if (!confirm(`¿Enriquecer con Lusha todos los leads de esta campaña que falten email o teléfono? Esto consumirá créditos.`)) return
    setLushaEnriching(true)
    setLushaLastResult(null)
    const res = await fetch('/api/lusha/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: id }),
    })
    const json = await res.json()
    setLushaEnriching(false)
    if (res.ok) {
      const msg = `✅ Enriquecidos: ${json.enriched} · No encontrados: ${json.not_found} · Ya completos: ${json.skipped}`
      setLushaLastResult(msg)
      toast.success('Enriquecimiento Lusha completado', json.message)
      fetchAll()
    } else {
      toast.error('Error Lusha', json.error)
    }
  }

  const buildLushaFilters = () => ({
    jobTitles: lushaFilters.jobTitles ? lushaFilters.jobTitles.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    industries: lushaFilters.industries ? lushaFilters.industries.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    countries: lushaFilters.countries ? lushaFilters.countries.split(',').map(s => s.trim()).filter(Boolean) : (campaign?.country ? [campaign.country] : undefined),
    companyNames: lushaFilters.companyNames ? lushaFilters.companyNames.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    companyDomains: lushaFilters.companyDomains ? lushaFilters.companyDomains.split(',').map(s => s.trim().replace('@', '')).filter(Boolean) : undefined,
    limit: lushaFilters.limit,
  })

  const handleLushaSearch = async () => {
    setLushaSearching(true)
    setLushaProspects([])
    setProspectStates({})
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 25000)
      const res = await fetch('/api/lusha/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildLushaFilters()),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const json = await res.json()
      if (res.ok) {
        setLushaProspects(json.prospects ?? [])
        if (!json.found) toast.warning('Sin resultados', 'Prueba con otros filtros: empresa, dominio, cargo o sector.')
      } else {
        toast.error('Error Lusha', json.error)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast.error('Tiempo agotado', 'Lusha tardó demasiado. Prueba con filtros más específicos.')
      } else {
        toast.error('Error de conexión', 'No se pudo conectar con Lusha.')
      }
    } finally {
      setLushaSearching(false)
    }
  }

  const handleLushaImport = async () => {
    setLushaImporting(true)
    const filters = {
      ...buildLushaFilters(),
      campaign_id: id,
      import: true,
    }
    const res = await fetch('/api/lusha/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    })
    const json = await res.json()
    setLushaImporting(false)
    if (res.ok) {
      toast.success(`Importados ${json.imported} prospectos`, json.message)
      setShowLushaModal(false)
      fetchAll()
    } else {
      toast.error('Error Lusha', json.error)
    }
  }

  const handleImportSingleProspect = async (prospect: typeof lushaProspects[0], idx: number) => {
    setProspectState(idx, { importing: true })
    const res = await fetch('/api/lusha/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildLushaFilters(),
        campaign_id: id,
        import: true,
        direct_prospects: [prospect],
      }),
    })
    const json = await res.json()
    if (res.ok && json.imported > 0) {
      setProspectState(idx, { importing: false, imported: true, leadId: json.lead_ids?.[0] })
      fetchAll()
    } else {
      setProspectState(idx, { importing: false })
      toast.warning('Prospecto duplicado', 'Este lead ya existe en la campaña.')
    }
  }

  const handleEnrichSingleProspect = async (prospect: typeof lushaProspects[0], idx: number) => {
    setProspectState(idx, { enriching: true })
    // 1. Importar
    const importRes = await fetch('/api/lusha/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildLushaFilters(),
        campaign_id: id,
        import: true,
        direct_prospects: [prospect],
      }),
    })
    const importJson = await importRes.json()
    const leadId = importJson.lead_ids?.[0]

    if (!leadId) {
      setProspectState(idx, { enriching: false, imported: importJson.imported === 0 })
      if (importJson.imported === 0) toast.warning('Prospecto duplicado', 'Ya existe en la campaña.')
      return
    }

    // 2. Enriquecer con la cadena completa (SerpAPI + Hunter + IA)
    await fetch(`/api/leads/${leadId}/enrich`, { method: 'POST' })

    // 3. Recargar el lead enriquecido y actualizar el prospecto en lista
    const leadRes = await fetch(`/api/leads/${leadId}`)
    const leadJson = await leadRes.json()
    const enriched = leadJson.data ?? leadJson

    setLushaProspects(prev => prev.map((p, i) => i === idx ? {
      ...p,
      firstName: enriched.first_name ?? p.firstName,
      lastName: enriched.last_name ?? p.lastName,
      email: enriched.email ?? p.email,
      phone: enriched.phone ?? p.phone,
      linkedin: enriched.linkedin_url ?? p.linkedin,
    } : p))

    setProspectState(idx, { enriching: false, imported: true, leadId })
    fetchAll()
    toast.success('Prospecto enriquecido', enriched.email
      ? `Email encontrado: ${enriched.email}`
      : 'Importado. Enriquecimiento completado.')
  }

  const handleBulkLaunch = async () => {
    setLaunchingBulk(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/launch-sequences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: launchAccounts, language: seqLanguage, total_steps: seqTotalSteps }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error('Error al lanzar', json.error); return }
      setShowLaunchModal(false)
      // Recargar secuencias
      const seqRes = await fetch(`/api/sequences?campaign_id=${id}`)
      const seqJson = await seqRes.json()
      setSequences(seqJson.data ?? [])
      toast.success(
        `Secuencias lanzadas: ${json.launched}`,
        `${json.launched} leads · ${json.errors} errores · ${json.skipped} ya tenían secuencia`
      )
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor')
    } finally {
      setLaunchingBulk(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editSettings),
    })
    setSavingSettings(false)
    const json = await res.json()
    if (res.ok) {
      fetchAll()
      if (json.warning) {
        toast.warning('Cambios guardados (parcialmente)', json.warning)
      } else {
        toast.success('Campaña actualizada')
      }
    } else {
      toast.error('Error', json.error)
    }
  }

  const handleGenerateTemplate = async () => {
    const stepDelays = seqTotalSteps === 5 ? [0, 4, 8, 13, 18] : [0, 5, 10]
    const defaultSteps = Array.from({ length: seqTotalSteps }, (_, i) => ({
      step_number: i + 1, subject: '', body: '',
      delay_days: stepDelays[i],
      tone: ['consultivo', 'directo', 'cercano', 'formal', 'directo'][i] as string,
    }))
    const currentTemplate = editingTemplate ?? {
      id: '', name: `Secuencia ${seqTotalSteps} Toques`, steps: defaultSteps,
    }
    setGeneratingTemplate(true)
    const tones = currentTemplate.steps.map(s => s.tone)
    const res = await fetch(`/api/campaigns/${id}/templates/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tones, total_steps: seqTotalSteps }),
    })
    const json = await res.json()
    setGeneratingTemplate(false)
    if (res.ok && Array.isArray(json.data)) {
      setEditingTemplate(t => {
        const base = t ?? currentTemplate
        return {
          ...base,
          name: `Secuencia ${seqTotalSteps} Toques`,
          steps: json.data.map((s: TemplateStep, i: number) => ({
            ...(base.steps[i] ?? {}),
            subject: s.subject,
            body: s.body,
            delay_days: s.delay_days,
            tone: s.tone,
          }))
        }
      })
      toast.success('Secuencia generada', `Revisa los ${seqTotalSteps} emails y pulsa Guardar cuando estés listo.`)
    } else {
      toast.error('Error IA', json.error ?? 'No se pudo generar la secuencia.')
    }
  }

  const handleDeleteCampaign = async () => {
    if (!confirm(`¿Seguro que quieres eliminar "${campaign?.name}"? Los leads no se borrarán.`)) return
    const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/campaigns')
    } else {
      toast.error('Error', 'No se pudo eliminar la campaña.')
    }
  }

  const initNewTemplate = () => {
    setEditingTemplate({
      id: '', name: `Plantilla ${campaign?.name ?? ''}`,
      steps: [
        { step_number: 1, subject: '', body: '', delay_days: 0, tone: 'consultivo' },
        { step_number: 2, subject: '', body: '', delay_days: 5, tone: 'directo' },
        { step_number: 3, subject: '', body: '', delay_days: 10, tone: 'cercano' },
      ]
    })
  }

  if (loading) return <div className="p-6 text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando campaña...</div>
  if (!campaign) return <div className="p-6 text-red-500">Campaña no encontrada.</div>

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'leads', label: `Leads (${campLeadsTotal || leads.length})`, icon: Users },
    { id: 'sequences', label: `Secuencias (${sequences.length})`, icon: Mails },
    { id: 'analytics', label: 'Analíticas', icon: TrendingUp },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ] as const

  // Carga analíticas al entrar en el tab (lazy)
  const loadAnalytics = async () => {
    if (analyticsLoaded) return
    setAnalyticsLoading(true)
    const res = await fetch(`/api/campaigns/${id}/analytics`)
    const json = await res.json()
    setAnalyticsLoading(false)
    if (res.ok) {
      setAnalyticsData(json.data ?? [])
      setAnalyticsLoaded(true)
    } else {
      toast.error('Error al cargar analíticas', json.error)
    }
  }

  // Ordenar analíticas
  const sortedAnalytics = [...analyticsData]
    .filter(r => {
      if (!analyticsSearch) return true
      const q = analyticsSearch.toLowerCase()
      return r.company_name.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q) || (r.contact_name ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const va = a[analyticsSort.col] ?? 0
      const vb = b[analyticsSort.col] ?? 0
      if (va < vb) return analyticsSort.dir === 'asc' ? -1 : 1
      if (va > vb) return analyticsSort.dir === 'asc' ? 1 : -1
      return 0
    })

  const toggleAnalyticsSort = (col: typeof analyticsSort.col) => {
    setAnalyticsSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })
  }

  // Export Excel (analytics)
  const exportAnalyticsExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const interactionLabel = (level: string) => {
      if (level === 'replied') return '🟢 Respondió'
      if (level === 'clicked') return '🔵 Clicó'
      if (level === 'opened') return '👁 Abrió'
      if (level === 'sent') return '📧 Enviado'
      return '— Sin actividad'
    }

    // Hoja 1: Resumen — interacción por persona (el más importante)
    const interactionHeaders = ['Interacción', 'Empresa', 'Contacto', 'Email', 'Departamento', 'Sector', 'País', 'Estado lead', 'Score', 'Enviados', 'Abiertos', 'Clicados', 'URL clicada', 'Respondidos', 'Rebotados', '% Apertura', '% Respuesta', 'Últ. apertura', 'Últ. respuesta', 'Secuencia']
    const interactionRows = sortedAnalytics.map(r => [
      interactionLabel(r.interaction_level),
      r.company_name,
      r.contact_name ?? '',
      r.email,
      r.department ?? '',
      r.sector,
      r.country,
      r.status,
      r.score,
      r.sent,
      r.opened,
      r.clicked,
      r.last_clicked_url ?? '',
      r.replied,
      r.bounced,
      `${r.open_rate}%`,
      `${r.reply_rate}%`,
      r.last_opened_at ? new Date(r.last_opened_at).toLocaleString('es-ES') : '',
      r.last_replied_at ? new Date(r.last_replied_at).toLocaleString('es-ES') : '',
      r.has_active_sequence ? 'Activa' : r.sequence_completed ? 'Completada' : '—',
    ])
    const wsInteraction = XLSX.utils.aoa_to_sheet([interactionHeaders, ...interactionRows])
    wsInteraction['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 50 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsInteraction, 'Interacción por persona')

    // Hoja 2: Solo los que respondieron
    const replied = sortedAnalytics.filter(r => r.replied > 0)
    if (replied.length > 0) {
      const repliedHeaders = ['Empresa', 'Contacto', 'Email', 'Departamento', 'Respondidos', 'Abiertos', 'Clicados', 'Fecha respuesta']
      const repliedRows = replied.map(r => [r.company_name, r.contact_name ?? '', r.email, r.department ?? '', r.replied, r.opened, r.clicked, r.last_replied_at ? new Date(r.last_replied_at).toLocaleString('es-ES') : ''])
      const wsReplied = XLSX.utils.aoa_to_sheet([repliedHeaders, ...repliedRows])
      wsReplied['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsReplied, 'Respondieron')
    }

    // Hoja 3: Los que abrieron (sin responder)
    const opened = sortedAnalytics.filter(r => r.opened > 0 && r.replied === 0)
    if (opened.length > 0) {
      const openedHeaders = ['Empresa', 'Contacto', 'Email', 'Departamento', 'Abiertos', 'Clicados', 'Última apertura']
      const openedRows = opened.map(r => [r.company_name, r.contact_name ?? '', r.email, r.department ?? '', r.opened, r.clicked, r.last_opened_at ? new Date(r.last_opened_at).toLocaleString('es-ES') : ''])
      const wsOpened = XLSX.utils.aoa_to_sheet([openedHeaders, ...openedRows])
      wsOpened['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsOpened, 'Abrieron sin responder')
    }

    // Hoja 4: Sin actividad
    const noActivity = sortedAnalytics.filter(r => r.sent > 0 && r.opened === 0)
    if (noActivity.length > 0) {
      const noActHeaders = ['Empresa', 'Contacto', 'Email', 'Departamento', 'Enviados', 'Estado lead', 'Rebotados']
      const noActRows = noActivity.map(r => [r.company_name, r.contact_name ?? '', r.email, r.department ?? '', r.sent, r.status, r.bounced])
      const wsNoAct = XLSX.utils.aoa_to_sheet([noActHeaders, ...noActRows])
      wsNoAct['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, wsNoAct, 'Sin actividad')
    }

    XLSX.writeFile(wb, `analiticas-${campaign?.name ?? id}.xlsx`)
  }

  // Export PDF (analytics)
  const exportAnalyticsPDF = () => {
    const rows = sortedAnalytics
    const replied = rows.filter(r => r.replied > 0)
    const clicked = rows.filter(r => r.clicked > 0 && r.replied === 0)
    const opened = rows.filter(r => r.opened > 0 && r.replied === 0 && r.clicked === 0)
    const noActivity = rows.filter(r => r.sent > 0 && r.opened === 0)
    const totalSent = rows.reduce((s,r)=>s+r.sent,0)
    const totalOpened = rows.reduce((s,r)=>s+r.opened,0)
    const totalClicked = rows.reduce((s,r)=>s+r.clicked,0)
    const totalReplied = rows.reduce((s,r)=>s+r.replied,0)
    const totalBounced = rows.reduce((s,r)=>s+r.bounced,0)

    const personRow = (r: typeof rows[0], highlight: string) => `<tr style="background:${highlight}">
  <td><strong style="font-size:12px">${r.company_name}</strong>${r.contact_name ? `<br><span style="color:#6b7280;font-size:10px">${r.contact_name}</span>` : ''}${r.department ? `<br><span style="color:#9ca3af;font-size:9px">${r.department}</span>` : ''}</td>
  <td style="font-size:10px;font-family:monospace">${r.email}</td>
  <td style="font-size:10px">${r.sector || '—'}</td>
  <td style="font-size:10px">${r.country || '—'}</td>
  <td style="text-align:center;font-weight:700">${r.sent}</td>
  <td style="text-align:center;font-weight:700;color:#0369a1">${r.opened}</td>
  <td style="text-align:center;font-weight:700;color:#7c3aed">${r.clicked}</td>
  <td style="text-align:center;font-weight:700;color:#15803d">${r.replied}</td>
  <td style="text-align:center;color:#dc2626">${r.bounced > 0 ? r.bounced : '—'}</td>
  <td style="text-align:center;font-size:10px;color:#6b7280">${r.last_opened_at ? new Date(r.last_opened_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : r.last_replied_at ? new Date(r.last_replied_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '—'}</td>
</tr>`

    const tableHeader = `<tr><th>Empresa / Contacto</th><th>Email</th><th>Sector</th><th>País</th><th style="text-align:center">Env.</th><th style="text-align:center">Abert.</th><th style="text-align:center">Clics</th><th style="text-align:center">Resp.</th><th style="text-align:center">Rebote</th><th style="text-align:center">Última act.</th></tr>`

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Analíticas — ${campaign?.name ?? ''}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#fff; color:#1a1a1a; padding:28px; font-size:12px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #6c47ff; }
  .title { font-size:20px; font-weight:800; color:#6c47ff; }
  .subtitle { font-size:12px; color:#666; margin-top:3px; }
  .meta { text-align:right; font-size:11px; color:#999; }
  .kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:20px; }
  .kpi { border-radius:10px; padding:12px; text-align:center; }
  .kpi-val { font-size:24px; font-weight:800; line-height:1; }
  .kpi-label { font-size:10px; color:#6b7280; margin-top:3px; }
  h2 { font-size:13px; font-weight:700; color:#374151; margin:20px 0 10px; padding:6px 10px; border-radius:6px; display:flex; align-items:center; gap:6px; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:6px; }
  th { background:#6c47ff; color:#fff; padding:7px 8px; text-align:left; font-weight:600; font-size:10px; }
  td { padding:6px 8px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
  .section-empty { color:#9ca3af; font-size:11px; font-style:italic; padding:8px; }
  .footer { margin-top:20px; text-align:center; font-size:10px; color:#bbb; border-top:1px solid #e5e7eb; padding-top:12px; }
  @media print { body { padding:14px; } h2 { break-before:auto; } }
</style></head><body>

<div class="header">
  <div>
    <div class="title">📊 Informe de Campaña — ${campaign?.name ?? ''}</div>
    <div class="subtitle">${rows.length} leads · ${new Date().toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' })}</div>
  </div>
  <div class="meta">MyMediaConnect<br>Generado: ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div>
</div>

<div class="kpis">
  <div class="kpi" style="background:#f0fdf4;border:1px solid #bbf7d0"><div class="kpi-val" style="color:#15803d">${totalReplied}</div><div class="kpi-label">Respondieron</div></div>
  <div class="kpi" style="background:#ede9fe;border:1px solid #c4b5fd"><div class="kpi-val" style="color:#7c3aed">${totalClicked}</div><div class="kpi-label">Clicaron</div></div>
  <div class="kpi" style="background:#eff6ff;border:1px solid #bfdbfe"><div class="kpi-val" style="color:#1d4ed8">${totalOpened}</div><div class="kpi-label">Abrieron</div></div>
  <div class="kpi" style="background:#f8f7ff;border:1px solid #e8e4ff"><div class="kpi-val" style="color:#6c47ff">${totalSent}</div><div class="kpi-label">Enviados</div></div>
  <div class="kpi" style="background:#fef2f2;border:1px solid #fecaca"><div class="kpi-val" style="color:#dc2626">${totalBounced}</div><div class="kpi-label">Rebotados</div></div>
</div>

${replied.length > 0 ? `
<h2 style="background:#f0fdf4;color:#166534">✅ Respondieron (${replied.length} personas)</h2>
<table><thead>${tableHeader}</thead><tbody>
${replied.map(r => personRow(r, '#f0fdf4')).join('')}
</tbody></table>` : ''}

${clicked.length > 0 ? `
<h2 style="background:#ede9fe;color:#6d28d9">🔵 Clicaron sin responder (${clicked.length} personas)</h2>
<table><thead>${tableHeader}</thead><tbody>
${clicked.map(r => personRow(r, '#faf5ff')).join('')}
</tbody></table>` : ''}

${opened.length > 0 ? `
<h2 style="background:#eff6ff;color:#1e40af">👁 Abrieron sin clicar (${opened.length} personas)</h2>
<table><thead>${tableHeader}</thead><tbody>
${opened.map(r => personRow(r, '#f8faff')).join('')}
</tbody></table>` : ''}

${noActivity.length > 0 ? `
<h2 style="background:#f9fafb;color:#6b7280">📭 Sin actividad — enviados pero no abiertos (${noActivity.length} personas)</h2>
<table><thead>${tableHeader}</thead><tbody>
${noActivity.map(r => personRow(r, '#fff')).join('')}
</tbody></table>` : ''}

<div class="footer">MyMediaConnect · ${campaign?.name ?? ''} · ${new Date().toLocaleString('es-ES')}</div>
</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600) }
  }

  const hasGoals = (campaign.goal_leads ?? 0) > 0 || (campaign.goal_meetings ?? 0) > 0 || (campaign.goal_replies ?? 0) > 0

  return (
    <div className="animate-fade-in">
      <TopBar
        title={campaign.name}
        subtitle={
          <span className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[campaign.status]}`}>
              {STATUS_LABELS[campaign.status]}
            </span>
            {campaign.sector && <span className="text-gray-400">{campaign.sector}</span>}
            {campaign.country && <span className="text-gray-400">· {campaign.country}</span>}
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Link href="/campaigns" className="btn-secondary text-xs py-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Campañas
            </Link>
            {/* Botón Pausar / Reanudar — solo visible en campañas activas o pausadas */}
            {(campaign.status === 'active' || campaign.status === 'paused') && (
              <button
                onClick={handleTogglePause}
                disabled={togglingPause}
                className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg font-medium transition-colors disabled:opacity-60 ${
                  campaign.status === 'paused'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {togglingPause
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : campaign.status === 'paused'
                    ? <Play className="w-3.5 h-3.5" />
                    : <Pause className="w-3.5 h-3.5" />
                }
                {campaign.status === 'paused' ? 'Reanudar campaña' : 'Pausar campaña'}
              </button>
            )}
            <button onClick={() => setShowAssignModal(true)} className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Añadir leads
            </button>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 md:space-y-5">
        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (tab.id === 'analytics') loadAnalytics() }}
                className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-700 bg-brand-50/30'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ══ TAB: RESUMEN ══ */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard label="Total leads" value={stats.leads.total} color="text-blue-600 bg-blue-50" icon={Users} />
                  <StatCard label="Contactados" value={stats.leads.contacted} sub={`${stats.conversion.contact_rate}% del total`} color="text-purple-600 bg-purple-50" icon={Send} />
                  <StatCard label="Respondidos" value={stats.leads.replied} sub={`${stats.conversion.reply_rate}% de contactados`} color="text-green-600 bg-green-50" icon={TrendingUp} />
                  <StatCard label="Reuniones" value={stats.leads.meetings} sub={`${stats.conversion.meeting_rate}% de respuestas`} color="text-brand-600 bg-brand-50" icon={Calendar} />
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Funnel de leads */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Embudo de conversión</h3>
                    <div className="space-y-3">
                      <FunnelStep label="Total leads" count={stats.leads.total} total={stats.leads.total} color="bg-gray-400" />
                      <FunnelStep label="Enriquecidos con IA" count={stats.leads.enriched} total={stats.leads.total} color="bg-brand-400" />
                      <FunnelStep label="Contactados" count={stats.leads.contacted} total={stats.leads.total} color="bg-purple-500" />
                      <FunnelStep label="Respondieron" count={stats.leads.replied} total={stats.leads.total} color="bg-blue-500" />
                      <FunnelStep label="Interesados" count={stats.leads.interested} total={stats.leads.total} color="bg-green-500" />
                      <FunnelStep label="Reunión conseguida" count={stats.leads.meetings} total={stats.leads.total} color="bg-emerald-500" />
                      <FunnelStep label="Cerrado" count={stats.leads.closed} total={stats.leads.total} color="bg-teal-600" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Métricas de email */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Rendimiento de emails</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Enviados', value: stats.emails.sent, color: 'bg-gray-50 text-gray-700' },
                          { label: 'Abiertos', value: `${stats.emails.open_rate}%`, color: 'bg-blue-50 text-blue-700' },
                          { label: 'Respondidos', value: `${stats.emails.reply_rate}%`, color: 'bg-green-50 text-green-700' },
                          { label: 'Secuencias activas', value: stats.sequences.active, color: 'bg-brand-50 text-brand-700' },
                        ].map(m => (
                          <div key={m.label} className={`rounded-xl p-3 ${m.color}`}>
                            <p className="text-lg font-bold">{m.value}</p>
                            <p className="text-xs opacity-70">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Objetivos */}
                    {hasGoals && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" /> Objetivos de campaña
                        </h3>
                        <div className="space-y-3">
                          {(campaign.goal_leads ?? 0) > 0 && (
                            <GoalBar label="Leads contactados" current={stats.leads.contacted} goal={campaign.goal_leads!} color="bg-purple-500" />
                          )}
                          {(campaign.goal_replies ?? 0) > 0 && (
                            <GoalBar label="Respuestas conseguidas" current={stats.leads.replied} goal={campaign.goal_replies!} color="bg-blue-500" />
                          )}
                          {(campaign.goal_meetings ?? 0) > 0 && (
                            <GoalBar label="Reuniones cerradas" current={stats.leads.meetings} goal={campaign.goal_meetings!} color="bg-green-500" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Distribución por prioridad */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prioridad de leads</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Alta', count: stats.leads.by_priority.high, color: 'bg-red-100 text-red-700' },
                          { label: 'Media', count: stats.leads.by_priority.medium, color: 'bg-amber-100 text-amber-700' },
                          { label: 'Baja', count: stats.leads.by_priority.low, color: 'bg-gray-100 text-gray-600' },
                        ].map(p => (
                          <div key={p.label} className={`rounded-xl p-3 text-center ${p.color}`}>
                            <p className="text-xl font-bold">{p.count}</p>
                            <p className="text-xs">{p.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fechas */}
                {(campaign.start_date || campaign.end_date) && (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    {campaign.start_date && <span>Inicio: <strong>{formatDate(campaign.start_date)}</strong></span>}
                    {campaign.end_date && <span>Fin: <strong>{formatDate(campaign.end_date)}</strong></span>}
                    {campaign.start_date && campaign.end_date && (() => {
                      const start = new Date(campaign.start_date!)
                      const end = new Date(campaign.end_date!)
                      const now = new Date()
                      const total = (end.getTime() - start.getTime())
                      const elapsed = (now.getTime() - start.getTime())
                      const pct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
                      return <span className="ml-auto text-gray-400">{pct}% del tiempo transcurrido</span>
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB: LEADS ══ */}
            {activeTab === 'leads' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-600">
                    {campLeadsTotal} leads en esta campaña
                    {selectedToRemove.size > 0 && (
                      <span className="ml-2 text-red-600">· {selectedToRemove.size} seleccionados</span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    {selectedToRemove.size > 0 && (
                      <button
                        onClick={handleRemoveLeads}
                        disabled={removing}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                      >
                        {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Quitar de campaña ({selectedToRemove.size})
                      </button>
                    )}
                    <button onClick={() => setShowAssignModal(true)} className="btn-primary text-xs py-1.5">
                      <Plus className="w-3.5 h-3.5" /> Añadir leads existentes
                    </button>
                    <Link href={`/imports?campaign=${id}`} className="btn-secondary text-xs py-1.5">
                      <Plus className="w-3.5 h-3.5" /> Importar CSV
                    </Link>
                  </div>
                </div>

                {leads.length === 0 && campLeadsTotal === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">Esta campaña no tiene leads todavía.</p>
                    <button onClick={() => setShowAssignModal(true)} className="btn-primary text-xs">
                      <Plus className="w-3.5 h-3.5" /> Añadir leads existentes
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-3 py-2.5 text-left">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={selectedToRemove.size === leads.length && leads.length > 0}
                              onChange={e => setSelectedToRemove(e.target.checked ? new Set(leads.map(l => l.id)) : new Set())}
                            />
                          </th>
                          {['Empresa', 'Email', 'Estado', 'Prioridad', 'Score', 'Añadido'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                          <th className="px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {leads.map(lead => (
                          <tr key={lead.id} className={`transition-colors ${selectedToRemove.has(lead.id) ? 'bg-red-50' : 'odd:bg-white even:bg-indigo-50/30 hover:bg-indigo-50/60'}`}>
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={selectedToRemove.has(lead.id)}
                                onChange={e => {
                                  const s = new Set(selectedToRemove)
                                  e.target.checked ? s.add(lead.id) : s.delete(lead.id)
                                  setSelectedToRemove(s)
                                }}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-brand-700 flex items-center gap-1.5">
                                {lead.company_name}
                                {lead.is_enriched && <Zap className="w-3 h-3 text-brand-500" />}
                              </Link>
                              {lead.sector && <p className="text-xs text-gray-400">{lead.sector}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{lead.email || '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`badge ${statusColor(lead.status)}`}>{statusLabel(lead.status)}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`badge ${priorityColor(lead.priority)}`}>{lead.priority}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`badge font-semibold ${scoreToBg(lead.score)}`}>{lead.score}</span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-400">{formatDate(lead.created_at)}</td>
                            <td className="px-3 py-2.5">
                              <Link href={`/leads/${lead.id}`} className="text-xs text-brand-600 hover:text-brand-700">
                                Ver <ChevronRight className="w-3 h-3 inline" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Paginación de leads */}
                {campLeadsTotal > CAMP_LEADS_PER_PAGE && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {((campLeadsPage - 1) * CAMP_LEADS_PER_PAGE) + 1}–{Math.min(campLeadsPage * CAMP_LEADS_PER_PAGE, campLeadsTotal)} de {campLeadsTotal} leads
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Pág. {campLeadsPage} / {Math.ceil(campLeadsTotal / CAMP_LEADS_PER_PAGE)}</span>
                      <button
                        onClick={() => setCampLeadsPage(p => p - 1)}
                        disabled={campLeadsPage === 1}
                        className="btn-secondary text-xs py-1.5 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCampLeadsPage(p => p + 1)}
                        disabled={campLeadsPage >= Math.ceil(campLeadsTotal / CAMP_LEADS_PER_PAGE)}
                        className="btn-secondary text-xs py-1.5 disabled:opacity-40"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB: SECUENCIAS ══ */}
            {activeTab === 'sequences' && (() => {
              // Filtro y paginación client-side
              const seqTyped = sequences as { id: string; name: string; status: string; current_step: number; created_at: string; lead_id: string; lead?: { id: string; first_name?: string; last_name?: string; company_name: string; email?: string }; sequence_steps?: { id: string; step_number: number; subject: string; body: string; scheduled_for: string; status: string }[] }[]
              const seqFiltered = seqSearch
                ? seqTyped.filter(s => {
                    const q = seqSearch.toLowerCase()
                    const fullName = [s.lead?.first_name, s.lead?.last_name].filter(Boolean).join(' ').toLowerCase()
                    const company = (s.lead?.company_name ?? s.name).toLowerCase()
                    return fullName.includes(q) || company.includes(q)
                  })
                : seqTyped
              const seqTotalPages = Math.ceil(seqFiltered.length / SEQ_PAGE_SIZE)
              const seqPaged = seqFiltered.slice((seqPage - 1) * SEQ_PAGE_SIZE, seqPage * SEQ_PAGE_SIZE)
              return (
              <div className="space-y-4">
                {/* Cabecera con acciones */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-gray-600">{sequences.length} secuencias en esta campaña</p>
                  <div className="flex items-center gap-2">
                    {sequences.length > 0 && (
                      <button
                        onClick={handleDeleteAllSequences}
                        disabled={deletingAllSeqs}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                      >
                        {deletingAllSeqs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Borrar todas
                      </button>
                    )}
                    <Link href={`/leads?campaign=${id}`} className="btn-secondary text-xs py-1.5">
                      <Users className="w-3.5 h-3.5" /> Ver leads
                    </Link>
                    {lushaConnected && (
                      <>
                        <button
                          onClick={handleLushaEnrichCampaign}
                          disabled={lushaEnriching}
                          className="btn-secondary text-xs py-1.5"
                          title="Busca email y teléfono para los leads sin datos de contacto"
                        >
                          {lushaEnriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {lushaEnriching ? 'Enriqueciendo...' : 'Enriquecer con Lusha'}
                        </button>
                        <button
                          onClick={() => { setShowLushaModal(true); setLushaProspects([]); setLushaLastResult(null) }}
                          className="btn-secondary text-xs py-1.5"
                          title="Busca nuevos prospectos en Lusha e impórtalos como leads"
                        >
                          <Search className="w-3.5 h-3.5" /> Prospectos Lusha
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setSeqModalStep('info'); setSeqPreviewSteps([]); setShowSeqModal(true) }}
                      className="btn-primary text-xs py-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Iniciar secuencia de 3 o 5 toques
                    </button>
                  </div>
                </div>

                {/* Buscador */}
                {sequences.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9 text-sm"
                      placeholder="Buscar por nombre de empresa..."
                      value={seqSearch}
                      onChange={e => { setSeqSearch(e.target.value); setSeqPage(1) }}
                    />
                  </div>
                )}

                {/* Reprogramación masiva */}
                {sequences.length > 0 && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5" /> Reprogramar todas las secuencias
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Email inicial', 'Follow-up (+5d)', 'Último intento (+10d)'] as const).map((label, i) => (
                        <div key={i}>
                          <p className="text-xs text-gray-500 mb-1">{label}</p>
                          <input
                            type="datetime-local"
                            className="input text-xs py-1"
                            value={bulkDates[i]}
                            onChange={e => setBulkDates(prev => { const n = [...prev] as [string,string,string]; n[i] = e.target.value; return n })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleApplyBulkDates}
                        disabled={applyingBulk || bulkDates.every(d => !d)}
                        className="btn-primary text-xs"
                      >
                        {applyingBulk ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Aplicando...</> : <><CalendarClock className="w-3.5 h-3.5" /> Aplicar a todas</>}
                      </button>
                    </div>
                  </div>
                )}

                {sequences.length === 0 ? (
                  <div className="py-10 text-center">
                    <Mails className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No hay secuencias iniciadas en esta campaña.</p>
                    <p className="text-xs text-gray-400 mt-1">Pulsa "Iniciar secuencia de 3 o 5 toques" para elegir el formato y revisar los emails antes de enviarlos.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {seqPaged.map(seq => {
                      const isExpanded = expandedSeqId === seq.id
                      const steps = seq.sequence_steps ?? []
                      return (
                        <div key={seq.id} className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-brand-300' : 'border-gray-200'}`}>
                          {/* Cabecera de la secuencia */}
                          <div className="flex items-center gap-3 p-4 hover:bg-gray-50">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              seq.status === 'active' ? 'bg-green-500' :
                              seq.status === 'completed' ? 'bg-blue-500' :
                              seq.status === 'paused' ? 'bg-amber-500' : 'bg-gray-400'
                            }`} />
                            <button
                              className="flex-1 min-w-0 text-left"
                              onClick={() => setExpandedSeqId(isExpanded ? null : seq.id)}
                            >
                              {(seq.lead?.first_name || seq.lead?.last_name) && (
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {[seq.lead.first_name, seq.lead.last_name].filter(Boolean).join(' ')}
                                </p>
                              )}
                              <p className={`truncate ${(seq.lead?.first_name || seq.lead?.last_name) ? 'text-xs text-gray-500' : 'text-sm font-medium text-gray-900'}`}>
                                {seq.lead?.company_name ?? seq.name}
                              </p>
                              <p className="text-xs text-gray-400">{formatDateRelative(seq.created_at)}</p>
                            </button>
                            <span className={`badge shrink-0 ${
                              seq.status === 'active' ? 'bg-green-100 text-green-700' :
                              seq.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {seq.status === 'active' ? 'Activa' :
                               seq.status === 'completed' ? 'Completada' :
                               seq.status === 'paused' ? 'Pausada' : seq.status}
                            </span>
                            <p className="text-xs text-gray-400 shrink-0">Paso {seq.current_step}</p>
                            <button
                              onClick={() => setExpandedSeqId(isExpanded ? null : seq.id)}
                              className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 shrink-0 flex items-center gap-1"
                              title="Ver emails de la secuencia"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              Emails
                            </button>
                            <Link href={`/leads/${seq.lead_id}`} className="text-xs text-brand-600 hover:text-brand-700 shrink-0">
                              Lead <ChevronRight className="w-3 h-3 inline" />
                            </Link>
                            {(seq.status === 'active' || seq.status === 'paused') && (
                              <button
                                onClick={() => handleCancelSequence(seq.id)}
                                disabled={cancellingSeq === seq.id}
                                className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 shrink-0 flex items-center gap-1"
                              >
                                {cancellingSeq === seq.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                                Cancelar
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSequence(seq.id)}
                              disabled={deletingSeq === seq.id}
                              className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 shrink-0 flex items-center gap-1"
                            >
                              {deletingSeq === seq.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Borrar
                            </button>
                          </div>

                          {/* Pasos desplegables */}
                          {isExpanded && steps.length > 0 && (
                            <div className="border-t border-gray-100 bg-gray-50/50 divide-y divide-gray-100">
                              {[...steps].sort((a, b) => a.step_number - b.step_number).map(step => {
                                const isSent = step.status === 'sent'
                                const isSkipped = step.status === 'skipped'
                                const isStepExpanded = expandedStepId === step.id
                                const edits = stepEdits[step.id] ?? {}
                                const toLocal = (iso: string) => {
                                  const d = new Date(iso)
                                  const pad = (n: number) => String(n).padStart(2, '0')
                                  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                                }
                                const currentDate = edits.scheduled_for ?? (step.scheduled_for ? toLocal(step.scheduled_for) : '')
                                const currentSubject = edits.subject ?? step.subject
                                const currentBody = edits.body ?? (step as unknown as Record<string, string>).body ?? ''
                                const hasChanges = Object.keys(edits).length > 0
                                const stepLabels = ['Email inicial', 'Follow-up', 'Último intento']
                                return (
                                  <div key={step.id} className={`transition-all ${isStepExpanded ? 'bg-white' : ''}`}>
                                    {/* Cabecera del paso — siempre visible */}
                                    <button
                                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                                      onClick={() => setExpandedStepId(isStepExpanded ? null : step.id)}
                                    >
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                        isSent ? 'bg-green-500 text-white' :
                                        isSkipped ? 'bg-gray-300 text-gray-500' :
                                        'bg-brand-200 text-brand-700'
                                      }`}>
                                        {step.step_number}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-600">{stepLabels[step.step_number - 1]}</p>
                                        <p className="text-xs text-gray-700 truncate mt-0.5">{currentSubject}</p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {step.scheduled_for && (
                                          <span className="text-xs text-gray-400">
                                            {new Date(step.scheduled_for).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                            {' '}
                                            {new Date(step.scheduled_for).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                          isSent ? 'bg-green-100 text-green-700' :
                                          isSkipped ? 'bg-gray-100 text-gray-400' :
                                          'bg-brand-100 text-brand-700'
                                        }`}>
                                          {isSent ? '✓ Enviado' : isSkipped ? 'Omitido' : 'Pendiente'}
                                        </span>
                                        {hasChanges && <span className="text-xs text-amber-600 font-medium">● Editado</span>}
                                        {isStepExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                      </div>
                                    </button>

                                    {/* Contenido expandido del email */}
                                    {isStepExpanded && (
                                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                                        <div>
                                          <label className="label text-xs">Asunto</label>
                                          <input
                                            className="input text-sm"
                                            value={currentSubject}
                                            disabled={isSent || isSkipped}
                                            onChange={e => setStepEdits(prev => ({
                                              ...prev,
                                              [step.id]: { ...prev[step.id], subject: e.target.value }
                                            }))}
                                          />
                                        </div>
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="label text-xs">Cuerpo del email</label>
                                            {!isSent && !isSkipped && (
                                              <div className="flex items-center gap-1">
                                                {(['texto', 'html', 'preview'] as const).map(mode => (
                                                  <button
                                                    key={mode}
                                                    onClick={() => setEditingBodyStepId(
                                                      editingBodyStepId === `${step.id}-${mode}` ? null : `${step.id}-${mode}`
                                                    )}
                                                    className={`text-xs px-2 py-0.5 rounded-md font-medium transition-colors ${
                                                      editingBodyStepId === `${step.id}-${mode}`
                                                        ? mode === 'texto' ? 'bg-brand-100 text-brand-700'
                                                          : mode === 'html' ? 'bg-amber-100 text-amber-700'
                                                          : 'bg-green-100 text-green-700'
                                                        : 'text-gray-400 hover:bg-gray-100'
                                                    }`}
                                                  >
                                                    {mode === 'texto' ? '✏️ Texto' : mode === 'html' ? '</> HTML' : '👁 Preview'}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          {editingBodyStepId === `${step.id}-texto` && !isSent && !isSkipped ? (
                                            <RichTextEditor
                                              value={edits.body !== undefined ? edits.body : currentBody}
                                              onChange={v => setStepEdits(prev => ({
                                                ...prev,
                                                [step.id]: { ...prev[step.id], body: v }
                                              }))}
                                              placeholder="Escribe el cuerpo del email... (puedes añadir emojis 😊)"
                                            />
                                          ) : editingBodyStepId === `${step.id}-html` && !isSent && !isSkipped ? (
                                            <textarea
                                              className="input resize-y text-xs leading-relaxed w-full font-mono"
                                              rows={14}
                                              placeholder="Código HTML del email..."
                                              value={edits.body !== undefined ? edits.body : currentBody}
                                              onChange={e => setStepEdits(prev => ({
                                                ...prev,
                                                [step.id]: { ...prev[step.id], body: e.target.value }
                                              }))}
                                            />
                                          ) : (
                                            <div
                                              className="border border-gray-200 rounded-xl p-4 bg-white text-sm text-gray-800 leading-relaxed min-h-[120px]"
                                              style={{ fontFamily: 'sans-serif' }}
                                              dangerouslySetInnerHTML={{ __html: currentBody || '<p class="text-gray-400 text-xs italic">Sin contenido</p>' }}
                                            />
                                          )}
                                        </div>
                                        {!isSent && !isSkipped && (
                                          <div>
                                            <label className="label text-xs flex items-center gap-1">
                                              <CalendarClock className="w-3.5 h-3.5" /> Fecha y hora de envío
                                            </label>
                                            <input
                                              type="datetime-local"
                                              className="input text-sm"
                                              value={currentDate}
                                              onChange={e => setStepEdits(prev => ({
                                                ...prev,
                                                [step.id]: { ...prev[step.id], scheduled_for: e.target.value }
                                              }))}
                                            />
                                          </div>
                                        )}
                                        {!isSent && !isSkipped && hasChanges && (
                                          <div className="flex justify-end gap-2 pt-1">
                                            <button
                                              onClick={() => setStepEdits(prev => { const n = { ...prev }; delete n[step.id]; return n })}
                                              className="btn-secondary text-xs"
                                            >
                                              Descartar
                                            </button>
                                            <button
                                              onClick={() => handleSaveStep(step.id)}
                                              disabled={savingStep === step.id}
                                              className="btn-primary text-xs"
                                            >
                                              {savingStep === step.id
                                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                                                : <><Save className="w-3.5 h-3.5" /> Guardar cambios</>
                                              }
                                            </button>
                                          </div>
                                        )}
                                        {(isSent || isSkipped) && (
                                          <p className="text-xs text-gray-400 italic">Este email ya fue {isSent ? 'enviado' : 'omitido'} y no se puede editar.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Paginación */}
                {seqTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-500">
                      {seqFiltered.length} resultados · Página {seqPage} de {seqTotalPages}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSeqPage(p => Math.max(1, p - 1))}
                        disabled={seqPage === 1}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >← Anterior</button>
                      <button
                        onClick={() => setSeqPage(p => Math.min(seqTotalPages, p + 1))}
                        disabled={seqPage === seqTotalPages}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >Siguiente →</button>
                    </div>
                  </div>
                )}
              </div>
            )})()}

            {/* ══ TAB: ANALÍTICAS ══ */}
            {activeTab === 'analytics' && (
              <div className="space-y-4">
                {analyticsLoading ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-sm">Cargando analíticas...</p>
                  </div>
                ) : (
                  <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                          className="input pl-8 text-xs py-1.5"
                          placeholder="Buscar empresa, email..."
                          value={analyticsSearch}
                          onChange={e => setAnalyticsSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setAnalyticsLoaded(false); loadAnalytics() }}
                          className="btn-secondary text-xs py-1.5"
                          title="Recargar datos"
                        >
                          <TrendingUp className="w-3.5 h-3.5" /> Recargar
                        </button>
                        <button
                          onClick={exportAnalyticsExcel}
                          className="btn-secondary text-xs py-1.5"
                          disabled={sortedAnalytics.length === 0}
                        >
                          <FileText className="w-3.5 h-3.5" /> Excel
                        </button>
                        <button
                          onClick={exportAnalyticsPDF}
                          className="btn-primary text-xs py-1.5"
                          disabled={sortedAnalytics.length === 0}
                        >
                          <FileText className="w-3.5 h-3.5" /> PDF Ejecutivo
                        </button>
                      </div>
                    </div>

                    {/* KPI summary */}
                    {analyticsData.length > 0 && (() => {
                      const total = analyticsData.length
                      const totalSent = analyticsData.reduce((s, r) => s + r.sent, 0)
                      const totalOpened = analyticsData.reduce((s, r) => s + r.opened, 0)
                      const totalClicked = analyticsData.reduce((s, r) => s + r.clicked, 0)
                      const totalReplied = analyticsData.reduce((s, r) => s + r.replied, 0)
                      const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
                      const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0
                      return (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                          {[
                            { label: 'Leads', val: total, color: 'bg-gray-50 text-gray-700' },
                            { label: 'Enviados', val: totalSent, color: 'bg-blue-50 text-blue-700' },
                            { label: 'Abiertos', val: totalOpened, color: 'bg-sky-50 text-sky-700' },
                            { label: 'Clicados', val: totalClicked, color: 'bg-violet-50 text-violet-700' },
                            { label: 'Respondidos', val: totalReplied, color: 'bg-green-50 text-green-700' },
                            { label: 'Tasa apertura', val: `${openRate}%`, color: 'bg-brand-50 text-brand-700' },
                          ].map(k => (
                            <div key={k.label} className={`rounded-xl p-3 text-center ${k.color}`}>
                              <p className="text-xl font-bold">{k.val}</p>
                              <p className="text-xs opacity-70 mt-0.5">{k.label}</p>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Tabla */}
                    {sortedAnalytics.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 text-sm">
                        {analyticsData.length === 0 ? 'No hay datos de email para esta campaña aún.' : 'No hay resultados para esa búsqueda.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              {([
                                { col: 'interaction_level', label: 'Interacción' },
                                { col: 'company_name', label: 'Empresa / Contacto' },
                                { col: 'email', label: 'Email' },
                                { col: 'sent', label: 'Env.' },
                                { col: 'opened', label: 'Abert.' },
                                { col: 'clicked', label: 'Clics' },
                                { col: 'last_clicked_url', label: 'URL clicada' },
                                { col: 'replied', label: 'Resp.' },
                                { col: 'bounced', label: 'Rebote' },
                                { col: 'open_rate', label: '% Ap.' },
                                { col: 'reply_rate', label: '% Resp.' },
                                { col: 'last_email_at', label: 'Última act.' },
                                { col: 'has_active_sequence', label: 'Secuencia' },
                              ] as { col: typeof analyticsSort.col; label: string }[]).map(({ col, label }) => (
                                <th
                                  key={col}
                                  onClick={() => toggleAnalyticsSort(col)}
                                  className="px-3 py-2.5 text-left font-semibold text-gray-600 cursor-pointer hover:text-brand-700 select-none whitespace-nowrap"
                                >
                                  <span className="flex items-center gap-1">
                                    {label}
                                    {analyticsSort.col === col
                                      ? (analyticsSort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                                      : <span className="w-3 h-3 opacity-30"><ChevronDown className="w-3 h-3" /></span>}
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedAnalytics.map((row) => {
                              const rowBg =
                                row.interaction_level === 'replied' ? 'bg-green-50/60 hover:bg-green-50' :
                                row.interaction_level === 'clicked' ? 'bg-violet-50/40 hover:bg-violet-50' :
                                row.interaction_level === 'opened'  ? 'bg-sky-50/30 hover:bg-sky-50' :
                                'hover:bg-gray-50/60'
                              const interactionBadge =
                                row.interaction_level === 'replied' ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✅ Respondió</span> :
                                row.interaction_level === 'clicked' ? <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">🔵 Clicó</span> :
                                row.interaction_level === 'opened'  ? <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-semibold">👁 Abrió</span> :
                                row.interaction_level === 'sent'    ? <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">📧 Enviado</span> :
                                <span className="text-gray-300">—</span>
                              return (
                                <tr key={row.lead_id} className={`border-b border-gray-100 transition-colors ${rowBg}`}>
                                  <td className="px-3 py-2.5">{interactionBadge}</td>
                                  <td className="px-3 py-2.5">
                                    <p className="font-semibold text-gray-900 truncate max-w-[160px]">{row.company_name}</p>
                                    {row.contact_name && <p className="text-gray-500 truncate max-w-[160px]">{row.contact_name}</p>}
                                    {row.department && <p className="text-gray-400 truncate max-w-[160px]">{row.department}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-gray-500 truncate max-w-[140px]">{row.email}</td>
                                  <td className="px-3 py-2.5 text-center text-gray-700 font-medium">{row.sent}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    {row.opened > 0
                                      ? <span className="bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">{row.opened}</span>
                                      : <span className="text-gray-200">0</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {row.clicked > 0
                                      ? <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">{row.clicked}</span>
                                      : <span className="text-gray-200">0</span>}
                                  </td>
                                  <td className="px-3 py-2.5 max-w-[200px]">
                                    {row.last_clicked_url ? (
                                      <a
                                        href={row.last_clicked_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={row.last_clicked_url}
                                        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 hover:underline"
                                      >
                                        <span className="truncate max-w-[170px]">
                                          {(() => { try { const u = new URL(row.last_clicked_url); return u.hostname.replace(/^www\./, '') + u.pathname } catch { return row.last_clicked_url } })()}
                                        </span>
                                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                      </a>
                                    ) : (
                                      <span className="text-gray-200 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {row.replied > 0
                                      ? <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">{row.replied}</span>
                                      : <span className="text-gray-200">0</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {row.bounced > 0
                                      ? <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{row.bounced}</span>
                                      : <span className="text-gray-200">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-gray-500">{row.open_rate}%</td>
                                  <td className="px-3 py-2.5 text-center text-gray-500">{row.reply_rate}%</td>
                                  <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                                    {row.last_replied_at
                                      ? <span className="text-green-600 font-medium">{new Date(row.last_replied_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span>
                                      : row.last_opened_at
                                      ? new Date(row.last_opened_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})
                                      : row.last_email_at
                                      ? new Date(row.last_email_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})
                                      : '—'}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {row.has_active_sequence
                                      ? <span className="text-green-600 font-medium whitespace-nowrap">🟢 Activa</span>
                                      : row.sequence_completed
                                      ? <span className="text-blue-500 whitespace-nowrap">✅ Completada</span>
                                      : <span className="text-gray-300">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        <div className="flex items-center justify-between p-2 border-t border-gray-100">
                          <div className="flex gap-3 text-xs text-gray-400">
                            <span className="text-green-600 font-medium">✅ {sortedAnalytics.filter(r=>r.replied>0).length} respondieron</span>
                            <span className="text-violet-600">🔵 {sortedAnalytics.filter(r=>r.clicked>0&&r.replied===0).length} clicaron</span>
                            <span className="text-sky-600">👁 {sortedAnalytics.filter(r=>r.opened>0&&r.replied===0&&r.clicked===0).length} abrieron</span>
                            <span className="text-gray-400">📭 {sortedAnalytics.filter(r=>r.sent>0&&r.opened===0).length} sin actividad</span>
                          </div>
                          <p className="text-xs text-gray-400">{sortedAnalytics.length} de {analyticsData.length} leads</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══ TAB: AJUSTES ══ */}
            {activeTab === 'settings' && (
              <form onSubmit={handleSaveSettings} className="space-y-6 max-w-xl">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Información general</h3>
                  <div>
                    <label className="label">Nombre de la campaña</label>
                    <input className="input" value={editSettings.name ?? ''} onChange={e => setEditSettings(s => ({...s, name: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="label">Descripción</label>
                    <textarea className="input resize-none" rows={2} value={editSettings.description ?? ''} onChange={e => setEditSettings(s => ({...s, description: e.target.value}))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">País objetivo</label>
                      <input className="input" value={editSettings.country ?? ''} onChange={e => setEditSettings(s => ({...s, country: e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">Sector objetivo</label>
                      <select className="input" value={editSettings.sector ?? ''} onChange={e => setEditSettings(s => ({...s, sector: e.target.value}))}>
                        <option value="">— Seleccionar sector ICP —</option>
                        {MMC_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Estado</label>
                    <select className="input" value={editSettings.status ?? 'draft'} onChange={e => setEditSettings(s => ({...s, status: e.target.value}))}>
                      {STATUS_OPTIONS.map(st => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Fechas
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Fecha de inicio</label>
                      <input type="date" className="input" value={editSettings.start_date ?? ''} onChange={e => setEditSettings(s => ({...s, start_date: e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">Fecha de fin</label>
                      <input type="date" className="input" value={editSettings.end_date ?? ''} onChange={e => setEditSettings(s => ({...s, end_date: e.target.value}))} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Objetivos (KPIs)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">Leads a contactar</label>
                      <input type="number" min={0} className="input" value={editSettings.goal_leads ?? 0} onChange={e => setEditSettings(s => ({...s, goal_leads: parseInt(e.target.value) || 0}))} />
                    </div>
                    <div>
                      <label className="label">Respuestas objetivo</label>
                      <input type="number" min={0} className="input" value={editSettings.goal_replies ?? 0} onChange={e => setEditSettings(s => ({...s, goal_replies: parseInt(e.target.value) || 0}))} />
                    </div>
                    <div>
                      <label className="label">Reuniones objetivo</label>
                      <input type="number" min={0} className="input" value={editSettings.goal_meetings ?? 0} onChange={e => setEditSettings(s => ({...s, goal_meetings: parseInt(e.target.value) || 0}))} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button type="submit" disabled={savingSettings} className="btn-primary text-xs">
                    {savingSettings ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : <><Save className="w-3.5 h-3.5" /> Guardar cambios</>}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCampaign}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar campaña
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Modal: Prospectos Lusha ═══ */}
      <Modal
        isOpen={showLushaModal}
        onClose={() => setShowLushaModal(false)}
        title="Buscar prospectos en Lusha"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Busca nuevos contactos B2B en la base de datos de Lusha. Los prospectos encontrados se importarán como leads en esta campaña.
          </p>

          {/* Filtros */}
          <div className="grid grid-cols-2 gap-3">
            {/* Fila 1: empresa + dominio */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                🏢 Empresa (separadas por coma)
              </label>
              <input
                className="input text-sm w-full"
                placeholder="Coca-Cola, Nestlé, Danone"
                value={lushaFilters.companyNames}
                onChange={e => setLushaFilters(f => ({ ...f, companyNames: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                📧 Dominio de email (separados por coma)
              </label>
              <input
                className="input text-sm w-full"
                placeholder="coca-cola.com, nestle.com"
                value={lushaFilters.companyDomains}
                onChange={e => setLushaFilters(f => ({ ...f, companyDomains: e.target.value }))}
              />
            </div>
            {/* Fila 2: cargos + sectores */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cargos (separados por coma)</label>
              <input
                className="input text-sm w-full"
                placeholder="CMO, Marketing Manager, Brand Manager"
                value={lushaFilters.jobTitles}
                onChange={e => setLushaFilters(f => ({ ...f, jobTitles: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sectores (separados por coma)</label>
              <input
                className="input text-sm w-full"
                placeholder="FMCG, Consumer Goods, Food"
                value={lushaFilters.industries}
                onChange={e => setLushaFilters(f => ({ ...f, industries: e.target.value }))}
              />
            </div>
            {/* Fila 3: países + máx. resultados */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Países <span className="text-gray-400 font-normal">(en inglés, separados por coma)</span></label>
              <input
                className="input text-sm w-full"
                placeholder="Spain, France, Germany"
                value={lushaFilters.countries}
                onChange={e => setLushaFilters(f => ({ ...f, countries: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Máx. resultados</label>
              <select
                className="input text-sm w-full"
                value={lushaFilters.limit}
                onChange={e => setLushaFilters(f => ({ ...f, limit: Number(e.target.value) }))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            💡 Usa nombres en inglés y con mayúsculas correctas: <strong>Spain</strong> no "españa", <strong>Danone</strong> no "danone". Empresa y dominio son los filtros más potentes.
          </p>

          {/* Botón buscar */}
          <button
            type="button"
            onClick={handleLushaSearch}
            disabled={lushaSearching}
            className="btn-secondary text-sm"
          >
            {lushaSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {lushaSearching ? 'Buscando...' : 'Buscar en Lusha'}
          </button>

          {/* Resultados */}
          {lushaProspects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-700">{lushaProspects.length} prospectos encontrados</p>
                <button
                  type="button"
                  onClick={handleLushaImport}
                  disabled={lushaImporting}
                  className="btn-secondary text-xs py-1"
                >
                  {lushaImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownToLine className="w-3 h-3" />}
                  {lushaImporting ? 'Importando...' : `Importar todos (${lushaProspects.length})`}
                </button>
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-2">
                {lushaProspects.map((p, i) => {
                  const name = [p.firstName, p.lastName].filter(Boolean).join(' ')
                  const company = p.company || lushaFilters.companyNames.split(',')[0]?.trim() || '—'
                  const isPartial = !name && !p.email
                  const state = prospectStates[i] ?? {}

                  return (
                    <div key={i} className={`border rounded-xl p-3 text-xs transition-all ${
                      state.imported ? 'border-green-200 bg-green-50/40' :
                      isPartial ? 'border-amber-100 bg-amber-50/30' :
                      'border-gray-100 bg-white'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Nombre y empresa */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {name
                              ? <span className="font-semibold text-gray-900">{name}</span>
                              : <span className="italic text-gray-400">Nombre oculto</span>
                            }
                            <span className="text-gray-400">·</span>
                            <span className="font-medium text-gray-700">{company}</span>
                            {state.imported && <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded text-[10px] font-medium">✓ Importado</span>}
                            {isPartial && !state.imported && <span className="text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">parcial</span>}
                          </div>

                          {/* Cargo y país */}
                          <p className="text-gray-500 mt-0.5">
                            {p.jobTitle ?? ''}
                            {p.jobTitle && p.country ? ' · ' : ''}
                            {p.country ?? ''}
                          </p>

                          {/* Contacto */}
                          {p.email && <p className="text-brand-600 mt-0.5">{p.email}</p>}
                          {p.phone && <p className="text-gray-500">{p.phone}</p>}
                        </div>

                        {/* Acciones */}
                        {!state.imported && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              onClick={() => handleEnrichSingleProspect(p, i)}
                              disabled={state.enriching || state.importing}
                              className="btn-primary text-[11px] py-1 px-2 whitespace-nowrap"
                              title="Importa y enriquece automáticamente para revelar nombre y contacto"
                            >
                              {state.enriching
                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Buscando...</>
                                : <><Sparkles className="w-3 h-3" /> Enriquecer</>
                              }
                            </button>
                            <button
                              onClick={() => handleImportSingleProspect(p, i)}
                              disabled={state.importing || state.enriching}
                              className="btn-secondary text-[11px] py-1 px-2 whitespace-nowrap"
                              title="Importar sin enriquecer"
                            >
                              {state.importing
                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Importando...</>
                                : <><ArrowDownToLine className="w-3 h-3" /> Importar</>
                              }
                            </button>
                          </div>
                        )}
                        {state.imported && state.leadId && (
                          <a
                            href={`/leads/${state.leadId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:underline text-[11px] shrink-0"
                          >
                            Ver lead →
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══ Modal: Lanzar secuencias en bloque ═══ */}
      <Modal
        isOpen={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        title="Lanzar secuencias en bloque"
        size="md"
      >
        <div className="space-y-5">
          {templates.length > 0 ? (
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Se usará la <strong>secuencia de {seqTotalSteps} toques guardada</strong> para todos los leads. El contenido se personalizará automáticamente con el nombre y sector de cada empresa.</span>
            </div>
          ) : (
            <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-700">
              No hay secuencia guardada — se generará el contenido con IA para cada lead individualmente. Para más velocidad y control, guarda primero la secuencia en la pestaña "{seqTotalSteps} Toques".
            </div>
          )}

          <div>
            <label className="label">Cuentas de envío (round-robin)</label>
            <div className="space-y-2 mt-1">
              {[
                { email: 'guillaume@mymediaconnect.com',   label: 'Guillaume — MyMediaConnect' },
                { email: 'guillaume@gomymediaconnect.com', label: 'Guillaume — MyMediaConnect (gomymediaconnect)' },
                { email: 'guillaume@mymediaconnectgo.com', label: 'Guillaume — MyMediaConnect (mymediaconnectgo)' },
                { email: 'guillaume@mymediaconnect.es',    label: 'Guillaume — MyMediaConnect (mymediaconnect.es)' },
              ].map(acc => (
                <label key={acc.email} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={launchAccounts.includes(acc.email)}
                    onChange={e => {
                      if (e.target.checked) setLaunchAccounts(prev => [...prev, acc.email])
                      else setLaunchAccounts(prev => prev.filter(a => a !== acc.email))
                    }}
                    className="rounded border-gray-300 text-brand-500"
                  />
                  <span className="text-gray-700">{acc.label}</span>
                </label>
              ))}
            </div>
            {launchAccounts.length > 1 && (
              <p className="text-xs text-gray-400 mt-2">
                Los leads se repartirán entre {launchAccounts.length} cuentas de forma rotatoria (1 de cada {launchAccounts.length}).
              </p>
            )}
          </div>

          {/* Selector 3 o 5 toques para lanzamiento en bloque */}
          <div>
            <label className="label">Número de toques</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => setSeqTotalSteps(3)}
                className={`p-2.5 rounded-lg border-2 text-left transition-all ${seqTotalSteps === 3 ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="text-xs font-bold text-gray-800">3 toques</div>
                <div className="text-xs text-gray-500">Días 0 · 5 · 10</div>
              </button>
              <button
                onClick={() => setSeqTotalSteps(5)}
                className={`p-2.5 rounded-lg border-2 text-left transition-all ${seqTotalSteps === 5 ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="text-xs font-bold text-gray-800">5 toques</div>
                <div className="text-xs text-gray-500">Días 0 · 4 · 8 · 13 · 18</div>
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
            ⚠️ Este proceso genera emails con IA para cada lead y puede tardar varios minutos si la campaña tiene muchos leads. No cierres la página.
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowLaunchModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button
              onClick={handleBulkLaunch}
              disabled={launchingBulk || launchAccounts.length === 0}
              className="btn-primary text-xs"
            >
              {launchingBulk
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando secuencias...</>
                : <><Zap className="w-3.5 h-3.5" /> Lanzar secuencias</>
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══ Modal: asignar leads existentes ═══ */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setSelectedToAssign(new Set()); setAssignSearch('') }}
        title="Añadir leads a la campaña"
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por empresa o email..."
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
              autoFocus
            />
          </div>

          {selectedToAssign.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-brand-50 border border-brand-200 rounded-xl">
              <span className="text-sm text-brand-700 font-medium">{selectedToAssign.size} lead(s) seleccionados</span>
              <button onClick={() => setSelectedToAssign(new Set())} className="text-xs text-brand-600 hover:underline">Deseleccionar todo</button>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 border border-gray-200 rounded-xl">
            {loadingAvailable ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></div>
            ) : availableLeads.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No hay leads disponibles para añadir</div>
            ) : (
              availableLeads.map(lead => (
                <div
                  key={lead.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedToAssign.has(lead.id) ? 'bg-brand-50' : ''}`}
                  onClick={() => {
                    const s = new Set(selectedToAssign)
                    s.has(lead.id) ? s.delete(lead.id) : s.add(lead.id)
                    setSelectedToAssign(s)
                  }}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${
                    selectedToAssign.has(lead.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
                  }`}>
                    {selectedToAssign.has(lead.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{lead.company_name}</p>
                    <p className="text-xs text-gray-400">{lead.email || lead.sector || '—'}</p>
                  </div>
                  <span className={`badge ${scoreToBg(lead.score)} shrink-0`}>{lead.score}</span>
                  {lead.campaign_id && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Otra campaña</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAssignModal(false); setSelectedToAssign(new Set()) }}
              className="btn-secondary text-xs"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssign}
              disabled={assigning || selectedToAssign.size === 0}
              className="btn-primary text-xs"
            >
              {assigning
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Añadiendo...</>
                : <><Plus className="w-3.5 h-3.5" /> Añadir {selectedToAssign.size > 0 ? `(${selectedToAssign.size})` : ''}</>
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ Modal: Secuencia 3 toques campaña (idéntico al lead individual) ══ */}
      <Modal
        isOpen={showSeqModal}
        onClose={() => { setShowSeqModal(false); setSeqModalStep('info'); setSeqPreviewSteps([]) }}
        title={seqModalStep === 'info' ? `Secuencia ${seqTotalSteps} toques — Campaña` : 'Revisar y editar emails de la secuencia'}
        size="lg"
      >
        {seqModalStep === 'info' ? (
          <div className="space-y-4">
            <div className="p-4 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-800 space-y-2">
              <p className="font-medium">¿Cómo funciona la secuencia de campaña?</p>
              <ul className="text-xs space-y-1 text-brand-700">
                <li>📧 <strong>Email 1</strong> — Se programa para el día siguiente a las 9:00 (o cuando elijas)</li>
                {seqTotalSteps === 5 ? (
                  <>
                    <li>📧 <strong>Email 2</strong> — Se programa automáticamente 4 días después</li>
                    <li>📧 <strong>Email 3</strong> — Se programa automáticamente 8 días después</li>
                    <li>📧 <strong>Email 4</strong> — Se programa automáticamente 13 días después</li>
                    <li>📧 <strong>Email 5</strong> — Se programa automáticamente 18 días después</li>
                  </>
                ) : (
                  <>
                    <li>📧 <strong>Email 2</strong> — Se programa automáticamente 5 días después</li>
                    <li>📧 <strong>Email 3</strong> — Se programa automáticamente 10 días después</li>
                  </>
                )}
              </ul>
              <p className="text-xs text-brand-600 mt-2">
                La IA generará los {seqTotalSteps} emails usando el mismo sistema que las secuencias individuales.
                Podrás revisarlos, editarlos y ajustar la fecha de cada uno antes de guardar como plantilla.
                Al lanzar la campaña, se usará esta plantilla personalizada para cada lead.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
              <strong>Campaña:</strong> {campaign?.name} · {campaign?.sector ?? 'Sector no definido'} · {campaign?.country ?? 'País no definido'}
            </div>
            <div className="flex gap-2 justify-end items-center flex-wrap">
              <button onClick={() => setShowSeqModal(false)} className="btn-secondary text-xs">Cancelar</button>
              <button
                onClick={() => setSeqUseEmojis(e => !e)}
                className={`btn-secondary text-xs ${seqUseEmojis ? 'border-brand-400 text-brand-600 bg-brand-50' : ''}`}
                title={seqUseEmojis ? 'Emojis activados — pulsa para desactivar' : 'Sin emojis — pulsa para activar'}
              >
                {seqUseEmojis ? '😊 Con emojis' : '🚫 Sin emojis'}
              </button>
              <select
                value={seqLanguage}
                onChange={e => setSeqLanguage(e.target.value)}
                className="input text-xs py-1.5 w-36"
                title="Idioma de los emails generados"
              >
                <option value="es">🇪🇸 Español</option>
                <option value="en">🇬🇧 English</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="it">🇮🇹 Italiano</option>
                <option value="pt">🇵🇹 Português</option>
                <option value="nl">🇳🇱 Nederlands</option>
                <option value="ca">🇪🇸 Català</option>
              </select>
              {/* Selector 3 o 5 toques */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden text-xs">
                <button
                  onClick={() => setSeqTotalSteps(3)}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${seqTotalSteps === 3 ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="Secuencia de 3 toques (días 0, 5, 10)"
                >3 toques</button>
                <button
                  onClick={() => setSeqTotalSteps(5)}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${seqTotalSteps === 5 ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="Secuencia de 5 toques (días 0, 4, 8, 13, 18)"
                >5 toques</button>
              </div>
              <button
                onClick={handleGenerateCampaignPreview}
                disabled={generatingTemplate}
                className="btn-primary text-xs"
              >
                {generatingTemplate
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando con IA...</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Generar y revisar emails</>
                }
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-800 flex items-start gap-2">
              <span className="text-base">✏️</span>
              <span>Revisa y edita los emails. Ajusta <strong>asunto, cuerpo y fecha de envío</strong>. Al guardar, esta secuencia se usará para todos los leads de la campaña.</span>
            </div>

            <div className="space-y-2">
              {seqPreviewSteps.map((step, idx) => {
                const stepLabels = seqTotalSteps === 5
                  ? ['Toque 1 — Presentación · Día 0', 'Toque 2 — Follow-up · Día 4', 'Toque 3 — Profundización · Día 8', 'Toque 4 — Valor añadido · Día 13', 'Toque 5 — Último intento · Día 18']
                  : ['Toque 1 — Presentación · Día 0', 'Toque 2 — Follow-up · Día 5', 'Toque 3 — Último intento · Día 10']
                const isExpanded = expandedSeqStep === step.step_number
                return (
                  <div key={step.step_number} className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-brand-300' : 'border-gray-200'}`}>
                    <button
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedSeqStep(isExpanded ? 0 : step.step_number)}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${step.step_number === 1 ? 'bg-green-500 text-white' : 'bg-brand-200 text-brand-700'}`}>
                        {step.step_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-gray-700">{stepLabels[idx]}</p>
                          {step.scheduled_for && (
                            <span className="text-xs text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium shrink-0">
                              {new Date(step.scheduled_for).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                              {' '}
                              {new Date(step.scheduled_for).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{step.subject}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-3 bg-gray-50/50">
                        <div>
                          <label className="label text-xs">Asunto</label>
                          <input
                            className="input text-sm"
                            value={step.subject}
                            onChange={e => setSeqPreviewSteps(prev => prev.map(s =>
                              s.step_number === step.step_number ? { ...s, subject: e.target.value } : s
                            ))}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="label text-xs">Cuerpo del email</label>
                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden text-xs">
                              <button
                                onClick={() => setSeqPreviewBodyMode(prev => ({ ...prev, [step.step_number]: 'edit' }))}
                                className={`px-2.5 py-1 font-medium transition-colors ${(seqPreviewBodyMode[step.step_number] ?? 'preview') === 'edit' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                              >✏️ Editar</button>
                              <button
                                onClick={() => setSeqPreviewBodyMode(prev => ({ ...prev, [step.step_number]: 'preview' }))}
                                className={`px-2.5 py-1 font-medium transition-colors ${(seqPreviewBodyMode[step.step_number] ?? 'preview') === 'preview' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                              >👁 Preview</button>
                            </div>
                          </div>
                          {(seqPreviewBodyMode[step.step_number] ?? 'preview') === 'edit' ? (
                            <textarea
                              className="input resize-y text-xs leading-relaxed font-mono w-full"
                              rows={10}
                              value={step.body}
                              onChange={e => setSeqPreviewSteps(prev => prev.map(s =>
                                s.step_number === step.step_number ? { ...s, body: e.target.value } : s
                              ))}
                            />
                          ) : (
                            <div
                              className="border border-gray-200 rounded-xl p-4 bg-white text-sm text-gray-800 leading-relaxed min-h-[160px] overflow-auto"
                              style={{ fontFamily: 'sans-serif' }}
                              dangerouslySetInnerHTML={{ __html: step.body || '<p style="color:#9ca3af;font-size:12px;font-style:italic">Sin contenido</p>' }}
                            />
                          )}
                        </div>
                        <div>
                          <label className="label text-xs flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5" /> Fecha y hora de envío
                          </label>
                          <input
                            type="datetime-local"
                            className="input text-sm"
                            value={step.scheduled_for ?? ''}
                            onChange={e => setSeqPreviewSteps(prev => prev.map(s =>
                              s.step_number === step.step_number ? { ...s, scheduled_for: e.target.value } : s
                            ))}
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            cron-job.org enviará este email automáticamente cuando llegue esta fecha y hora.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Cuentas de envío */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Cuentas de envío (round-robin)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { email: 'guillaume@mymediaconnect.com',    label: 'Guillaume — mymediaconnect.com' },
                  { email: 'guillaume@gomymediaconnect.com',  label: 'Guillaume — gomymediaconnect.com' },
                  { email: 'guillaume@mymediaconnectgo.com',  label: 'Guillaume — mymediaconnectgo.com' },
                  { email: 'guillaume@mymediaconnect.es',     label: 'Guillaume — mymediaconnect.es' },
                ].map(acc => (
                  <label key={acc.email} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={launchAccounts.includes(acc.email)}
                      onChange={e => {
                        if (e.target.checked) setLaunchAccounts(prev => [...prev, acc.email])
                        else setLaunchAccounts(prev => prev.filter(a => a !== acc.email))
                      }}
                      className="rounded border-gray-300 text-brand-500"
                    />
                    <span className="text-gray-600 truncate">{acc.label}</span>
                  </label>
                ))}
              </div>
              {launchAccounts.length > 1 && (
                <p className="text-xs text-gray-400">Los leads se repartirán entre {launchAccounts.length} cuentas de forma rotatoria.</p>
              )}
              {launchAccounts.length === 0 && (
                <p className="text-xs text-red-500">Selecciona al menos una cuenta de envío.</p>
              )}
            </div>

            <div className="flex gap-2 justify-between pt-1">
              <button
                onClick={() => { setSeqModalStep('info'); setSeqPreviewSteps([]) }}
                className="btn-secondary text-xs"
              >
                ← Volver
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateCampaignPreview}
                  disabled={generatingTemplate}
                  className="btn-secondary text-xs"
                >
                  {generatingTemplate ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerando...</> : <><Sparkles className="w-3.5 h-3.5" /> Regenerar</>}
                </button>
                <button
                  onClick={handleConfirmAndLaunch}
                  disabled={launchingFromModal || launchAccounts.length === 0}
                  className="btn-primary text-xs"
                >
                  {launchingFromModal
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lanzando...</>
                    : <><Zap className="w-3.5 h-3.5" /> Confirmar y lanzar</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
