'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import {
  Brain, Mail, Search, Shield, TrendingUp, Loader2,
  CheckCircle2, Clock, Zap, Database,
  RefreshCw, AlertCircle, BellRing, TriangleAlert, Rocket, ExternalLink, Map,
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SignalEvent {
  id: string
  title: string
  description: string
  created_at: string
  lead_id?: string
}

interface PenetrationEntry {
  sector: string
  country: string
  count: number
  highCount: number
}

interface SistemaData {
  stats: {
    totalLeads: number
    enrichedLeads: number
    activeSequences: number
    emailsSent30d: number
    autoProspected: number
  }
  lastRun: Record<string, string | null>
  recentActivity: { id: string; type: string; title: string; description: string; created_at: string }[]
  signalEvents: SignalEvent[]
  // Monitores clasificados
  recallSignals: SignalEvent[]
  productLaunchSignals: SignalEvent[]
  // Mapa de penetración
  penetrationData: PenetrationEntry[]
}

type ModuleKey = 'enrichment' | 'sequences' | 'briefing' | 'prospecting' | 'signals'

// ─── Module definitions ───────────────────────────────────────────────────────
const MODULES = [
  {
    key: 'enrichment' as ModuleKey,
    icon: Database,
    name: 'Auto-enriquecimiento de leads',
    tagline: 'Cada lead, listo antes de que lo abras',
    description:
      'En el momento en que se añade un lead al CRM — por importación, Email Radar o manualmente — el sistema analiza su web, LinkedIn y noticias para calcular el ICP score y detectar si gestiona flujos de packaging complejos. Cuando llegas a ese lead, ya está preparado.',
    badge: 'Sin configuración · activo desde el primer lead',
    cadence: 'Inmediato al crear un lead',
    color: '#6366f1',
  },
  {
    key: 'sequences' as ModuleKey,
    icon: Mail,
    name: 'Secuencias automatizadas',
    tagline: 'Outreach personalizado sin intervención manual',
    description:
      'Envía secuencias de 3 toques personalizadas a tus leads. Pausa automáticamente la secuencia en el momento en que detecta una respuesta, para no enviar mensajes fuera de contexto a un lead que ya ha contestado.',
    badge: 'Pausa automática por respuesta · sin intervención',
    cadence: 'Cada hora',
    color: '#0ea5e9',
  },
  {
    key: 'briefing' as ModuleKey,
    icon: Zap,
    name: 'Briefing ejecutivo diario',
    tagline: 'Tu agenda comercial esperándote a las 8:00',
    description:
      'Cada mañana recibes un email con todo lo que necesitas saber: stats del CRM, secuencias activas, emails abiertos en las últimas 24h y los leads prioritarios del día. Llegas a la primera reunión ya informado, sin abrir la app.',
    badge: 'Configurable · destinatarios en Ajustes',
    cadence: 'Diario · 08:00',
    color: '#f59e0b',
  },
  {
    key: 'prospecting' as ModuleKey,
    icon: Search,
    name: 'Prospecting autónomo semanal',
    tagline: 'El lunes tienes leads nuevos sin haber hecho nada',
    description:
      'Cada lunes a las 7:00, el sistema lee los parámetros de tus campañas activas y busca nuevos Packaging Managers, Artwork Managers y Quality Directors en Apollo. Los añade directamente al CRM, asignados a la campaña correcta.',
    badge: 'Activo por campaña · sectores FMCG, Pharma, Cosmética',
    cadence: 'Semanal · lunes 07:00',
    color: '#10b981',
  },
  {
    key: 'signals' as ModuleKey,
    icon: TrendingUp,
    name: 'Detector de señales de compra',
    tagline: 'Sabe cuándo contactar antes de que ellos lo busquen',
    description:
      'Cada día monitoriza tus leads activos buscando eventos de alto valor: nueva contratación de Packaging Manager, lanzamiento de SKU, expansión geográfica, ronda de inversión o recall de etiquetado. Cuando detecta una señal, sube el score y te envía alerta con el ángulo de contacto exacto.',
    badge: 'Alerta por email · urgencia crítica/alta/media',
    cadence: 'Diario · 06:00',
    color: '#ef4444',
  },
  {
    key: 'signals' as ModuleKey,  // reuse signals key for display — no toggle
    icon: Shield,
    name: 'Guardián de entregabilidad',
    tagline: 'Tus emails llegan. Siempre.',
    description:
      'Monitoriza en tiempo real la tasa de rebotes, quejas de spam y salud del dominio remitente. Si detecta una anomalía — demasiados rebotes consecutivos o patrones que comprometen la reputación — pausa los envíos afectados y te alerta antes de que el daño sea irreversible.',
    badge: 'Protección continua · sin configuración',
    cadence: 'Continuo · análisis tras cada envío',
    color: '#8b5cf6',
  },
]

