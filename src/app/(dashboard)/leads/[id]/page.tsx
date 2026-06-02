'use client'

import { useState, useEffect, lazy, Suspense } from 'react'

// Editor de texto enriquecido (requiere: pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-image)
const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor').catch(() => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <textarea
      className="input resize-none w-full"
      rows={8}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? 'Cuerpo del email...'}
    />
  )
})))
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import {
  ArrowLeft, Globe, Mail, Phone, Linkedin, Zap, MessageSquare,
  Send, StickyNote, CheckSquare, Activity, Edit2, ExternalLink, Trash2,
  Mails, Play, Pause, CheckCircle2, Clock, Loader2, Copy, Check, Sparkles, PenLine,
  ChevronDown, ChevronUp, Save, CalendarClock, AlertTriangle, RefreshCw, Pencil, RotateCcw,
  Megaphone, PlusCircle, X as XIcon, UserX, UserCheck, BellOff
} from 'lucide-react'
import {
  statusLabel, statusColor, priorityColor, scoreToBg,
  formatDate, formatDateRelative
} from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'

const STATUSES = [
  'new','enriched','pending_review','approved','contacted',
  'replied','interested','not_interested','meeting_scheduled','closed','discarded'
]

const PRIORITIES = ['low', 'medium', 'high']

const MESSAGE_TYPES = [
  { value: 'initial_email', label: 'Email inicial' },
  { value: 'followup_1', label: 'Follow-up 1' },
  { value: 'followup_2', label: 'Follow-up 2' },
  { value: 'linkedin_message', label: 'Mensaje LinkedIn' },
  { value: 'internal_summary', label: 'Resumen interno' },
]

const TONES = [
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'cercano', label: 'Cercano' },
  { value: 'formal', label: 'Formal' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'directo', label: 'Directo' },
]

