'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Search, Plus, CheckCircle, ExternalLink, Loader2, User, Globe, Mail, Shield } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import type { Campaign } from '@/types'

interface LeadList {
  id: string
  name: string
  color?: string
  icon?: string
  member_count?: number
}

// ============================================================
// HUNTER.IO — Búsqueda de emails por dominio de empresa
// ============================================================

const DEPARTMENT_OPTIONS = [
  { value: '', label: 'Todos los departamentos' },
  { value: 'executive', label: 'Dirección / Ejecutivos' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Ventas' },
  { value: 'management', label: 'Management' },
  { value: 'communication', label: 'Comunicación' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'hr', label: 'RRHH' },
  { value: 'it', label: 'IT / Tecnología' },
]

const SENIORITY_OPTIONS = [
  { value: '', label: 'Cualquier nivel' },
  { value: 'executive', label: 'Ejecutivo / C-Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'junior', label: 'Junior' },
]

const COUNTRY_OPTIONS = [
  { value: '', label: 'Todos los países' },
  { value: 'es', label: '🇪🇸 España' },
  { value: 'mx', label: '🇲🇽 México' },
  { value: 'ar', label: '🇦🇷 Argentina' },
  { value: 'co', label: '🇨🇴 Colombia' },
  { value: 'cl', label: '🇨🇱 Chile' },
  { value: 'pe', label: '🇵🇪 Perú' },
  { value: 'br', label: '🇧🇷 Brasil' },
  { value: 'fr', label: '🇫🇷 Francia' },
  { value: 'de', label: '🇩🇪 Alemania' },
  { value: 'it', label: '🇮🇹 Italia' },
  { value: 'pt', label: '🇵🇹 Portugal' },
  { value: 'gb', label: '🇬🇧 Reino Unido' },
  { value: 'ie', label: '🇮🇪 Irlanda' },
  { value: 'ch', label: '🇨🇭 Suiza' },
  { value: 'us', label: '🇺🇸 Estados Unidos' },
  { value: 'ca', label: '🇨🇦 Canadá' },
  { value: 'nl', label: '🇳🇱 Países Bajos' },
  { value: 'be', label: '🇧🇪 Bélgica' },
  { value: 'pl', label: '🇵🇱 Polonia' },
]

interface HunterResult {
  company_name: string
  domain: string
  website: string
  contact_name?: string
  contact_title?: string
  contact_email: string
  confidence: number
  department?: string
  seniority?: string
  contact_linkedin?: string
  already_exists: boolean
  added?: boolean
  source?: 'hunter' | 'pdl' | 'apollo'
}

type PillState = 'idle' | 'loading' | 'ok' | 'empty' | 'skipped'

function ServicePill({ label, sublabel, state, detail }: {
  label: string
  sublabel: string
  state: PillState
  detail?: string
}) {
  const configs: Record<PillState, { dot: string; text: string; bg: string; border: string }> = {
    idle:    { dot: 'bg-gray-300',              text: 'text-gray-400',  bg: 'bg-gray-50',   border: 'border-gray-100'  },
    loading: { dot: 'bg-gray-300 animate-pulse', text: 'text-gray-400', bg: 'bg-gray-50',   border: 'border-gray-100'  },
    ok:      { dot: 'bg-green-500',             text: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-100' },
    empty:   { dot: 'bg-amber-400',             text: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-100' },
    skipped: { dot: 'bg-gray-300',              text: 'text-gray-400',  bg: 'bg-gray-50',   border: 'border-gray-100'  },
  }
  const c = configs[state]
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
        <span className="text-[11px] font-semibold text-gray-700 truncate">{label}</span>
      </div>
      <p className="text-[10px] text-gray-400 mb-1 pl-4">{sublabel}</p>
      {detail && <p className={`text-[11px] font-medium pl-4 truncate ${c.text}`}>{detail}</p>}
      {state === 'loading' && <p className="text-[11px] text-gray-400 pl-4">buscando...</p>}
    </div>
  )
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-green-100 text-green-700' :
                score >= 70 ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-500'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${color}`}>
      <Shield className="w-3 h-3" /> {score}%
    </span>
  )
}

export default function HunterPage() {
  const [domain, setDomain] = useState('')
  const [company, setCompany] = useState('')
  const [department, setDepartment] = useState('marketing')
  const [seniority, setSeniority] = useState('')
  const [country, setCountry] = useState('es')
  const [limit, setLimit] = useState(20)
  const [campaignId, setCampaignId] = useState('')
  const [listId, setListId] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [lists, setLists] = useState<LeadList[]>([])

  const [results, setResults] = useState<HunterResult[]>([])
  const [meta, setMeta] = useState<{ organization?: string; domain?: string; pattern?: string } | null>(null)
  const [filteredByCountry, setFilteredByCountry] = useState(false)
  const [resolvedDomain, setResolvedDomain] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<{
    serp: { used: boolean; resolved: string | null }
    hunter: { searched: boolean; count: number }
    pdl: { searched: boolean; count: number }
    apollo: { searched: boolean; count: number }
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addingAll, setAddingAll] = useState(false)
  const [addAllProgress, setAddAllProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  // Auto-enriquecimiento en curso
  const [enrichingLeads, setEnrichingLeads] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/campaigns').then(r => r.json()),
      fetch('/api/lists').then(r => r.json()),
    ]).then(([camps, listsRes]) => {
      setCampaigns(camps.data ?? [])
      setLists(listsRes.data ?? [])
    })
  }, [])

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!domain.trim() && !company.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setMeta(null)
    setSearched(true)
    setResolvedDomain(null)
    setServiceStatus(null)

    const res = await fetch('/api/hunter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, company, department: department || undefined, seniority: seniority || undefined, country: country || undefined, limit }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error || 'Error en la búsqueda'); return }
    setResults(json.data ?? [])
    setMeta(json.meta ?? null)
    setFilteredByCountry(json.country_warning ?? false)
    setResolvedDomain(json.resolved_domain ?? null)
    setServiceStatus(json.service_status ?? null)
  }

  const triggerEnrich = (leadId: string, leadName: string) => {
    setEnrichingLeads(prev => [...prev, { id: leadId, name: leadName }])
    fetch(`/api/leads/${leadId}/enrich`, { method: 'POST' })
      .then(async r => {
        const json = await r.json()
        setEnrichingLeads(prev => prev.filter(l => l.id !== leadId))
        if (r.ok) {
          toast.success('Lead enriquecido', `${leadName} — Score: ${json.data?.score ?? '—'}/100`)
        } else {
          toast.error('Enriquecimiento fallido', json.error ?? 'No se pudo enriquecer el lead')
        }
      })
      .catch(() => {
        setEnrichingLeads(prev => prev.filter(l => l.id !== leadId))
        toast.error('Enriquecimiento fallido', 'Error de conexión')
      })
  }

  const handleAdd = async (result: HunterResult, idx: number) => {
    setAdding(result.contact_email)
    const res = await fetch('/api/hunter', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, campaign_id: campaignId || null, list_id: listId || null }),
    })
    setAdding(null)
    if (res.ok) {
      const json = await res.json()
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, added: true } : r))
      toast.success('Lead añadido', 'Enriqueciendo con IA en segundo plano…')
      if (json.data?.id) triggerEnrich(json.data.id, result.company_name)
    } else {
      const json = await res.json()
      toast.error('Error al añadir', json.error || 'Inténtalo de nuevo.')
    }
  }

  const handleAddAll = async () => {
    const toAdd = results.filter(r => !r.already_exists && !r.added)
    if (!toAdd.length) return
    setAddingAll(true)
    setAddAllProgress({ done: 0, total: toAdd.length })

    const res = await fetch('/api/hunter', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: toAdd, campaign_id: campaignId || null, list_id: listId || null }),
    })
    const json = await res.json()

    setAddingAll(false)
    setAddAllProgress({ done: 0, total: 0 })

    if (!res.ok) {
      toast.error('Error al añadir leads', json.error ?? 'Inténtalo de nuevo.')
      return
    }

    // Marcar todos como añadidos en la UI de una vez
    const addedEmails = new Set(toAdd.map(r => r.contact_email))
    setResults(prev => prev.map(r => addedEmails.has(r.contact_email) ? { ...r, added: true } : r))

    const campaignName = campaigns.find(c => c.id === campaignId)?.name
    const listName = lists.find(l => l.id === listId)?.name
    const msg = json.skipped > 0
      ? `${json.inserted} añadidos · ${json.skipped} ya existían`
      : `${json.inserted} contactos añadidos al CRM`
    const extra = [campaignName && `campaña "${campaignName}"`, listName && `lista "${listName}"`].filter(Boolean).join(' · ')
    toast.success(`${json.inserted} leads añadidos`, extra ? `${msg} — ${extra} · Enriqueciendo con IA…` : `${msg} · Enriqueciendo con IA…`)

    // Auto-enriquecimiento de todos los leads insertados
    if (json.ids?.length) {
      json.ids.forEach((item: { id: string; company_name: string }) => {
        triggerEnrich(item.id, item.company_name)
      })
    }
  }

  const newCount = results.filter(r => !r.already_exists && !r.added).length

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Lead Scout"
        subtitle="Localiza contactos verificados de cualquier empresa por dominio web"
      />

      {/* Banner de auto-enriquecimiento en curso */}
      {enrichingLeads.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 text-sm bg-brand-50 border-b border-brand-100">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-brand-700">
              Enriqueciendo {enrichingLeads.length} lead{enrichingLeads.length > 1 ? 's' : ''} con IA
            </span>
            <span className="ml-2 text-xs text-brand-500">
              {enrichingLeads.map(l => l.name).join(', ')}
            </span>
          </div>
          <div className="w-24 h-1 bg-brand-200 rounded-full overflow-hidden shrink-0">
            <div className="h-full bg-brand-500 rounded-full" style={{ animation: 'progress-indeterminate 1.5s ease-in-out infinite', width: '40%' }} />
          </div>
        </div>
      )}

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Formulario */}
        <div className="card p-5">
          <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-700 mb-5">
            Lead Scout escanea y verifica contactos públicos de cualquier empresa. Introduce el dominio web para obtener emails con score de confianza, combinando múltiples fuentes de datos.
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Dominio web <span className="text-gray-400 font-normal">(más preciso)</span></label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className="input pl-9"
                    placeholder="lactalis.es, nestle.com..."
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label">Nombre empresa <span className="text-gray-400 font-normal">(alternativo)</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className="input pl-9"
                    placeholder="Lactalis, Nestlé España..."
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="label">País</label>
                <select className="input" value={country} onChange={e => setCountry(e.target.value)}>
                  {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Departamento</label>
                <select className="input" value={department} onChange={e => setDepartment(e.target.value)}>
                  {DEPARTMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nivel</label>
                <select className="input" value={seniority} onChange={e => setSeniority(e.target.value)}>
                  {SENIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Resultados</label>
                <select className="input" value={limit} onChange={e => setLimit(Number(e.target.value))}>
                  <option value={10}>10 emails</option>
                  <option value={20}>20 emails</option>
                  <option value={50}>50 emails</option>
                  <option value={100}>100 emails</option>
                  <option value={250}>250 emails</option>
                  <option value={0}>Sin límite</option>
                </select>
              </div>
            </div>

            <div className="flex items-end gap-4 pt-4 border-t border-gray-100 flex-wrap">
              <div>
                <label className="label text-xs">Añadir a campaña</label>
                <select className="input text-sm w-52" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                  <option value="">Sin campaña</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Añadir a lista</label>
                <select className="input text-sm w-52" value={listId} onChange={e => setListId(e.target.value)}>
                  <option value="">Sin lista</option>
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.icon ? `${l.icon} ` : ''}{l.name}{l.member_count ? ` (${l.member_count})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading || (!domain.trim() && !company.trim())}
                className="btn-primary ml-auto text-sm px-6"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
                  : <><Mail className="w-4 h-4" /> Buscar emails</>
                }
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Lead Scout buscando contactos...</p>
          </div>
        )}

        {searched && !loading && results.length === 0 && !error && (
          <div className="card p-8 text-center text-gray-400 text-sm">
            No se encontraron emails para este dominio. Prueba con el nombre de empresa o un dominio diferente.
          </div>
        )}

        {/* Info del patrón de email */}
        {meta?.pattern && (
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <Mail className="w-4 h-4 text-brand-500" />
            <span>Patrón de email detectado en <strong>{meta.organization}</strong>:</span>
            <code className="bg-white border border-gray-200 px-2 py-0.5 rounded text-brand-700 font-mono">{meta.pattern}@{meta.domain}</code>
          </div>
        )}

        {/* Panel de capas de inteligencia */}
        {(searched || loading) && (
          <div className="card px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Capas de inteligencia</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ServicePill
                label="Motor de dominio"
                sublabel="Resolución de empresa"
                state={loading ? 'loading' : !searched ? 'idle' : serviceStatus?.serp.used ? 'ok' : 'skipped'}
                detail={serviceStatus?.serp.resolved ?? undefined}
              />
              <ServicePill
                label="Verificación email"
                sublabel="Emails corporativos"
                state={loading ? 'loading' : !serviceStatus ? 'idle' : serviceStatus.hunter.count > 0 ? 'ok' : serviceStatus.hunter.searched ? 'empty' : 'skipped'}
                detail={serviceStatus ? `${serviceStatus.hunter.count} contactos` : undefined}
              />
              <ServicePill
                label="Perfiles profesionales"
                sublabel="Cargo y departamento"
                state={loading ? 'loading' : !serviceStatus ? 'idle' : serviceStatus.pdl.count > 0 ? 'ok' : serviceStatus.pdl.searched ? 'empty' : 'skipped'}
                detail={serviceStatus?.pdl.searched ? `${serviceStatus.pdl.count} contactos` : 'en espera'}
              />
              <ServicePill
                label="Base de datos B2B"
                sublabel="Decisores y ejecutivos"
                state={loading ? 'loading' : !serviceStatus ? 'idle' : serviceStatus.apollo.count > 0 ? 'ok' : serviceStatus.apollo.searched ? 'empty' : 'skipped'}
                detail={serviceStatus?.apollo.searched ? `${serviceStatus.apollo.count} contactos` : 'en espera'}
              />
            </div>
            {searched && !loading && !filteredByCountry && country && results.length > 0 && (
              <p className="mt-3 text-[11px] text-amber-600 flex items-center gap-1.5">
                <span>⚠️</span>
                Dominio genérico (.com) — pueden aparecer contactos de otras delegaciones. Usa un dominio local para mayor precisión
                {country === 'es' ? ' (ej: empresa.es)' : country === 'gb' ? ' (ej: empresa.co.uk)' : ''}.
              </p>
            )}
          </div>
        )}

        {/* Resultados */}
        {results.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{results.length} emails encontrados</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {results.filter(r => r.confidence >= 90).length} verificados con alta confianza
                  {' · '}{results.filter(r => r.already_exists || r.added).length} ya en el CRM
                  {newCount > 0 && <> · <span className="text-brand-600 font-medium">{newCount} nuevos</span></>}
                </p>
              </div>

              {newCount > 0 && (
                <button
                  onClick={handleAddAll}
                  disabled={addingAll}
                  className="btn-primary text-xs py-2 px-4 shrink-0 flex items-center gap-2"
                >
                  {addingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Añadiendo {addAllProgress.done}/{addAllProgress.total}...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Añadir {newCount} lead{newCount !== 1 ? 's' : ''} al CRM
                      {campaignId && (
                        <span className="bg-white/20 rounded px-1.5 py-0.5 text-xs">+ campaña</span>
                      )}
                      {listId && (
                        <span className="bg-white/20 rounded px-1.5 py-0.5 text-xs">+ lista</span>
                      )}
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Barra de progreso al añadir todos */}
            {addingAll && addAllProgress.total > 0 && (
              <div className="px-5 py-2 bg-brand-50 border-b border-brand-100">
                <div className="flex items-center justify-between text-xs text-brand-700 mb-1">
                  <span>Añadiendo leads{campaignId ? ` a ${campaigns.find(c => c.id === campaignId)?.name ?? 'campaña'}` : ''}...</span>
                  <span>{Math.round((addAllProgress.done / addAllProgress.total) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-brand-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-300"
                    style={{ width: `${(addAllProgress.done / addAllProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${result.already_exists ? 'bg-indigo-50/20 opacity-60' : idx % 2 === 1 ? 'bg-indigo-50/30 hover:bg-indigo-50/60' : 'bg-white hover:bg-indigo-50/40'}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-brand-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {result.contact_name && (
                        <p className="text-sm font-semibold text-gray-900">{result.contact_name}</p>
                      )}
                      {result.contact_title && (
                        <span className="text-xs text-gray-500">{result.contact_title}</span>
                      )}
                      {result.department && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{result.department}</span>
                      )}
                      {result.seniority && (
                        <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full capitalize">{result.seniority}</span>
                      )}
                      {result.already_exists && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Ya en CRM</span>
                      )}
                      {result.added && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Añadido
                        </span>
                      )}
                      {(result.source === 'pdl' || result.source === 'apollo') && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                          {result.source === 'pdl' ? 'PDL' : 'Apollo'}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center flex-wrap gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                        <Mail className="w-3 h-3" />
                        {result.contact_email}
                      </div>
                      <ConfidenceBadge score={result.confidence} />
                      {result.contact_linkedin && (
                        <a href={result.contact_linkedin} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> LinkedIn
                        </a>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-1">{result.company_name} · {result.domain}</p>
                  </div>

                  {!result.already_exists && !result.added && (
                    <button
                      onClick={() => handleAdd(result, idx)}
                      disabled={adding === result.contact_email}
                      className="btn-primary text-xs py-1.5 px-3 shrink-0"
                    >
                      {adding === result.contact_email
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <><Plus className="w-3.5 h-3.5" /> Añadir al CRM</>
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