const ACTIVITY_LABELS: Record<string, { label: string; color: string }> = {
  auto_enriched:         { label: 'Enriquecido',       color: '#6366f1' },
  auto_prospected:       { label: 'Prospectado',       color: '#10b981' },
  signal_detected:       { label: 'Señal detectada',   color: '#ef4444' },
  sequence_paused_reply: { label: 'Secuencia pausada', color: '#f59e0b' },
  briefing_sent:         { label: 'Briefing enviado',  color: '#6366f1' },
  email_sent:            { label: 'Email enviado',     color: '#94a3b8' },
  lead_created:          { label: 'Lead creado',       color: '#64748b' },
  sequence_launched:     { label: 'Secuencia activa',  color: '#22d3ee' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

type ModuleStates = Record<ModuleKey, boolean>
type SavingStates = Record<ModuleKey, boolean>

const DEFAULT_STATES: ModuleStates = {
  enrichment: true, sequences: true, briefing: true,
  prospecting: true, signals: true,
}

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ enabled, onChange, saving }: { enabled: boolean; onChange: (v: boolean) => void; saving: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); !saving && onChange(!enabled) }}
      disabled={saving}
      className="relative shrink-0 transition-opacity"
      style={{ opacity: saving ? 0.6 : 1 }}
    >
      <div
        className="w-10 h-5 rounded-full transition-colors duration-200 relative"
        style={{ backgroundColor: enabled ? '#6366f1' : '#d1d5db' }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: enabled ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </div>
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SistemaPage() {
  const [data, setData] = useState<SistemaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [moduleStates, setModuleStates] = useState<ModuleStates>(DEFAULT_STATES)
  const [saving, setSaving] = useState<SavingStates>({
    enrichment: false, sequences: false, briefing: false, prospecting: false, signals: false,
  })

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const [sistemaRes, settingsRes] = await Promise.all([
        fetch('/api/sistema'),
        fetch('/api/settings'),
      ])
      const sistemaJson = await sistemaRes.json()
      const settingsJson = await settingsRes.json()
      setData(sistemaJson)
      const modules = settingsJson.data?.settings?.intelligence_modules
      if (modules) setModuleStates(prev => ({ ...prev, ...modules }))
    } catch {
      // silencioso
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const toggleModule = async (key: ModuleKey, value: boolean) => {
    const previous = moduleStates[key]
    setModuleStates(prev => ({ ...prev, [key]: value }))
    setSaving(prev => ({ ...prev, [key]: true }))
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intelligence_modules: { ...moduleStates, [key]: value } }),
    })
    setSaving(prev => ({ ...prev, [key]: false }))
    if (!res.ok) {
      setModuleStates(prev => ({ ...prev, [key]: previous }))
      toast.error('No se pudo guardar', 'Los cambios han sido revertidos.')
    }
  }

  const activeCount = Object.values(moduleStates).filter(Boolean).length
  const stats = data?.stats

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Inteligencia"
        subtitle="Módulos autónomos que trabajan en segundo plano mientras tú cierras"
      />

      {/* ── Hero banner ──────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden mx-6 mt-6 rounded-2xl p-8"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, #818cf8 0%, transparent 70%)' }} />

        <div className="relative z-10 flex items-start justify-between gap-6">
          <div className="space-y-4 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-400/30 bg-indigo-900/40 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" style={{ animation: 'dotPulse 2s ease-in-out infinite' }} />
              <span className="text-indigo-300 text-xs font-medium tracking-widest uppercase">
                MyMediaConnect Intelligence · {activeCount}/5 activos
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white leading-tight">
                Tu pipeline trabaja<br />
                <span style={{ color: '#818cf8' }}>mientras tú duermes.</span>
              </h2>
              <p className="mt-3 text-indigo-200 text-sm leading-relaxed">
                Cinco módulos autónomos: enriquecimiento IA, secuencias de outreach, briefing diario,
                prospecting semanal y detector de señales en tiempo real.
                Todos en segundo plano, todos sincronizados con tu CRM.
              </p>
            </div>

            {/* Stats en vivo */}
            {loading ? (
              <div className="flex items-center gap-2 text-indigo-300 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos...
              </div>
            ) : (
              <div className="flex items-center gap-4 pt-1 flex-wrap">
                {[
                  { label: 'Leads CRM',      value: stats?.totalLeads ?? 0     },
                  { label: 'Enriquecidos',   value: stats?.enrichedLeads ?? 0  },
                  { label: 'Secuencias',     value: stats?.activeSequences ?? 0 },
                  { label: 'Emails 30d',     value: stats?.emailsSent30d ?? 0  },
                  { label: 'Prospectados',   value: stats?.autoProspected ?? 0 },
                ].map((s, i, arr) => (
                  <div key={s.label} className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{s.value}</p>
                      <p className="text-xs text-indigo-300 uppercase tracking-wider">{s.label}</p>
                    </div>
                    {i < arr.length - 1 && <div className="w-px h-8 bg-indigo-700" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Refresh + módulos icono */}
          <div className="hidden md:flex flex-col items-end gap-3 shrink-0">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <div className="grid grid-cols-3 gap-2">
              {MODULES.slice(0, 5).map((m, i) => (
                <div key={i} className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: moduleStates[m.key] ? `${m.color}1a` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${moduleStates[m.key] ? m.color + '40' : 'rgba(255,255,255,0.1)'}`,
                    opacity: moduleStates[m.key] ? 1 : 0.4,
                  }}>
                  <m.icon className="w-4 h-4" style={{ color: moduleStates[m.key] ? m.color : '#6b7280' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo ─────────────────────────────────────────────────────────────── */}
      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Módulos (col 1-2) */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map((mod, idx) => {
            const isInfoOnly = mod.name === 'Guardián de entregabilidad'
            const enabled = isInfoOnly ? true : moduleStates[mod.key]
            const isSaving = isInfoOnly ? false : saving[mod.key]

            return (
              <div
                key={idx}
                className="card p-5 space-y-3 relative overflow-hidden transition-all hover:shadow-md"
                style={{ opacity: enabled ? 1 : 0.55, transition: 'opacity 0.25s ease' }}
              >
                {/* Línea superior de color */}
                <div className="absolute top-0 left-0 right-0 h-0.5"
                  style={{ background: enabled ? mod.color : 'transparent', transition: 'background 0.3s' }} />

                {/* Cabecera */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${mod.color}1a` }}>
                      <mod.icon className="w-4 h-4" style={{ color: mod.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{mod.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 italic">{mod.tagline}</p>
                    </div>
                  </div>
                  {!isInfoOnly && (
                    <div className="flex items-center gap-2 shrink-0">
                      {isSaving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                      <Toggle enabled={enabled} onChange={v => toggleModule(mod.key, v)} saving={isSaving} />
                    </div>
                  )}
                </div>

                {/* Descripción */}
                <p className="text-xs text-gray-500 leading-relaxed">{mod.description}</p>

                {/* Badge + cadencia */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                    style={{ color: mod.color, borderColor: mod.color + '40', background: mod.color + '0d' }}>
                    {mod.badge}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {mod.cadence}
                    {!isInfoOnly && data?.lastRun[mod.key] && (
                      <span className="ml-1 text-gray-300">· {timeAgo(data.lastRun[mod.key]!)}</span>
                    )}
                  </div>
                </div>

                {/* Estado */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {enabled ? (
                    <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-xs text-gray-400">Activo</span></>
                  ) : (
                    <><AlertCircle className="w-3 h-3 text-gray-300" /><span className="text-xs text-gray-400">Pausado · Inactivo</span></>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Panel derecho (col 3) */}
        <div className="space-y-4">

          {/* ── Monitor de Retiradas — señales compliance/recall ─────────────── */}
          {/* Filtra automáticamente las señales de tipo "compliance_issue" del cron */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <TriangleAlert className="w-3.5 h-3.5 text-red-500" /> Monitor de Retiradas
              </h3>
              {data?.recallSignals?.length ? (
                <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full font-semibold">
                  {data.recallSignals.length} alerta{data.recallSignals.length !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
              Detecta retiradas de producto, errores de etiquetado y alertas regulatorias entre tus leads.
              Un recall reciente es la ventana de venta más potente — actúa antes que la competencia.
            </p>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : !data?.recallSignals?.length ? (
              <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Sin alertas de retiradas detectadas recientemente.
              </div>
            ) : (
              <div className="space-y-3">
                {data.recallSignals.map(ev => (
                  <div key={ev.id} className="pb-3 border-b border-red-50 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800 leading-tight flex-1">
                        {ev.title.replace('🎯 Signal at ', '').replace(': Regulatory or labelling compliance issue', '')}
                      </p>
                      {ev.lead_id && (
                        <a href={`/leads/${ev.lead_id}`} className="shrink-0 text-brand-400 hover:text-brand-600">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {ev.description && (
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{ev.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] text-red-400 font-semibold uppercase tracking-wide">⚠️ Compliance</span>
                      <span className="text-[9px] text-gray-300">· {timeAgo(ev.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Monitor de Nuevos Lanzamientos — señales product_launch ────────── */}
          {/* Filtra señales de tipo "product_launch" / "Nueva gama" del cron */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5 text-indigo-500" /> Nuevos Lanzamientos
              </h3>
              {data?.productLaunchSignals?.length ? (
                <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full font-semibold">
                  {data.productLaunchSignals.length} señal{data.productLaunchSignals.length !== 1 ? 'es' : ''}
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
              Detecta cuando un lead lanza un nuevo producto o expande su gama de SKUs.
              Un lanzamiento significa artes nuevos, nuevas aprobaciones — y una necesidad real de MMC.
            </p>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : !data?.productLaunchSignals?.length ? (
              <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                <Clock className="w-4 h-4 text-gray-300 shrink-0" />
                Sin señales de lanzamiento detectadas recientemente.
              </div>
            ) : (
              <div className="space-y-3">
                {data.productLaunchSignals.map(ev => (
                  <div key={ev.id} className="pb-3 border-b border-indigo-50 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800 leading-tight flex-1">
                        {ev.title.replace('🎯 Signal at ', '').replace(': New product or SKU expansion', '')}
                      </p>
                      {ev.lead_id && (
                        <a href={`/leads/${ev.lead_id}`} className="shrink-0 text-brand-400 hover:text-brand-600">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {ev.description && (
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{ev.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wide">🚀 Lanzamiento</span>
                      <span className="text-[9px] text-gray-300">· {timeAgo(ev.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Señales generales ──────────────────────────────────────────────── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-red-500" /> Otras señales detectadas
              </h3>
              {data?.signalEvents?.length ? (
                <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full font-semibold">
                  {data.signalEvents.length} nueva{data.signalEvents.length !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : !data?.signalEvents?.length ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin señales recientes detectadas.</p>
            ) : (
              <div className="space-y-3">
                {data.signalEvents.map(ev => (
                  <div key={ev.id} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{ev.title}</p>
                    {ev.description && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{ev.description}</p>}
                    <p className="text-[9px] text-gray-300 mt-1">{timeAgo(ev.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actividad reciente */}
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Actividad autónoma
            </h3>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : !data?.recentActivity?.length ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin actividad reciente. Los módulos aún no han ejecutado.</p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {data.recentActivity.map(ev => {
                  const meta = ACTIVITY_LABELS[ev.type] ?? { label: ev.type, color: '#94a3b8' }
                  return (
                    <div key={ev.id} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: meta.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="text-[10px] text-gray-700 truncate">{ev.title}</span>
                        </div>
                        {ev.description && (
                          <p className="text-[9px] text-gray-400 mt-0.5 truncate">{ev.description}</p>
                        )}
                        <p className="text-[9px] text-gray-300 mt-0.5">{timeAgo(ev.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Mapa de Penetración por Sector ─────────────────────────────────── */}
      {/* Visualiza la distribución de leads por sector x país como una matriz */}
      {/* Permite identificar sectores saturados vs. sin explotar en el pipeline */}
      <div className="px-6 pb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Map className="w-4 h-4 text-brand-500" />
                Mapa de Penetración por Sector
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Distribución de leads en el CRM por sector e industria — identifica dónde has penetrado más y dónde queda mercado
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : !data?.penetrationData?.length ? (
            <div className="text-center py-8 text-xs text-gray-400">
              <Map className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Sin datos de sector disponibles. Enriquece tus leads para poblar el mapa.</p>
            </div>
          ) : (() => {
            // Calcular el máximo para la escala visual
            const maxCount = Math.max(...data.penetrationData.map(e => e.count))

            // Agrupar por sector para el sumario lateral
            const bySector: Record<string, { count: number; highCount: number; countries: string[] }> = {}
            for (const e of data.penetrationData) {
              if (!bySector[e.sector]) bySector[e.sector] = { count: 0, highCount: 0, countries: [] }
              bySector[e.sector].count += e.count
              bySector[e.sector].highCount += e.highCount
              if (!bySector[e.sector].countries.includes(e.country)) {
                bySector[e.sector].countries.push(e.country)
              }
            }
            const topSectors = Object.entries(bySector)
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 8)

            return (
              <div className="grid lg:grid-cols-3 gap-6">

                {/* Barras por sector — columna principal */}
                <div className="lg:col-span-2 space-y-3">
                  {topSectors.map(([sector, info]) => {
                    const pct = Math.round((info.count / maxCount) * 100)
                    const highPct = info.count > 0 ? Math.round((info.highCount / info.count) * 100) : 0
                    const barColor = pct >= 70 ? '#6366f1' : pct >= 40 ? '#f59e0b' : '#10b981'
                    return (
                      <div key={sector}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs font-semibold text-gray-800 truncate">{sector}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {info.countries.slice(0, 3).join(' · ')}
                              {info.countries.length > 3 && ` +${info.countries.length - 3}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {highPct > 0 && (
                              <span className="text-[9px] font-semibold text-indigo-500">
                                {highPct}% alta prioridad
                              </span>
                            )}
                            <span className="text-xs font-bold text-gray-700">{info.count}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full relative" style={{ width: `${pct}%`, background: barColor }}>
                            {/* Indicador de alta prioridad superpuesto */}
                            {highPct > 0 && (
                              <div
                                className="absolute right-0 top-0 bottom-0 rounded-r-full"
                                style={{ width: `${highPct}%`, background: 'rgba(255,255,255,0.35)' }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Tabla sector × país — columna derecha */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    Top combinaciones sector/país
                  </p>
                  <div className="space-y-1.5">
                    {data.penetrationData.slice(0, 8).map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-700 truncate">{e.sector}</p>
                          <p className="text-[10px] text-gray-400">{e.country}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {e.highCount > 0 && (
                            <span className="text-[9px] text-indigo-500 font-semibold">{e.highCount}★</span>
                          )}
                          <span className="text-xs font-bold text-gray-800 min-w-[20px] text-right">{e.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-300 mt-3">
                    ★ leads de alta prioridad · Actualizado en tiempo real
                  </p>
                </div>

              </div>
            )
          })()}
        </div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