type LeadRecord = Record<string, unknown>
type SequenceStep = {
  id: string
  step_number: number
  status: string
  subject: string
  body: string
  scheduled_for?: string
  sent_at?: string
}
type Sequence = {
  id: string
  name: string
  status: string
  current_step: number
  created_at: string
  sequence_steps?: SequenceStep[]
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTWORK GAP RADAR — Las 4 dimensiones de riesgo/oportunidad para MyMediaConnect
// Equivalente al Brand Gap Analysis de Delamata, adaptado al ICP de artwork proofing
// ─────────────────────────────────────────────────────────────────────────────
const ARTWORK_DIMENSIONS = [
  {
    label: 'Complejidad',
    sublabel: 'Volumen de SKUs y versiones',
    keywords: [
      'multi-sku', 'multiskু', 'sku', 'variant', 'varian', 'gama', 'portafolio', 'portfolio',
      'catálogo', 'catalog', 'idioma', 'language', 'market', 'mercado', 'international',
      'global', 'region', 'format', 'formato', 'size', 'talla', 'version', 'versión',
    ],
  },
  {
    label: 'Proceso manual',
    sublabel: 'Riesgo por flujos sin digitalizar',
    keywords: [
      'manual', 'excel', 'email', 'aprov', 'approv', 'revision', 'revisión', 'corrección',
      'correccion', 'proof', 'artwork', 'bottleneck', 'delay', 'retraso', 'error', 'mistake',
      'rework', 'retraba', 'sign-off', 'sign off', 'workflow', 'flujo', 'proceso', 'coordinación',
    ],
  },
  {
    label: 'Riesgo regulatorio',
    sublabel: 'Compliance y etiquetado',
    keywords: [
      'regulat', 'compliance', 'normativa', 'etiqueta', 'label', 'recall', 'retirada',
      'fda', 'efsa', 'reach', 'nutriscore', 'nutri', 'ingredient', 'ingrediente', 'allergen',
      'alérgeno', 'legal', 'claim', 'declaración', 'farmaco', 'pharma', 'fármac', 'medical',
    ],
  },
  {
    label: 'Escala global',
    sublabel: 'Distribución multi-mercado',
    keywords: [
      'global', 'international', 'multinacional', 'export', 'exporta', 'distribu',
      'expansion', 'expansión', 'europe', 'europa', 'latam', 'asia', 'us ', 'united states',
      'uk ', 'germany', 'alemania', 'france', 'retail', 'retailer', 'grocery', 'supermarket',
    ],
  },
]

function computeArtworkScores(enrichment: Record<string, unknown>): number[] {
  const corpus = [
    ...(enrichment.detected_problems as string[] ?? []),
    ...(enrichment.detected_needs as string[] ?? []),
    (enrichment.company_summary as string) ?? '',
    (enrichment.priority_reason as string) ?? '',
    (enrichment.media_connector_fit as string) ?? '',
    (enrichment.what_they_do as string) ?? '',
  ].join(' ').toLowerCase()

  return ARTWORK_DIMENSIONS.map(dim => {
    const hits = dim.keywords.filter(k => corpus.includes(k)).length
    const base = Math.round((hits / dim.keywords.length) * 82 + 12)
    const jitter = (corpus.length % (7 + dim.keywords.length)) % 10
    return Math.min(94, Math.max(12, base + jitter))
  })
}

function ArtworkGapRadar({ enrichment }: { enrichment: Record<string, unknown> }) {
  const scores = computeArtworkScores(enrichment)
  const CX = 110, CY = 110, R = 72

  const axes = [
    { ax: CX,       ay: CY - R },
    { ax: CX + R,   ay: CY     },
    { ax: CX,       ay: CY + R },
    { ax: CX - R,   ay: CY     },
  ]
  const points = scores.map((s, i) => ({
    x: CX + (axes[i].ax - CX) * s / 100,
    y: CY + (axes[i].ay - CY) * s / 100,
  }))
  const polygon = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const gridLevels = [0.25, 0.5, 0.75, 1]
  const scoreColor = (s: number) => s >= 65 ? '#6366f1' : s >= 40 ? '#f59e0b' : '#6ee7b7'
  const urgencyLabel = (s: number) => s >= 65 ? 'Alta oportunidad' : s >= 40 ? 'Potencial' : 'Estable'

  return (
    <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">
            Artwork Gap Analysis
          </h4>
          <p className="text-[10px] mt-0.5 text-gray-400">
            {(() => {
              type RawSig = { results?: unknown[] }
              const raw = (enrichment.raw_ai_response as Record<string, unknown>)?.brand_signals as RawSig[] | undefined
              const n = raw?.reduce((a, s) => a + (s.results?.length ?? 0), 0) ?? 0
              return n > 0
                ? `Web corporativa + ${n} señales detectadas en internet`
                : 'Diagnóstico de complejidad de artwork detectado por IA'
            })()}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" style={{ boxShadow: '0 0 4px #6366f1' }} />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-brand-500 opacity-70">Intelligence</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* SVG Radar */}
        <div className="shrink-0">
          <svg viewBox="0 0 220 220" width={160} height={160}>
            {gridLevels.map(p => {
              const gpts = axes.map(a => ({
                x: CX + (a.ax - CX) * p,
                y: CY + (a.ay - CY) * p,
              }))
              return (
                <polygon key={p}
                  points={gpts.map(g => `${g.x.toFixed(1)},${g.y.toFixed(1)}`).join(' ')}
                  fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth={0.8}
                />
              )
            })}
            {axes.map((a, i) => (
              <line key={i} x1={CX} y1={CY} x2={a.ax} y2={a.ay}
                stroke="rgba(99,102,241,0.2)" strokeWidth={0.8} />
            ))}
            <polygon points={polygon}
              fill="rgba(99,102,241,0.15)" stroke="#6366f1"
              strokeWidth={1.8} strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#6366f1" stroke="white" strokeWidth={1} />
            ))}
            <text x={CX} y={CY - R - 8} textAnchor="middle" fontSize={7} fill="#374151" fillOpacity={0.8} fontWeight="600">
              {ARTWORK_DIMENSIONS[0].label}
            </text>
            <text x={CX + R + 8} y={CY + 3} textAnchor="start" fontSize={7} fill="#374151" fillOpacity={0.8} fontWeight="600">
              {ARTWORK_DIMENSIONS[1].label}
            </text>
            <text x={CX} y={CY + R + 14} textAnchor="middle" fontSize={7} fill="#374151" fillOpacity={0.8} fontWeight="600">
              {ARTWORK_DIMENSIONS[2].label}
            </text>
            <text x={CX - R - 8} y={CY + 3} textAnchor="end" fontSize={7} fill="#374151" fillOpacity={0.8} fontWeight="600">
              {ARTWORK_DIMENSIONS[3].label}
            </text>
            {points.map((p, i) => (
              <text key={i}
                x={p.x + (axes[i].ax - CX) * 0.22}
                y={p.y + (axes[i].ay - CY) * 0.22 + 2}
                textAnchor="middle" fontSize={7.5} fontWeight="700"
                fill={scoreColor(scores[i])}
              >{scores[i]}</text>
            ))}
          </svg>
        </div>

        {/* Leyenda */}
        <div className="flex-1 space-y-2 min-w-0">
          {ARTWORK_DIMENSIONS.map((dim, i) => (
            <div key={dim.label}>
              <div className="flex items-center justify-between mb-0.5">
                <div>
                  <span className="text-[11px] font-semibold text-gray-800">{dim.label}</span>
                  <span className="text-[9px] ml-1 text-gray-400">{dim.sublabel}</span>
                </div>
                <span className="text-[10px] font-bold ml-2 shrink-0" style={{ color: scoreColor(scores[i]) }}>
                  {urgencyLabel(scores[i])}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${scores[i]}%`, background: scoreColor(scores[i]) }} />
              </div>
            </div>
          ))}

          {/* Fuentes analizadas */}
          {(() => {
            type RawSignal = { query: string; results: Array<{ title: string; snippet: string; url?: string; date?: string }> }
            const rawSignals = (enrichment.raw_ai_response as Record<string, unknown>)?.brand_signals as RawSignal[] | undefined
            const totalSources = rawSignals?.reduce((acc, s) => acc + (s.results?.length ?? 0), 0) ?? 0
            if (!rawSignals || totalSources === 0) {
              return <p className="text-[9px] pt-1 text-gray-400">Análisis basado en web corporativa</p>
            }
            const headlines = rawSignals.flatMap(s => s.results ?? []).filter(r => r.snippet && r.snippet.length > 20).slice(0, 2)
            return (
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-indigo-500">
                    {totalSources} fuentes en internet analizadas
                  </span>
                </div>
                {headlines.map((h, hi) => (
                  <div key={hi} className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <p className="text-[10px] font-medium leading-tight line-clamp-1 text-gray-600">{h.title}</p>
                    <p className="text-[9px] mt-0.5 leading-tight line-clamp-2 text-gray-400">{h.snippet}</p>
                    {h.date && <p className="text-[8px] mt-0.5 text-indigo-300">{h.date}</p>}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// Helpers
function isOverdue(scheduled_for?: string) {
  if (!scheduled_for) return false
  return new Date(scheduled_for) <= new Date()
}

function minutesUntil(scheduled_for?: string) {
  if (!scheduled_for) return null
  return Math.round((new Date(scheduled_for).getTime() - Date.now()) / 60000)
}

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [lead, setLead] = useState<LeadRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [lushaEnriching, setLushaEnriching] = useState(false)
  const [lushaConnected, setLushaConnected] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'info'|'messages'|'emails'|'notes'|'tasks'|'activity'|'sequences'>('info')

  // Modals
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showSendEmailModal, setShowSendEmailModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Generate message form
  const [msgTab, setMsgTab] = useState<'generate' | 'improve'>('generate')
  const [msgType, setMsgType] = useState('initial_email')
  const [msgTone, setMsgTone] = useState('consultivo')
  const [msgLang, setMsgLang] = useState<'es' | 'en' | 'fr'>('es')
  // msgRole: rol del interlocutor para adaptar el pain point del email
  // vacío = usar el department del lead; si se selecciona, sobrescribe para esa generación
  const [msgRole, setMsgRole] = useState('')
  const [msgEmojis, setMsgEmojis] = useState(false)
  const [generatingMsg, setGeneratingMsg] = useState(false)
  const [generatedMsg, setGeneratedMsg] = useState<{subject?: string; body: string} | null>(null)
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null)

  // Improve message form
  const [userDraft, setUserDraft] = useState('')
  const [improveInstructions, setImproveInstructions] = useState('')
  const [improvingMsg, setImprovingMsg] = useState(false)
  const [improvedMsg, setImprovedMsg] = useState<{subject?: string; body: string} | null>(null)
  const [copiedImproved, setCopiedImproved] = useState(false)

  // Note form
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Email send form
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailFromAccount, setEmailFromAccount] = useState('guillaume@mymediaconnect.com')
  const [sendingEmail, setSendingEmail] = useState(false)

  // Sequences
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [launchingSequence, setLaunchingSequence] = useState(false)
  const [showSequenceModal, setShowSequenceModal] = useState(false)
  const [seqLanguage, setSeqLanguage] = useState('es')
  const [seqTotalSteps, setSeqTotalSteps] = useState<3 | 5>(3)
  const [triggeringSequence, setTriggeringSequence] = useState(false)
  const [triggerResult, setTriggerResult] = useState<{ sent: number; skipped: number; failed: number; message: string } | null>(null)
  const [restartingSeqId, setRestartingSeqId] = useState<string | null>(null)

  // Preview de secuencia (revisión antes de enviar)
  type PreviewStep = { step_number: number; label: string; subject: string; body: string; delay_days: number; scheduled_for: string }
  const [seqModalStep, setSeqModalStep] = useState<'info' | 'preview'>('info')
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [previewSteps, setPreviewSteps] = useState<PreviewStep[]>([])
  const [expandedPreviewStep, setExpandedPreviewStep] = useState<number>(1)

  // Sequence step editor
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [stepEdits, setStepEdits] = useState<Record<string, { subject: string; body: string; scheduled_for: string }>>({})
  const [savingStep, setSavingStep] = useState<string | null>(null)

  // Edit lead form
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Campaigns (many-to-many)
  type LeadCampaign = { campaign_id: string; campaign: { id: string; name: string; status: string } }
  type AllCampaign = { id: string; name: string; status: string }
  const [leadCampaigns, setLeadCampaigns] = useState<LeadCampaign[]>([])
  const [allCampaigns, setAllCampaigns] = useState<AllCampaign[]>([])
  const [showAddCampaign, setShowAddCampaign] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [removingCampaignId, setRemovingCampaignId] = useState<string | null>(null)

  // Lead lists (many-to-many via lead_list_members)
  type LeadListMember = { list_id: string; lead_lists: { id: string; name: string; color: string | null; icon: string | null } }
  type LeadListItem = { id: string; name: string; color: string | null; icon: string | null }
  const [leadLists, setLeadLists] = useState<LeadListMember[]>([])
  const [allLists, setAllLists] = useState<LeadListItem[]>([])
  const [showAddList, setShowAddList] = useState(false)
  const [selectedListId, setSelectedListId] = useState('')
  const [savingList, setSavingList] = useState(false)
  const [removingListId, setRemovingListId] = useState<string | null>(null)

  // Newsletter opt-out
  const [newsletterUnsubscribed, setNewsletterUnsubscribed] = useState(false)
  const [togglingUnsubscribe, setTogglingUnsubscribe] = useState(false)

  const fetchLeadCampaigns = async () => {
    const res = await fetch(`/api/leads/${id}/campaigns`)
    const json = await res.json()
    setLeadCampaigns(json.data ?? [])
  }

  const fetchAllCampaigns = async () => {
    const res = await fetch('/api/campaigns')
    const json = await res.json()
    setAllCampaigns(json.data ?? [])
  }

  const handleAddCampaign = async () => {
    if (!selectedCampaignId) return
    setSavingCampaign(true)
    const res = await fetch(`/api/leads/${id}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: selectedCampaignId }),
    })
    setSavingCampaign(false)
    if (res.ok) {
      setShowAddCampaign(false)
      setSelectedCampaignId('')
      fetchLeadCampaigns()
      toast.success('Campaña añadida', 'El lead ha sido añadido a la campaña.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo añadir a la campaña.')
    }
  }

  const handleRemoveCampaign = async (campaignId: string) => {
    setRemovingCampaignId(campaignId)
    const res = await fetch(`/api/leads/${id}/campaigns`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId }),
    })
    setRemovingCampaignId(null)
    if (res.ok) {
      fetchLeadCampaigns()
      toast.success('Campaña eliminada', 'El lead ha sido quitado de la campaña.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo quitar de la campaña.')
    }
  }

  const fetchLeadLists = async () => {
    const res = await fetch(`/api/leads/${id}/lists`)
    const json = await res.json()
    setLeadLists(json.data ?? [])
  }

  const fetchAllLists = async () => {
    const res = await fetch('/api/lists')
    const json = await res.json()
    setAllLists((json.data ?? []) as LeadListItem[])
  }

  const handleAddList = async () => {
    if (!selectedListId) return
    setSavingList(true)
    const res = await fetch(`/api/leads/${id}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: selectedListId }),
    })
    setSavingList(false)
    if (res.ok) {
      setShowAddList(false)
      setSelectedListId('')
      fetchLeadLists()
      toast.success('Añadido a la lista', 'El lead se ha añadido correctamente.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo añadir a la lista.')
    }
  }

  const handleRemoveList = async (listId: string) => {
    setRemovingListId(listId)
    const res = await fetch(`/api/leads/${id}/lists`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: listId }),
    })
    setRemovingListId(null)
    if (res.ok) {
      fetchLeadLists()
      toast.success('Quitado de la lista', 'El lead ha sido eliminado de la lista.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo quitar de la lista.')
    }
  }

  const fetchNewsletterStatus = async (email: string) => {
    const res = await fetch('/api/newsletters/unsubscribes')
    const json = await res.json()
    const list: Array<{ email: string }> = json.data ?? []
    setNewsletterUnsubscribed(list.some(u => u.email.toLowerCase() === email.toLowerCase()))
  }

  const handleToggleNewsletterOptOut = async () => {
    const email = (lead as Record<string, string>)?.email
    if (!email) return
    setTogglingUnsubscribe(true)

    if (newsletterUnsubscribed) {
      // Reactivar — DELETE
      const res = await fetch(`/api/newsletters/unsubscribes?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
      setTogglingUnsubscribe(false)
      if (res.ok) {
        setNewsletterUnsubscribed(false)
        toast.success('Reactivado', `${email} vuelve a recibir newsletters.`)
      } else {
        toast.error('Error', 'No se pudo reactivar.')
      }
    } else {
      // Dar de baja manual — POST
      const res = await fetch('/api/newsletters/unsubscribes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lead_id: id, reason: 'manual' }),
      })
      setTogglingUnsubscribe(false)
      if (res.ok) {
        setNewsletterUnsubscribed(true)
        toast.success('Dado de baja', `${email} ya no recibirá newsletters.`)
      } else {
        toast.error('Error', 'No se pudo dar de baja.')
      }
    }
  }

  const fetchLead = async () => {
    const res = await fetch(`/api/leads/${id}`)
    const json = await res.json()
    setLead(json.data)
    setLoading(false)
    // Cargar estado newsletter si tiene email
    const email = json.data?.email
    if (email) fetchNewsletterStatus(email)
  }

  const fetchSequences = async () => {
    const res = await fetch(`/api/sequences?lead_id=${id}`)
    const json = await res.json()
    setSequences(json.data ?? [])
  }

  useEffect(() => { fetchLead(); fetchSequences(); fetchLeadCampaigns(); fetchAllCampaigns(); fetchLeadLists(); fetchAllLists() }, [id])

  // Verificar si Lusha está conectado (solo una vez)
  useEffect(() => {
    fetch('/api/lusha')
      .then(r => r.json())
      .then(j => setLushaConnected(j.connected === true))
      .catch(() => setLushaConnected(false))
  }, [])

  const handleEnrich = async () => {
    setEnriching(true)
    const res = await fetch(`/api/leads/${id}/enrich`, { method: 'POST' })
    const json = await res.json()
    setEnriching(false)
    if (res.ok) {
      // Actualizar estado directamente desde la respuesta del API.
      // NO llamamos fetchLead() porque el join de Supabase puede devolver
      // enrichment vacío y sobreescribiría los datos que acabamos de recibir.
      if (json.data?.enrichment) {
        setLead(prev => prev ? {
          ...prev,
          enrichment: [json.data.enrichment],
          score: json.data.score ?? prev.score,
          priority: json.data.priority ?? prev.priority,
          is_enriched: true,
          status: (prev.status === 'new' || prev.status === 'enriched') ? 'enriched' : prev.status,
        } : prev)
      }
      // Ir al tab de Análisis IA para ver el resultado
      setActiveTab('info')
      toast.success('Lead enriquecido', 'El análisis IA se ha completado correctamente.')
    } else {
      toast.aiError(json.error ?? 'Error desconocido')
    }
  }

  const handleLushaEnrich = async () => {
    if (!lead) return
    setLushaEnriching(true)

    // Paso 1: intentar con Lusha /person (necesita nombre de contacto)
    const res = await fetch('/api/lusha/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id }),
    })
    const json = await res.json()

    if (res.ok && json.enriched > 0) {
      // Lusha encontró datos — éxito
      toast.success('Datos actualizados con Lusha', json.message)
      fetchLead()
      setLushaEnriching(false)
      return
    }

    if (res.ok && json.errors > 0) {
      toast.error('Error de Lusha', json.message || 'Comprueba tu API key y créditos en Lusha → Settings → API.')
      setLushaEnriching(false)
      return
    }

    if (res.ok && json.skipped > 0) {
      toast.success('Lead completo', 'Este lead ya tiene email y teléfono.')
      setLushaEnriching(false)
      return
    }

    // Paso 2: sin nombre o no encontrado en Lusha → fallback a cadena completa (SerpAPI + Hunter + IA)
    const reason = json.no_name > 0
      ? 'Sin nombre de contacto'
      : 'No encontrado en Lusha'

    toast.info(`${reason} — buscando con SerpAPI + Hunter...`, '')

    try {
      const enrichRes = await fetch(`/api/leads/${id}/enrich`, { method: 'POST' })
      const enrichJson = await enrichRes.json()
      fetchLead()
      if (enrichJson.email || enrichJson.data?.email) {
        toast.success('¡Email encontrado!', `Enriquecido vía SerpAPI/Hunter: ${enrichJson.email ?? enrichJson.data?.email}`)
      } else {
        toast.success('Enriquecimiento completado', 'Se buscó con SerpAPI + Hunter + IA. Puede que no haya email público disponible.')
      }
    } catch {
      toast.warning('Sin resultados', 'No se encontraron datos de contacto con ninguna fuente disponible.')
    }

    setLushaEnriching(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      window.location.href = '/leads'
    } else {
      const json = await res.json()
      toast.error('Error al eliminar', json.error || 'Inténtalo de nuevo.')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchLead()
  }

  const handleOpenEdit = () => {
    if (!lead) return
    setEditForm({
      company_name: (lead.company_name as string) ?? '',
      first_name: (lead.first_name as string) ?? '',
      last_name: (lead.last_name as string) ?? '',
      department: (lead.department as string) ?? '',
      job_title: (lead.job_title as string) ?? '',
      email: (lead.email as string) ?? '',
      phone: (lead.phone as string) ?? '',
      website: (lead.website as string) ?? '',
      country: (lead.country as string) ?? '',
      city: (lead.city as string) ?? '',
      sector: (lead.sector as string) ?? '',
      linkedin_url: (lead.linkedin_url as string) ?? '',
      description: (lead.description as string) ?? '',
      priority: (lead.priority as string) ?? 'medium',
      status: (lead.status as string) ?? 'new',
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSavingEdit(false)
    if (res.ok) {
      setShowEditModal(false)
      fetchLead()
      toast.success('Lead actualizado', 'Los cambios han sido guardados.')
    } else {
      const json = await res.json()
      toast.error('Error al guardar', json.error ?? 'Inténtalo de nuevo.')
    }
  }

  const handleGenerateMessage = async () => {
    setGeneratingMsg(true)
    setGeneratedMsg(null)
    const res = await fetch('/api/messages/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id, type: msgType, tone: msgTone, use_emojis: msgEmojis, lang: msgLang, role: msgRole || undefined }),
    })
    setGeneratingMsg(false)
    if (res.ok) {
      const json = await res.json()
      setGeneratedMsg({ subject: json.data.subject, body: json.data.body })
      fetchLead()
    } else {
      const json = await res.json()
      toast.aiError(json.error ?? 'Error generando mensaje')
    }
  }

  const handleDeleteMessage = async (msgId: string) => {
    setDeletingMsgId(msgId)
    const res = await fetch(`/api/messages/${msgId}`, { method: 'DELETE' })
    setDeletingMsgId(null)
    if (res.ok) {
      fetchLead()
      toast.success('Mensaje eliminado', 'El mensaje ha sido borrado.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo eliminar el mensaje.')
    }
  }

  const handleExpandStep = (step: SequenceStep) => {
    if (expandedStep === step.id) {
      setExpandedStep(null)
      return
    }
    setExpandedStep(step.id)
    if (!stepEdits[step.id]) {
      const dt = step.scheduled_for
        ? new Date(step.scheduled_for).toISOString().slice(0, 16)
        : ''
      setStepEdits(prev => ({
        ...prev,
        [step.id]: { subject: step.subject ?? '', body: step.body ?? '', scheduled_for: dt },
      }))
    }
  }

  const handleSaveStep = async (stepId: string) => {
    const edits = stepEdits[stepId]
    if (!edits) return
    setSavingStep(stepId)
    const res = await fetch('/api/sequences/steps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step_id: stepId,
        subject: edits.subject,
        body: edits.body,
        scheduled_for: edits.scheduled_for ? new Date(edits.scheduled_for).toISOString() : undefined,
      }),
    })
    setSavingStep(null)
    if (res.ok) {
      fetchSequences()
      setExpandedStep(null)
      toast.success('Paso guardado', 'Los cambios han sido guardados correctamente.')
    } else {
      const json = await res.json()
      toast.error('Error al guardar', json.error ?? 'Inténtalo de nuevo.')
    }
  }

  const handleTriggerNow = async () => {
    setTriggeringSequence(true)
    setTriggerResult(null)
    const res = await fetch('/api/sequences/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id }),
    })
    const json = await res.json()
    setTriggeringSequence(false)
    setTriggerResult({ sent: json.sent ?? 0, skipped: json.skipped ?? 0, failed: json.failed ?? 0, message: json.message ?? '' })
    if ((json.sent ?? 0) > 0) {
      fetchSequences()
      fetchLead()
      toast.success('Emails enviados', json.message)
    } else {
      toast.info?.('Sin envíos', json.message) ?? toast.success('Sin cambios', json.message)
    }
  }

  const handleCopyMsg = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleImproveMessage = async () => {
    if (!userDraft.trim()) return
    setImprovingMsg(true)
    setImprovedMsg(null)
    const res = await fetch('/api/messages/improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: id,
        draft: userDraft,
        tone: msgTone,
        instructions: improveInstructions || undefined,
      }),
    })
    setImprovingMsg(false)
    if (res.ok) {
      const json = await res.json()
      setImprovedMsg({ subject: json.data.subject, body: json.data.body })
      fetchLead()
    } else {
      const json = await res.json()
      toast.aiError(json.error ?? 'Error mejorando mensaje')
    }
  }

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return
    setSavingNote(true)
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id, content: noteContent }),
    })
    setSavingNote(false)
    setNoteContent('')
    setShowNoteModal(false)
    fetchLead()
  }

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSendingEmail(true)
    const res = await fetch('/api/emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: id,
        to_email: (lead as Record<string, string>)?.email,
        subject: emailSubject,
        email_body: emailBody,
        campaign_id: (lead as Record<string, string>)?.campaign_id,
        from_email: emailFromAccount || undefined,
      }),
    })
    setSendingEmail(false)
    if (res.ok) {
      setShowSendEmailModal(false)
      setEmailSubject('')
      setEmailBody('')
      fetchLead()
      toast.success('Email enviado', 'El email ha sido enviado correctamente.')
    } else {
      const json = await res.json()
      toast.error('Error al enviar email', json.error ?? 'Inténtalo de nuevo.')
    }
  }

  const handleGeneratePreview = async () => {
    setGeneratingPreview(true)
    const res = await fetch('/api/sequences/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id, language: seqLanguage, total_steps: seqTotalSteps }),
    })
    setGeneratingPreview(false)
    if (res.ok) {
      const json = await res.json()
      // Calcular fechas por defecto: hoy a las 9:00 + delay_days por step
      const base = new Date()
      base.setHours(9, 0, 0, 0)
      // Si ya pasaron las 9:00 de hoy, el paso 1 va a mañana a las 9:00
      if (new Date() > base) base.setDate(base.getDate() + 1)
      const withDates = json.steps.map((s: Omit<PreviewStep, 'scheduled_for'>) => {
        const d = new Date(base)
        d.setDate(d.getDate() + s.delay_days)
        return { ...s, scheduled_for: d.toISOString().slice(0, 16) }
      })
      setPreviewSteps(withDates)
      setSeqModalStep('preview')
      setExpandedPreviewStep(1)
    } else {
      const json = await res.json()
      toast.aiError(json.error ?? 'Error generando emails')
    }
  }

  const handleLaunchSequence = async () => {
    setLaunchingSequence(true)
    const res = await fetch('/api/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: id,
        campaign_id: (lead as Record<string, string>)?.campaign_id ?? null,
        language: seqLanguage,
        total_steps: seqTotalSteps,
        custom_steps: previewSteps.map(s => ({
          step_number: s.step_number,
          subject: s.subject,
          body: s.body,
          delay_days: s.delay_days,
          scheduled_for: s.scheduled_for ? new Date(s.scheduled_for).toISOString() : undefined,
        })),
      }),
    })
    setLaunchingSequence(false)
    if (res.ok) {
      setShowSequenceModal(false)
      setSeqModalStep('info')
      setPreviewSteps([])
      fetchSequences()
      fetchLead()
      toast.success('Secuencia programada', `Los ${seqTotalSteps} emails están programados y se enviarán automáticamente en las fechas elegidas.`)
    } else {
      const json = await res.json()
      toast.aiError(json.error ?? 'Error al iniciar secuencia')
    }
  }

  const handleSequenceAction = async (sequenceId: string, action: string) => {
    await fetch('/api/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId, action }),
    })
    fetchSequences()
  }

  const handleDeleteSequence = async (sequenceId: string) => {
    if (!confirm('¿Borrar esta secuencia definitivamente? Se eliminarán todos sus pasos y no se enviará nada más.')) return
    const res = await fetch('/api/sequences', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId }),
    })
    if (res.ok) {
      fetchSequences()
      toast.success('Secuencia eliminada')
    } else {
      const j = await res.json()
      toast.error('Error', j.error ?? 'No se pudo borrar la secuencia.')
    }
  }

  const handleRestartSequence = async (sequenceId: string) => {
    if (!confirm(`¿Reiniciar la secuencia? Se cancelará la actual, se regenerarán los ${seqTotalSteps} emails con IA y se reprogramarán desde hoy.`)) return
    setRestartingSeqId(sequenceId)
    setTriggerResult(null)
    const res = await fetch('/api/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId, action: 'restart' }),
    })
    setRestartingSeqId(null)
    if (res.ok) {
      fetchSequences()
      fetchLead()
      toast.success('Secuencia reiniciada', 'Se han generado 3 nuevos emails y reprogramado las fechas.')
    } else {
      const json = await res.json()
      toast.aiError(json.error ?? 'Error al reiniciar la secuencia')
    }
  }

  const handleMarkReplied = async (sequenceId: string) => {
    if (!confirm('¿Marcar como respondido? Esto cancelará los emails pendientes de la secuencia y marcará el lead como respondido.')) return
    const res = await fetch('/api/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId, action: 'mark_replied' }),
    })
    if (res.ok) {
      fetchSequences()
      fetchLead()
      toast.success('Marcado como respondido', 'La secuencia ha sido cancelada y el lead actualizado.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo marcar como respondido.')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full py-20 text-gray-400">Cargando...</div>
  }

  if (!lead) return <div className="p-6 text-red-500">Lead no encontrado.</div>

  const enrichment = (lead.enrichment as unknown[])?.[0] as Record<string, unknown> | undefined
  const messages = (lead.messages as unknown[]) ?? []
  const emails = (lead.emails as unknown[]) ?? []
  const notes = (lead.notes as unknown[]) ?? []
  const tasks = (lead.tasks as unknown[]) ?? []
  const activities = ((lead.activity_logs as unknown[]) ?? [])
    .sort((a, b) => new Date((b as Record<string,string>).created_at).getTime() - new Date((a as Record<string,string>).created_at).getTime())

  // Secuencias: pasos pendientes overdue
  const allPendingSteps = sequences.flatMap(s =>
    (s.sequence_steps ?? []).filter(step => step.status === 'pending')
  )
  const overdueSteps = allPendingSteps.filter(step => isOverdue(step.scheduled_for))

  const tabs = [
    { id: 'info', label: 'Análisis IA', count: enrichment ? 1 : 0 },
    { id: 'messages', label: 'Mensajes', count: messages.length },
    { id: 'emails', label: 'Emails', count: emails.length },
    { id: 'sequences', label: 'Secuencias', count: sequences.length },
    { id: 'notes', label: 'Notas', count: notes.length },
    { id: 'tasks', label: 'Tareas', count: tasks.length },
    { id: 'activity', label: 'Actividad', count: activities.length },
  ] as const

  return (
    <div className="animate-fade-in">
      <TopBar
        title={lead.company_name as string}
        subtitle={(lead as Record<string, {name: string}>).campaign?.name ?? 'Sin campaña'}
        actions={
          <div className="flex gap-2">
            <Link href="/leads" className="btn-secondary text-xs py-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Leads
            </Link>
            <button
              onClick={handleOpenEdit}
              className="btn-secondary text-xs py-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
            {/* Demo Brief: abre one-pager HTML imprimible en nueva pestaña */}
            {Boolean(lead.is_enriched) && (
              <a
                href={`/api/leads/${id}/demo-brief`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                title="Genera un one-pager listo para imprimir o enviar como PDF"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Demo Brief
              </a>
            )}
            {lushaConnected && (
              <button
                onClick={handleLushaEnrich}
                disabled={lushaEnriching}
                className="btn-secondary text-xs py-1.5"
                title="Busca email, teléfono y LinkedIn en Lusha"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {lushaEnriching ? 'Buscando...' : 'Lusha'}
              </button>
            )}
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="btn-primary text-xs py-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              {enriching ? 'Analizando...' : lead.is_enriched ? 'Re-enriquecer' : 'Enriquecer con IA'}
            </button>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="grid lg:grid-cols-3 gap-3 md:gap-6">
          {/* Panel izquierdo: datos del lead */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{lead.company_name as string}</h2>
                  {(lead as Record<string, string>).sector && (
                    <p className="text-xs text-gray-500">{(lead as Record<string, string>).sector}</p>
                  )}
                </div>
                <span className={`badge font-bold text-sm ${scoreToBg(lead.score as number)}`}>
                  {lead.score as number}
                </span>
              </div>

              {/* Nombre del contacto */}
              {((lead as Record<string, string>).first_name || (lead as Record<string, string>).last_name) && (
                <div className="mb-3 pb-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-800">
                    {[(lead as Record<string, string>).first_name, (lead as Record<string, string>).last_name].filter(Boolean).join(' ')}
                  </p>
                  {(lead as Record<string, string>).department && (
                    <p className="text-xs text-gray-400">{(lead as Record<string, string>).department}</p>
                  )}
                </div>
              )}

              <div className="space-y-2.5 text-sm">
                {(lead as Record<string, string>).website && (
                  <a href={(lead as Record<string, string>).website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-brand-600 hover:text-brand-700">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span className="truncate">{(lead as Record<string, string>).domain || (lead as Record<string, string>).website}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
                {(lead as Record<string, string>).email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4 shrink-0 text-gray-400" />
                    <span className="truncate">{(lead as Record<string, string>).email}</span>
                    {newsletterUnsubscribed && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium shrink-0" title="Dado de baja de newsletter">
                        NL baja
                      </span>
                    )}
                  </div>
                )}
                {(lead as Record<string, string>).phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>{(lead as Record<string, string>).phone}</span>
                  </div>
                )}
                {(lead as Record<string, string>).linkedin_url && (
                  <a href={(lead as Record<string, string>).linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                    <Linkedin className="w-4 h-4 shrink-0" />
                    <span>LinkedIn</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
                {((lead as Record<string, string>).country || (lead as Record<string, string>).city) && (
                  <p className="text-gray-500">
                    📍 {[(lead as Record<string, string>).city, (lead as Record<string, string>).country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Estado</span>
                  <select
                    className="text-xs font-medium border-0 bg-transparent cursor-pointer focus:outline-none"
                    value={lead.status as string}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Prioridad</span>
                  <span className={`badge ${priorityColor(lead.priority as string)}`}>
                    {lead.priority as string}
                  </span>
                </div>
                {(lead as Record<string, string>).source && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Origen</span>
                    <span className="text-xs text-gray-600">{(lead as Record<string, string>).source}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Listas de leads (many-to-many via lead_list_members) */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
                  </svg>
                  Listas
                  {leadLists.length > 0 && (
                    <span className="ml-1 bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                      {leadLists.length}
                    </span>
                  )}
                </p>
                <button
                  onClick={() => { setShowAddList(v => !v); setSelectedListId('') }}
                  className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-lg font-medium transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Añadir a lista
                </button>
              </div>

              {showAddList && (
                <div className="mb-3 p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-2">
                  <p className="text-xs font-medium text-purple-700">Selecciona una lista</p>
                  <div className="flex gap-2">
                    <select
                      className="input text-xs py-1.5 flex-1"
                      value={selectedListId}
                      onChange={e => setSelectedListId(e.target.value)}
                    >
                      <option value="">Elegir lista…</option>
                      {allLists
                        .filter(l => !leadLists.some(ll => ll.list_id === l.id))
                        .map(l => (
                          <option key={l.id} value={l.id}>{l.icon ? `${l.icon} ` : ''}{l.name}</option>
                        ))
                      }
                    </select>
                    <button
                      onClick={handleAddList}
                      disabled={!selectedListId || savingList}
                      className="btn-primary text-xs py-1.5 px-4 shrink-0 bg-purple-600 hover:bg-purple-700 border-purple-600"
                    >
                      {savingList ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Añadir'}
                    </button>
                    <button onClick={() => setShowAddList(false)} className="text-gray-400 hover:text-gray-600 p-1.5">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                  {allLists.filter(l => !leadLists.some(ll => ll.list_id === l.id)).length === 0 && (
                    <p className="text-xs text-purple-600">Este lead ya está en todas las listas disponibles.</p>
                  )}
                </div>
              )}

              {leadLists.length === 0 ? (
                <div className="text-center py-4">
                  <svg className="w-7 h-7 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
                  </svg>
                  <p className="text-xs text-gray-400 mb-2">Sin listas asignadas</p>
                  <button
                    onClick={() => { setShowAddList(true); setSelectedListId('') }}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    + Añadir a una lista
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {leadLists.map(ll => {
                    const lst = ll.lead_lists
                    return (
                      <div key={ll.list_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:border-purple-200 hover:bg-purple-50/30 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          {lst?.icon && <span className="text-sm shrink-0">{lst.icon}</span>}
                          <span className="text-xs font-medium text-gray-800 truncate">{lst?.name ?? 'Lista'}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveList(ll.list_id)}
                          disabled={removingListId === ll.list_id}
                          className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-0.5 rounded"
                          title="Quitar de esta lista"
                        >
                          {removingListId === ll.list_id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <XIcon className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Campañas del lead (many-to-many) */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" /> Campañas
                  {leadCampaigns.length > 0 && (
                    <span className="ml-1 bg-brand-100 text-brand-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                      {leadCampaigns.length}
                    </span>
                  )}
                </p>
                <button
                  onClick={() => { setShowAddCampaign(v => !v); setSelectedCampaignId('') }}
                  className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white px-2.5 py-1 rounded-lg font-medium transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Añadir a lista
                </button>
              </div>

              {showAddCampaign && (
                <div className="mb-3 p-3 bg-brand-50 border border-brand-100 rounded-xl space-y-2">
                  <p className="text-xs font-medium text-brand-700">Selecciona una campaña</p>
                  <div className="flex gap-2">
                    <select
                      className="input text-xs py-1.5 flex-1"
                      value={selectedCampaignId}
                      onChange={e => setSelectedCampaignId(e.target.value)}
                    >
                      <option value="">Elegir campaña…</option>
                      {allCampaigns
                        .filter(c => !leadCampaigns.some(lc => lc.campaign_id === c.id))
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.status !== 'active' ? ` (${c.status})` : ''}
                          </option>
                        ))
                      }
                    </select>
                    <button
                      onClick={handleAddCampaign}
                      disabled={!selectedCampaignId || savingCampaign}
                      className="btn-primary text-xs py-1.5 px-4 shrink-0"
                    >
                      {savingCampaign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Añadir'}
                    </button>
                    <button
                      onClick={() => setShowAddCampaign(false)}
                      className="text-gray-400 hover:text-gray-600 p-1.5"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                  {allCampaigns.filter(c => !leadCampaigns.some(lc => lc.campaign_id === c.id)).length === 0 && (
                    <p className="text-xs text-brand-600">Este lead ya está en todas las campañas disponibles.</p>
                  )}
                </div>
              )}

              {leadCampaigns.length === 0 ? (
                <div className="text-center py-4">
                  <Megaphone className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-2">Sin campañas asignadas</p>
                  <button
                    onClick={() => { setShowAddCampaign(true); setSelectedCampaignId('') }}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    + Añadir a una campaña
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {leadCampaigns.map(lc => {
                    const statusDot: Record<string, string> = {
                      active: 'bg-green-400',
                      paused: 'bg-amber-400',
                      completed: 'bg-gray-400',
                      draft: 'bg-gray-300',
                    }
                    return (
                      <div key={lc.campaign_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:border-brand-200 hover:bg-brand-50/30 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[lc.campaign?.status ?? ''] ?? 'bg-gray-300'}`} />
                          <Link
                            href={`/campaigns/${lc.campaign_id}`}
                            className="text-xs text-brand-700 hover:underline truncate font-medium"
                          >
                            {lc.campaign?.name ?? 'Campaña'}
                          </Link>
                        </div>
                        <button
                          onClick={() => handleRemoveCampaign(lc.campaign_id)}
                          disabled={removingCampaignId === lc.campaign_id}
                          className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-0.5 rounded"
                          title="Quitar de esta campaña"
                        >
                          {removingCampaignId === lc.campaign_id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <XIcon className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Newsletter opt-out */}
            {(lead as Record<string, string>).email && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <BellOff className="w-3.5 h-3.5" /> Newsletter
                  </p>
                </div>
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs mb-3 ${
                  newsletterUnsubscribed
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'bg-green-50 text-green-700 border border-green-100'
                }`}>
                  {newsletterUnsubscribed
                    ? <><UserX className="w-3.5 h-3.5 shrink-0" /> Dado de baja — no recibirá newsletters</>
                    : <><UserCheck className="w-3.5 h-3.5 shrink-0" /> Activo — puede recibir newsletters</>
                  }
                </div>
                <button
                  onClick={handleToggleNewsletterOptOut}
                  disabled={togglingUnsubscribe}
                  className={`btn-secondary w-full justify-center text-xs ${
                    newsletterUnsubscribed
                      ? 'text-green-600 border-green-200 hover:bg-green-50'
                      : 'text-red-600 border-red-200 hover:bg-red-50'
                  }`}
                >
                  {togglingUnsubscribe
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : newsletterUnsubscribed
                      ? <><UserCheck className="w-3.5 h-3.5" /> Reactivar newsletter</>
                      : <><UserX className="w-3.5 h-3.5" /> Dar de baja newsletter</>
                  }
                </button>
              </div>
            )}

            {/* Acciones rápidas */}
            <div className="card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Acciones</p>
              <button onClick={handleOpenEdit}
                className="btn-secondary w-full justify-start text-xs">
                <Pencil className="w-4 h-4" /> Editar lead
              </button>
              <button onClick={() => setShowMessageModal(true)}
                className="btn-secondary w-full justify-start text-xs">
                <MessageSquare className="w-4 h-4" /> Generar mensaje
              </button>
              {(lead as Record<string, string>).email && (
                <button onClick={() => setShowSendEmailModal(true)}
                  className="btn-secondary w-full justify-start text-xs">
                  <Send className="w-4 h-4" /> Enviar email
                </button>
              )}
              <button onClick={() => setShowNoteModal(true)}
                className="btn-secondary w-full justify-start text-xs">
                <StickyNote className="w-4 h-4" /> Añadir nota
              </button>
              {(lead as Record<string, string>).email ? (
                (() => {
                  const hasActive = sequences.some(s => s.status === 'active')
                  return hasActive ? (
                    <button
                      onClick={() => setActiveTab('sequences')}
                      className="btn-secondary w-full justify-start text-xs border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                    >
                      <Mails className="w-4 h-4" /> Secuencia activa · Ver →
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSequenceModal(true)}
                      className="btn-primary w-full justify-start text-xs"
                    >
                      <Mails className="w-4 h-4" /> Iniciar secuencia
                    </button>
                  )
                })()
              ) : (
                <button
                  disabled
                  className="btn-secondary w-full justify-start text-xs opacity-40 cursor-not-allowed"
                  title="Este lead no tiene email"
                >
                  <Mails className="w-4 h-4" /> Secuencia {seqTotalSteps} toques
                </button>
              )}
              {/* Aviso overdue */}
              {overdueSteps.length > 0 && (
                <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {overdueSteps.length} paso{overdueSteps.length > 1 ? 's' : ''} pendiente{overdueSteps.length > 1 ? 's' : ''} de envío
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: tabs */}
          <div className="lg:col-span-2">
            <div className="card">
              {/* Tabs */}
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? 'border-brand-500 text-brand-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ml-1.5 bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* TAB: Análisis IA */}
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    {!enrichment ? (
                      <div className="text-center py-8">
                        <Zap className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 mb-4">Este lead no ha sido analizado con IA todavía.</p>
                        <button onClick={handleEnrich} disabled={enriching} className="btn-primary text-xs">
                          <Zap className="w-3.5 h-3.5" /> {enriching ? 'Analizando...' : 'Enriquecer ahora'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Artwork Gap Radar — siempre visible si hay enrichment */}
                        <ArtworkGapRadar enrichment={enrichment} />

                        {enrichment.company_summary && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Resumen</h4>
                            <p className="text-sm text-gray-700">{enrichment.company_summary as string}</p>
                          </div>
                        )}
                        {(enrichment.detected_needs as string[])?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Necesidades detectadas</h4>
                            <ul className="space-y-1">
                              {(enrichment.detected_needs as string[]).map((n, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className="text-green-500 mt-0.5">✓</span> {n}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(enrichment.detected_problems as string[])?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Problemas detectados</h4>
                            <ul className="space-y-1">
                              {(enrichment.detected_problems as string[]).map((p, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className="text-orange-400 mt-0.5">⚠</span> {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {enrichment.media_connector_fit && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Encaje con Media Connector</h4>
                            <p className="text-sm text-gray-700">{enrichment.media_connector_fit as string}</p>
                          </div>
                        )}
                        {(enrichment.auto_tags as string[])?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tags IA</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {(enrichment.auto_tags as string[]).map(t => (
                                <span key={t} className="badge bg-brand-50 text-brand-700">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* TAB: Mensajes generados */}
                {activeTab === 'messages' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">{messages.length} mensajes generados</p>
                      <button onClick={() => setShowMessageModal(true)} className="btn-primary text-xs py-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> Nuevo mensaje
                      </button>
                    </div>
                    {messages.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">Sin mensajes. Genera uno con IA.</p>
                    )}
                    {(messages as { id: string; type: string; subject?: string; body: string; created_at: string }[]).map((msg) => (
                      <div key={msg.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                            {msg.type.replace('_', ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              disabled={deletingMsgId === msg.id}
                              className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Eliminar mensaje"
                            >
                              {deletingMsgId === msg.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </div>
                        {msg.subject && (
                          <p className="text-sm font-medium text-gray-800 mb-1">Asunto: {msg.subject}</p>
                        )}
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              setEmailSubject(msg.subject || '')
                              setEmailBody(msg.body)
                              setShowSendEmailModal(true)
                            }}
                            className="btn-secondary text-xs py-1"
                            disabled={!(lead as Record<string, string>).email}
                          >
                            <Send className="w-3 h-3" /> Usar para enviar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Emails */}
                {activeTab === 'emails' && (
                  <div className="space-y-3">
                    {emails.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin emails enviados.</p>}
                    {(emails as { id: string; subject: string; status: string; to_email: string; sent_at?: string }[]).map((email) => (
                      <div key={email.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800">{email.subject}</span>
                          <span className={`badge ${statusColor(email.status)}`}>{email.status}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Para: {email.to_email} {email.sent_at ? `· ${formatDate(email.sent_at)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Notas */}
                {activeTab === 'notes' && (
                  <div className="space-y-3">
                    <button onClick={() => setShowNoteModal(true)} className="btn-primary text-xs py-1.5">
                      <StickyNote className="w-3.5 h-3.5" /> Añadir nota
                    </button>
                    {notes.length === 0 && <p className="text-sm text-gray-400 py-4">Sin notas.</p>}
                    {(notes as { id: string; content: string; created_at: string }[]).map((note) => (
                      <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-gray-400 mt-2">{formatDateRelative(note.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Tareas */}
                {activeTab === 'tasks' && (
                  <div className="space-y-3">
                    {tasks.length === 0 && <p className="text-sm text-gray-400 py-4">Sin tareas.</p>}
                    {(tasks as { id: string; title: string; is_completed: boolean; due_date?: string }[]).map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl">
                        <CheckSquare className={`w-4 h-4 mt-0.5 shrink-0 ${task.is_completed ? 'text-green-500' : 'text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                          </p>
                          {task.due_date && (
                            <p className="text-xs text-gray-400">{formatDate(task.due_date)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Secuencias */}
                {activeTab === 'sequences' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">{sequences.length} secuencia{sequences.length !== 1 ? 's' : ''}</p>
                      <div className="flex gap-2">
                        {/* Botón disparar envío ahora */}
                        {overdueSteps.length > 0 && (
                          <button
                            onClick={handleTriggerNow}
                            disabled={triggeringSequence}
                            className="btn-primary text-xs py-1.5 bg-amber-500 hover:bg-amber-600 border-amber-500"
                          >
                            {triggeringSequence
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                              : <><RefreshCw className="w-3.5 h-3.5" /> Enviar {overdueSteps.length} pendiente{overdueSteps.length > 1 ? 's' : ''} ahora</>
                            }
                          </button>
                        )}
                        {!sequences.some(s => s.status === 'active') && (
                          <button
                            onClick={() => setShowSequenceModal(true)}
                            className="btn-primary text-xs py-1.5"
                            disabled={!(lead as Record<string, string>).email}
                          >
                            <Mails className="w-3.5 h-3.5" /> Iniciar secuencia
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Resultado del disparo manual */}
                    {triggerResult && (
                      <div className={`p-3 rounded-xl text-xs border ${
                        triggerResult.sent > 0 ? 'bg-green-50 border-green-200 text-green-800' :
                        triggerResult.failed > 0 ? 'bg-red-50 border-red-200 text-red-800' :
                        'bg-gray-50 border-gray-200 text-gray-700'
                      }`}>
                        <p className="font-medium mb-1">{triggerResult.message}</p>
                        <p>Enviados: {triggerResult.sent} · Omitidos: {triggerResult.skipped} · Fallidos: {triggerResult.failed}</p>
                      </div>
                    )}

                    {!(lead as Record<string, string>).email && (
                      <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                        ⚠ Este lead no tiene email. Añade uno para poder enviar secuencias.
                      </p>
                    )}
                    {sequences.length === 0 && (
                      <div className="text-center py-8">
                        <Mails className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 mb-2">Sin secuencias activas</p>
                        <p className="text-xs text-gray-400">{seqTotalSteps === 5 ? 'Una secuencia envía 5 emails automáticos: día 0, 4, 8, 13 y 18' : 'Una secuencia envía 3 emails automáticos: día 1, día 5 y día 10'}</p>
                      </div>
                    )}

                    {sequences.map(seq => (
                      <div key={seq.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{seq.name}</p>
                            <p className="text-xs text-gray-400">{formatDate(seq.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${
                              seq.status === 'active' ? 'bg-green-100 text-green-700' :
                              seq.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                              seq.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {seq.status === 'active' ? '● Activa' :
                               seq.status === 'completed' ? '✓ Completada' :
                               seq.status === 'paused' ? '⏸ Pausada' : seq.status}
                            </span>
                            {seq.status === 'active' && (
                              <button onClick={() => handleSequenceAction(seq.id, 'pause')}
                                className="btn-secondary text-xs py-1 px-2" title="Pausar">
                                <Pause className="w-3 h-3" />
                              </button>
                            )}
                            {seq.status === 'active' && (
                              <button
                                onClick={() => handleMarkReplied(seq.id)}
                                className="btn-secondary text-xs py-1 px-2 text-green-600 border-green-200 hover:bg-green-50"
                                title="El lead ha respondido — cancela los emails pendientes"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="ml-1">Respondió</span>
                              </button>
                            )}
                            {seq.status === 'paused' && (
                              <button onClick={() => handleSequenceAction(seq.id, 'resume')}
                                className="btn-secondary text-xs py-1 px-2" title="Reanudar">
                                <Play className="w-3 h-3" />
                              </button>
                            )}
                            {/* Botón Reiniciar — visible cuando está pausada, completada o cancelada */}
                            {(seq.status === 'paused' || seq.status === 'completed' || seq.status === 'cancelled') && (
                              <button
                                onClick={() => handleRestartSequence(seq.id)}
                                disabled={restartingSeqId === seq.id}
                                className="btn-secondary text-xs py-1 px-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                                title="Reiniciar secuencia desde el principio"
                              >
                                {restartingSeqId === seq.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <RotateCcw className="w-3 h-3" />
                                }
                              </button>
                            )}
                            {/* Botón Borrar — siempre visible */}
                            <button
                              onClick={() => handleDeleteSequence(seq.id)}
                              className="btn-secondary text-xs py-1 px-2 text-red-500 border-red-200 hover:bg-red-50"
                              title="Borrar secuencia definitivamente"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Pasos con diagnóstico */}
                        <div className="space-y-2">
                          {(seq.sequence_steps ?? [])
                            .sort((a, b) => a.step_number - b.step_number)
                            .map(step => {
                              const isExpanded = expandedStep === step.id
                              const edits = stepEdits[step.id]
                              const canEdit = step.status !== 'sent' && step.status !== 'skipped'
                              const overdue = step.status === 'pending' && isOverdue(step.scheduled_for)
                              const mins = step.status === 'pending' ? minutesUntil(step.scheduled_for) : null
                              return (
                                <div key={step.id ?? step.step_number} className={`rounded-xl border transition-all ${
                                  step.status === 'sent' ? 'border-green-200 bg-green-50' :
                                  step.status === 'skipped' ? 'border-gray-200 bg-gray-50 opacity-60' :
                                  overdue ? 'border-amber-300 bg-amber-50' :
                                  isExpanded ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white'
                                }`}>
                                  {/* Cabecera del paso */}
                                  <div
                                    className={`flex items-center gap-3 p-3 ${canEdit ? 'cursor-pointer' : ''}`}
                                    onClick={() => canEdit && step.id && handleExpandStep(step)}
                                  >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                      step.status === 'sent' ? 'bg-green-500 text-white' :
                                      step.status === 'skipped' ? 'bg-gray-300 text-white' :
                                      overdue ? 'bg-amber-400 text-white' :
                                      'bg-brand-200 text-brand-700'
                                    }`}>
                                      {step.status === 'sent' ? '✓' : overdue ? '!' : step.step_number}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-800 truncate">{step.subject}</p>
                                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${overdue ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                        {step.status === 'sent' && step.sent_at ? (
                                          <><CheckCircle2 className="w-3 h-3 text-green-500" /> Enviado {formatDateRelative(step.sent_at)}</>
                                        ) : step.status === 'skipped' ? (
                                          <>Omitido</>
                                        ) : overdue ? (
                                          <><AlertTriangle className="w-3 h-3" /> Pendiente desde {formatDateRelative(step.scheduled_for!)}</>
                                        ) : mins !== null && mins > 0 ? (
                                          <><Clock className="w-3 h-3" /> En {mins < 60 ? `${mins} min` : `${Math.round(mins/60)}h`} · {formatDate(step.scheduled_for!)}</>
                                        ) : (
                                          <><CalendarClock className="w-3 h-3" /> {step.scheduled_for ? formatDate(step.scheduled_for) : 'Pendiente'}</>
                                        )}
                                      </p>
                                    </div>
                                    {step.status === 'sent' ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                    ) : overdue ? (
                                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    ) : canEdit ? (
                                      isExpanded
                                        ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                                        : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                    ) : null}
                                  </div>

                                  {/* Editor expandido */}
                                  {isExpanded && edits && (
                                    <div className="px-3 pb-3 space-y-3 border-t border-brand-200 pt-3">
                                      <div>
                                        <label className="label text-xs">Asunto</label>
                                        <input
                                          className="input text-sm"
                                          value={edits.subject}
                                          onChange={e => setStepEdits(prev => ({
                                            ...prev,
                                            [step.id]: { ...prev[step.id], subject: e.target.value }
                                          }))}
                                        />
                                      </div>
                                      <div>
                                        <label className="label text-xs">Cuerpo del email</label>
                                        <textarea
                                          className="input resize-y text-sm"
                                          rows={6}
                                          value={edits.body}
                                          onChange={e => setStepEdits(prev => ({
                                            ...prev,
                                            [step.id]: { ...prev[step.id], body: e.target.value }
                                          }))}
                                        />
                                      </div>
                                      <div>
                                        <label className="label text-xs flex items-center gap-1">
                                          <CalendarClock className="w-3.5 h-3.5" /> Fecha y hora de envío
                                        </label>
                                        <input
                                          type="datetime-local"
                                          className="input text-sm"
                                          value={edits.scheduled_for}
                                          onChange={e => setStepEdits(prev => ({
                                            ...prev,
                                            [step.id]: { ...prev[step.id], scheduled_for: e.target.value }
                                          }))}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                          Deja una fecha pasada para que se envíe en el próximo cron o usa &quot;Enviar ahora&quot;
                                        </p>
                                      </div>
                                      <div className="flex gap-2 pt-1">
                                        <button
                                          onClick={() => setExpandedStep(null)}
                                          className="btn-secondary text-xs py-1.5"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          onClick={() => handleSaveStep(step.id)}
                                          disabled={savingStep === step.id}
                                          className="btn-primary text-xs py-1.5"
                                        >
                                          {savingStep === step.id
                                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                                            : <><Save className="w-3.5 h-3.5" /> Guardar cambios</>
                                          }
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>

                        {/* Nota informativa cron */}
                        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Los emails se envían automáticamente cada día a las 9:00.
                          Usa el botón &quot;Enviar pendientes ahora&quot; para forzar el envío.
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Actividad */}
                {activeTab === 'activity' && (
                  <div className="space-y-0">
                    {activities.length === 0 && <p className="text-sm text-gray-400 py-4">Sin actividad registrada.</p>}
                    {(activities as { id: string; title: string; description?: string; created_at: string }[]).map((act, idx) => (
                      <div key={act.id} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                            <Activity className="w-3 h-3 text-brand-600" />
                          </div>
                          {idx < activities.length - 1 && (
                            <div className="w-px flex-1 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm text-gray-800">{act.title}</p>
                          {act.description && <p className="text-xs text-gray-500">{act.description}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateRelative(act.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modal: Editar lead ─── */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar lead" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Empresa *</label>
              <input className="input" value={editForm.company_name ?? ''} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Nombre de la empresa" />
            </div>
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={editForm.first_name ?? ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Nombre del contacto" />
            </div>
            <div>
              <label className="label">Apellidos</label>
              <input className="input" value={editForm.last_name ?? ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Apellidos" />
            </div>
            <div>
              <label className="label">Departamento</label>
              <input className="input" value={editForm.department ?? ''} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} placeholder="Ej: Marketing, Ventas, Dirección..." />
            </div>
            <div>
              <label className="label">Cargo</label>
              <input className="input" value={editForm.job_title ?? ''} onChange={e => setEditForm(f => ({ ...f, job_title: e.target.value }))} placeholder="Ej: CEO, Brand Manager, Director..." />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="contacto@empresa.com" />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+34 000 000 000" />
            </div>
            <div>
              <label className="label">Web</label>
              <input className="input" value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} placeholder="https://empresa.com" />
            </div>
            <div>
              <label className="label">País</label>
              <input className="input" value={editForm.country ?? ''} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} placeholder="España" />
            </div>
            <div>
              <label className="label">Ciudad</label>
              <input className="input" value={editForm.city ?? ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder="Madrid" />
            </div>
            <div>
              <label className="label">Sector</label>
              <input className="input" value={editForm.sector ?? ''} onChange={e => setEditForm(f => ({ ...f, sector: e.target.value }))} placeholder="Retail, Hostelería..." />
            </div>
            <div className="col-span-2">
              <label className="label">LinkedIn</label>
              <input className="input" value={editForm.linkedin_url ?? ''} onChange={e => setEditForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={editForm.status ?? 'new'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioridad</label>
              <select className="input" value={editForm.priority ?? 'medium'} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Descripción / Notas internas</label>
              <textarea className="input resize-y" rows={3} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción del lead, notas de la empresa..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowEditModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editForm.company_name?.trim()}
              className="btn-primary text-xs"
            >
              {savingEdit ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : <><Save className="w-3.5 h-3.5" /> Guardar cambios</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Generar / Mejorar mensaje */}
      <Modal isOpen={showMessageModal} onClose={() => {
        setShowMessageModal(false)
        setGeneratedMsg(null)
        setImprovedMsg(null)
        setUserDraft('')
        setImproveInstructions('')
      }} title="Mensajes con IA" size="lg">
        <div className="space-y-4">

          {/* Selector de pestañas */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => { setMsgTab('generate'); setGeneratedMsg(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                msgTab === 'generate' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Generar con IA
            </button>
            <button
              onClick={() => { setMsgTab('improve'); setImprovedMsg(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                msgTab === 'improve' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" /> Mejorar mi borrador
            </button>
          </div>

          {/* Idioma */}
          <div>
            <label className="label">Idioma</label>
            <div className="flex gap-1.5">
              {(['es', 'en', 'fr'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setMsgLang(l)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold uppercase tracking-wide transition-all ${
                    msgLang === l
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'
                  }`}
                >
                  {l === 'es' ? '🇪🇸 ES' : l === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
                </button>
              ))}
            </div>
          </div>

          {/* Rol del interlocutor — sobrescribe el departamento del lead para personalizar el ángulo de dolor */}
          <div>
            <label className="label flex items-center gap-1.5">
              Rol del interlocutor
              <span className="text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                (opcional — por defecto usa el del lead)
              </span>
            </label>
            <select
              className="input text-sm"
              value={msgRole}
              onChange={e => setMsgRole(e.target.value)}
            >
              <option value="">— Auto (usar departamento del lead) —</option>
              <option value="marketing">Marketing / Brand Manager</option>
              <option value="executive">C-Level / Director General</option>
              <option value="quality">Calidad / Regulatory Affairs</option>
              <option value="management">Operaciones / Management</option>
              <option value="communication">Comunicación / Brand</option>
              <option value="finance">Finanzas / Control de Gestión</option>
              <option value="it">IT / Sistemas</option>
              <option value="sales">Ventas / Trade Marketing</option>
              <option value="hr">RRHH / Employer Branding</option>
            </select>
          </div>

          {/* Tono (compartido por los dos modos) */}
          <div className={`grid gap-4 ${msgTab === 'generate' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {msgTab === 'generate' && (
              <div>
                <label className="label">Tipo de mensaje</label>
                <select className="input" value={msgType} onChange={e => setMsgType(e.target.value)}>
                  {MESSAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Tono</label>
              <select className="input" value={msgTone} onChange={e => setMsgTone(e.target.value)}>
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Emojis</label>
              <button
                type="button"
                onClick={() => setMsgEmojis(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all w-full ${
                  msgEmojis
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-base">{msgEmojis ? '😊' : '🚫'}</span>
                {msgEmojis ? 'Con emojis' : 'Sin emojis'}
              </button>
            </div>
          </div>

          {/* ── PESTAÑA: GENERAR CON IA ── */}
          {msgTab === 'generate' && (
            <>
              {generatedMsg ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-lg flex items-center gap-1">
                      <Check className="w-3 h-3" /> Mensaje generado — edítalo antes de usar
                    </p>
                    <button
                      onClick={() => handleCopyMsg(
                        (generatedMsg.subject ? `${generatedMsg.subject}\n\n` : '') + generatedMsg.body,
                        setCopiedMsg
                      )}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      {copiedMsg ? <><Check className="w-3 h-3 text-green-500" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                    </button>
                  </div>
                  {generatedMsg.subject && (
                    <div>
                      <label className="label">Asunto</label>
                      <input className="input" value={generatedMsg.subject}
                        onChange={e => setGeneratedMsg(prev => prev ? {...prev, subject: e.target.value} : null)} />
                    </div>
                  )}
                  <div>
                    <label className="label">Cuerpo del mensaje <span className="text-gray-400 font-normal">(editable)</span></label>
                    <Suspense fallback={
                      <textarea className="input resize-y w-full" rows={9} value={generatedMsg.body}
                        onChange={e => setGeneratedMsg(prev => prev ? {...prev, body: e.target.value} : null)} />
                    }>
                      <RichTextEditor
                        value={generatedMsg.body}
                        onChange={body => setGeneratedMsg(prev => prev ? {...prev, body} : null)}
                        placeholder="Cuerpo del mensaje..."
                        minHeight={180}
                      />
                    </Suspense>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={handleGenerateMessage} disabled={generatingMsg} className="btn-secondary text-xs">
                      <Zap className="w-3.5 h-3.5" /> Regenerar
                    </button>
                    {(lead as Record<string, string>).email && (
                      <button
                        onClick={() => {
                          setEmailSubject(generatedMsg.subject || '')
                          setEmailBody(generatedMsg.body)
                          setShowMessageModal(false)
                          setGeneratedMsg(null)
                          setShowSendEmailModal(true)
                        }}
                        className="btn-primary text-xs"
                      >
                        <Send className="w-3.5 h-3.5" /> Enviar email
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-500 mb-4">
                    La IA generará un mensaje personalizado usando el análisis de la empresa.
                    Podrás editarlo antes de enviarlo.
                  </p>
                  <button onClick={handleGenerateMessage} disabled={generatingMsg} className="btn-primary w-full justify-center">
                    {generatingMsg
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando con IA...</>
                      : <><Sparkles className="w-4 h-4" /> Generar mensaje</>
                    }
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── PESTAÑA: MEJORAR BORRADOR ── */}
          {msgTab === 'improve' && (
            <>
              {!improvedMsg ? (
                <div className="space-y-3">
                  <div>
                    <label className="label">Tu borrador <span className="text-gray-400 font-normal">— admite formato, imágenes y enlaces</span></label>
                    <Suspense fallback={
                      <textarea
                        className="input resize-y"
                        rows={7}
                        placeholder="Escribe tu mensaje aquí..."
                        value={userDraft}
                        onChange={e => setUserDraft(e.target.value)}
                      />
                    }>
                      <RichTextEditor
                        value={userDraft}
                        onChange={setUserDraft}
                        placeholder="Escribe tu borrador aquí — la IA lo mejorará manteniendo tu estilo y estructura"
                        minHeight={180}
                      />
                    </Suspense>
                  </div>
                  <div>
                    <label className="label">Instrucciones para la IA <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <input
                      className="input"
                      placeholder="Ej: hazlo más corto, añade un CTA más claro, menciona el packaging..."
                      value={improveInstructions}
                      onChange={e => setImproveInstructions(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleImproveMessage}
                    disabled={improvingMsg || !userDraft.replace(/<[^>]+>/g, '').trim()}
                    className="btn-primary w-full justify-center"
                  >
                    {improvingMsg
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Mejorando con IA...</>
                      : <><Sparkles className="w-4 h-4" /> Mejorar con IA</>
                    }
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Borrador mejorado — edítalo si quieres
                    </p>
                    <button
                      onClick={() => handleCopyMsg(
                        (improvedMsg.subject ? `${improvedMsg.subject}\n\n` : '') + improvedMsg.body,
                        setCopiedImproved
                      )}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      {copiedImproved ? <><Check className="w-3 h-3 text-green-500" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                    </button>
                  </div>
                  {improvedMsg.subject && (
                    <div>
                      <label className="label">Asunto</label>
                      <input className="input" value={improvedMsg.subject}
                        onChange={e => setImprovedMsg(prev => prev ? {...prev, subject: e.target.value} : null)} />
                    </div>
                  )}
                  <div>
                    <label className="label">Mensaje mejorado <span className="text-gray-400 font-normal">(editable — admite imágenes y enlaces)</span></label>
                    <Suspense fallback={
                      <textarea className="input resize-y" rows={9} value={improvedMsg.body}
                        onChange={e => setImprovedMsg(prev => prev ? {...prev, body: e.target.value} : null)} />
                    }>
                      <RichTextEditor
                        value={improvedMsg.body}
                        onChange={v => setImprovedMsg(prev => prev ? {...prev, body: v} : null)}
                        minHeight={220}
                      />
                    </Suspense>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setImprovedMsg(null)} className="btn-secondary text-xs">
                      <Edit2 className="w-3.5 h-3.5" /> Editar borrador
                    </button>
                    <button onClick={handleImproveMessage} disabled={improvingMsg} className="btn-secondary text-xs">
                      <Sparkles className="w-3.5 h-3.5" /> Mejorar de nuevo
                    </button>
                    {(lead as Record<string, string>).email && (
                      <button
                        onClick={() => {
                          setEmailSubject(improvedMsg.subject || '')
                          setEmailBody(improvedMsg.body)
                          setShowMessageModal(false)
                          setImprovedMsg(null)
                          setShowSendEmailModal(true)
                        }}
                        className="btn-primary text-xs"
                      >
                        <Send className="w-3.5 h-3.5" /> Enviar email
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </Modal>

      {/* Modal: Añadir nota */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Añadir nota">
        <div className="space-y-4">
          <div>
            <label className="label">Nota</label>
            <textarea className="input resize-none" rows={4} placeholder="Escribe tu nota aquí..."
              value={noteContent} onChange={e => setNoteContent(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNoteModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleSaveNote} disabled={savingNote || !noteContent.trim()}
              className="btn-primary text-xs">
              {savingNote ? 'Guardando...' : 'Guardar nota'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar borrado */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar lead">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Seguro que quieres eliminar <span className="font-semibold text-gray-900">{lead.company_name as string}</span>?
            Esta acción no se puede deshacer y se borrarán todos sus datos, mensajes y actividad.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowDeleteModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Enviar email */}
      <Modal isOpen={showSendEmailModal} onClose={() => setShowSendEmailModal(false)} title="Enviar email" size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
            ⚠️ Revisa el mensaje antes de enviar. Los emails enviados quedan registrados.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">De (cuenta de envío)</label>
              <select
                className="input text-sm"
                value={emailFromAccount}
                onChange={e => setEmailFromAccount(e.target.value)}
              >
                <option value="guillaume@mymediaconnect.com">Guillaume — MyMediaConnect</option>
                <option value="guillaume@gomymediaconnect.com">Guillaume — MyMediaConnect (gomymediaconnect)</option>
                <option value="guillaume@mymediaconnectgo.com">Guillaume — MyMediaConnect (mymediaconnectgo)</option>
                <option value="guillaume@mymediaconnect.es">Guillaume — MyMediaConnect (mymediaconnect.es)</option>
              </select>
            </div>
            <div>
              <label className="label">Para</label>
              <input className="input bg-gray-50" value={(lead as Record<string, string>).email || ''} readOnly />
            </div>
          </div>
          <div>
            <label className="label">Asunto *</label>
            <input className="input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
              placeholder="Asunto del email" />
          </div>
          <div>
            <label className="label">Mensaje *</label>
            <Suspense fallback={
              <textarea className="input resize-none w-full" rows={8} value={emailBody}
                onChange={e => setEmailBody(e.target.value)} placeholder="Cuerpo del email..." />
            }>
              <RichTextEditor
                value={emailBody}
                onChange={setEmailBody}
                placeholder="Cuerpo del email..."
                minHeight={200}
              />
            </Suspense>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSendEmailModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
              className="btn-primary text-xs"
            >
              <Send className="w-3.5 h-3.5" /> {sendingEmail ? 'Enviando...' : 'Enviar email'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Iniciar secuencia — 2 pasos: info → preview/edición → confirmar */}
      <Modal
        isOpen={showSequenceModal}
        onClose={() => { setShowSequenceModal(false); setSeqModalStep('info'); setPreviewSteps([]) }}
        title={seqModalStep === 'info' ? `Iniciar secuencia ${seqTotalSteps} toques` : `Revisar emails antes de enviar (${seqTotalSteps} toques)`}
        size="lg"
      >
        {seqModalStep === 'info' ? (
          <div className="space-y-4">
            {/* Selector 3 o 5 toques */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Número de toques</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSeqTotalSteps(3)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${seqTotalSteps === 3 ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="text-sm font-bold text-gray-800">3 toques</div>
                  <div className="text-xs text-gray-500 mt-0.5">Días 0 · 5 · 10</div>
                  <div className="text-xs text-brand-600 mt-1">Secuencia estándar</div>
                </button>
                <button
                  onClick={() => setSeqTotalSteps(5)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${seqTotalSteps === 5 ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="text-sm font-bold text-gray-800">5 toques</div>
                  <div className="text-xs text-gray-500 mt-0.5">Días 0 · 4 · 8 · 13 · 18</div>
                  <div className="text-xs text-brand-600 mt-1">Mayor persistencia</div>
                </button>
              </div>
            </div>

            <div key={seqTotalSteps} className="p-4 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-800 space-y-2">
              <p className="font-medium">
                Secuencia de <strong>{seqTotalSteps} toques</strong> — ¿cómo funciona?
              </p>
              <ul className="text-xs space-y-1 text-brand-700">
                {seqTotalSteps === 3 ? (
                  <>
                    <li>📧 <strong>Email 1</strong> — Hoy a las 9:00 (o cuando elijas)</li>
                    <li>📧 <strong>Email 2</strong> — Automático, día 5</li>
                    <li>📧 <strong>Email 3</strong> — Automático, día 10</li>
                  </>
                ) : (
                  <>
                    <li>📧 <strong>Email 1</strong> — Hoy a las 9:00 (o cuando elijas)</li>
                    <li>📧 <strong>Email 2</strong> — Automático, día 4</li>
                    <li>📧 <strong>Email 3</strong> — Automático, día 8</li>
                    <li>📧 <strong>Email 4</strong> — Automático, día 13</li>
                    <li>📧 <strong>Email 5</strong> — Automático, día 18</li>
                  </>
                )}
              </ul>
              <p className="text-xs text-brand-600 mt-2">
                La IA generará los <strong>{seqTotalSteps} emails</strong> personalizados para {(lead as Record<string, string>).company_name}. Podrás revisarlos y editarlos antes de confirmar. Si el lead contesta, la secuencia se pausa automáticamente.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2">
              <div><strong>Destinatario:</strong> {(lead as Record<string, string>).email}</div>
              <div className="flex items-center gap-2 pt-1">
                <label className="font-medium text-gray-700 shrink-0">Idioma de los emails:</label>
                <select
                  value={seqLanguage}
                  onChange={e => setSeqLanguage(e.target.value)}
                  className="input text-xs py-1 px-2 h-7"
                >
                  <option value="es">🇪🇸 Español</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="pt">🇵🇹 Português</option>
                  <option value="nl">🇳🇱 Nederlands</option>
                  <option value="ca">🏴 Català</option>
                  <option value="eu">🏴 Euskera</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowSequenceModal(false); setSeqModalStep('info') }} className="btn-secondary text-xs">Cancelar</button>
              <button
                onClick={handleGeneratePreview}
                disabled={generatingPreview}
                className="btn-primary text-xs"
              >
                {generatingPreview ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando con IA...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Generar y revisar emails</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-800 flex items-start gap-2">
              <span className="text-base">✏️</span>
              <span>Revisa y edita los emails. Puedes ajustar el <strong>asunto, cuerpo y fecha de envío</strong> de cada email. Los {seqTotalSteps} emails se enviarán automáticamente vía cron cuando llegue su fecha.</span>
            </div>

            {/* Lista de emails editables */}
            <div className="space-y-2">
              {previewSteps.map(step => (
                <div key={step.step_number} className={`border rounded-xl overflow-hidden transition-all ${
                  expandedPreviewStep === step.step_number ? 'border-brand-300' : 'border-gray-200'
                }`}>
                  {/* Cabecera del paso */}
                  <button
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedPreviewStep(expandedPreviewStep === step.step_number ? 0 : step.step_number)}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      step.step_number === 1 ? 'bg-green-500 text-white' : 'bg-brand-200 text-brand-700'
                    }`}>
                      {step.step_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-700">{step.label}</p>
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
                    {expandedPreviewStep === step.step_number
                      ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {/* Editor expandido */}
                  {expandedPreviewStep === step.step_number && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-3 bg-gray-50/50">
                      <div>
                        <label className="label text-xs">Asunto</label>
                        <input
                          className="input text-sm"
                          value={step.subject}
                          onChange={e => setPreviewSteps(prev => prev.map(s =>
                            s.step_number === step.step_number ? { ...s, subject: e.target.value } : s
                          ))}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label text-xs">Cuerpo del email</label>
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden text-xs">
                            <button
                              type="button"
                              onClick={() => setPreviewSteps(prev => prev.map(s =>
                                s.step_number === step.step_number ? { ...s, _mode: 'edit' } : s
                              ))}
                              className={`px-2.5 py-1 font-medium transition-colors ${(step as Record<string,unknown>)._mode !== 'preview' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >✏️ Editar</button>
                            <button
                              type="button"
                              onClick={() => setPreviewSteps(prev => prev.map(s =>
                                s.step_number === step.step_number ? { ...s, _mode: 'preview' } : s
                              ))}
                              className={`px-2.5 py-1 font-medium transition-colors ${(step as Record<string,unknown>)._mode === 'preview' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >👁 Preview</button>
                          </div>
                        </div>
                        {(step as Record<string,unknown>)._mode === 'preview' ? (
                          <div
                            className="border border-gray-200 rounded-xl p-4 bg-white text-sm text-gray-800 leading-relaxed min-h-[160px] overflow-auto"
                            style={{ fontFamily: 'sans-serif' }}
                            dangerouslySetInnerHTML={{ __html: step.body || '<p style="color:#9ca3af;font-size:12px;font-style:italic">Sin contenido</p>' }}
                          />
                        ) : (
                          <Suspense fallback={
                            <textarea
                              className="input resize-y text-sm w-full"
                              rows={8}
                              value={step.body}
                              onChange={e => setPreviewSteps(prev => prev.map(s =>
                                s.step_number === step.step_number ? { ...s, body: e.target.value } : s
                              ))}
                            />
                          }>
                            <RichTextEditor
                              value={step.body}
                              onChange={v => setPreviewSteps(prev => prev.map(s =>
                                s.step_number === step.step_number ? { ...s, body: v } : s
                              ))}
                              placeholder="Escribe el cuerpo del email... (puedes añadir enlaces, imágenes y emojis)"
                            />
                          </Suspense>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5" /> Fecha y hora de envío
                        </label>
                        <input
                          type="datetime-local"
                          className="input text-sm"
                          value={step.scheduled_for}
                          onChange={e => setPreviewSteps(prev => prev.map(s =>
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
              ))}
            </div>

            <div className="flex gap-2 justify-between pt-1">
              <button
                onClick={() => { setSeqModalStep('info'); setPreviewSteps([]) }}
                className="btn-secondary text-xs"
              >
                ← Volver
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleGeneratePreview}
                  disabled={generatingPreview}
                  className="btn-secondary text-xs"
                >
                  {generatingPreview ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerando...</> : <><Sparkles className="w-3.5 h-3.5" /> Regenerar</>}
                </button>
                <button
                  onClick={handleLaunchSequence}
                  disabled={launchingSequence}
                  className="btn-primary text-xs"
                >
                  {launchingSequence ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Confirmar y enviar</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
