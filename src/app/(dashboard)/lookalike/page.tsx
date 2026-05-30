'use client'

// ============================================================
// LOOKALIKE PROSPECTING — /lookalike
//
// Dado un lead de referencia del CRM o una empresa/sector
// introducidos manualmente, encuentra empresas con el mismo
// perfil ICP (sector FMCG/pharma/cosmética, packaging, multi-SKU)
// usando 3 queries SerpAPI en paralelo.
//
// Flujo:
//   1. Usuario introduce empresa de referencia o elige sector
//   2. SerpAPI busca empresas similares con 3 ángulos distintos
//   3. Hunter.io busca emails para los resultados
//   4. Resultados se muestran priorizando los que tienen email
//   5. Con un click el usuario añade el lead al CRM
// ============================================================

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import {
  GitFork, Search, Loader2, Plus, CheckCircle, Mail, Globe,
  Building2, Info, Sparkles, AlertCircle,
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import type { Campaign } from '@/types'

// Sectores ICP más relevantes para MMC
const ICP_SECTORS = [
  'Alimentación y bebidas FMCG',
  'Pharma y parafarmacia OTC',
  'Cosmética y cuidado personal',
  'Retail y marca del distribuidor',
  'Vinos y licores',
  'Lácteos y frescos',
  'Snacks y confitería',
  'Productos de limpieza',
  'Bebidas refrescantes',
  'Suplementos y nutrición',
  'Electrónica de consumo',
  'Mascotas (pet care)',
]

const COUNTRIES = [
  { code: 'es', label: '🇪🇸 España'         },
  { code: 'fr', label: '🇫🇷 Francia'         },
  { code: 'de', label: '🇩🇪 Alemania'        },
  { code: 'it', label: '🇮🇹 Italia'          },
  { code: 'pt', label: '🇵🇹 Portugal'        },
  { code: 'gb', label: '🇬🇧 Reino Unido'     },
  { code: 'mx', label: '🇲🇽 México'          },
  { code: 'co', label: '🇨🇴 Colombia'        },
  { code: 'ar', label: '🇦🇷 Argentina'       },
  { code: 'us', label: '🇺🇸 Estados Unidos'  },
  { code: 'be', label: '🇧🇪 Bélgica'         },
  { code: 'nl', label: '🇳🇱 Países Bajos'    },
]

interface LookalikeLead {
  company_name: string
  website?: string
  domain?: string
  description?: string
  email?: string | null
  email_confidence?: number | null
  added?: boolean
}

interface ReferenceInfo {
  name?: string
  sector?: string
  country: string
}

export default function LookalikePage() {
  // ── Formulario de búsqueda ──
  const [refCompany, setRefCompany]   = useState('')
  const [refSector, setRefSector]     = useState('')
  const [country, setCountry]         = useState('es')
  const [num, setNum]                 = useState(8)
  const [campaignId, setCampaignId]   = useState('')
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])

  // ── Estado de búsqueda ──
  const [loading, setLoading]         = useState(false)
  const [results, setResults]         = useState<LookalikeLead[]>([])
  const [reference, setReference]     = useState<ReferenceInfo | null>(null)
  const [searched, setSearched]       = useState(false)
  const [error, setError]             = useState('')
  const [adding, setAdding]           = useState<string | null>(null)

  // Cargar campañas para poder asignar leads
  useEffect(() => {
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(j => setCampaigns(j.data ?? []))
      .catch(() => {})
  }, [])

  // ── Ejecutar búsqueda lookalike ──
  const handleSearch = async () => {
    if (!refCompany.trim() && !refSector.trim()) {
      setError('Introduce al menos el nombre de la empresa de referencia o un sector.')
      return
    }
    setLoading(true)
    setError('')
    setResults([])
    setSearched(false)

    try {
      const res = await fetch('/api/lookalike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: refCompany.trim() || undefined,
          sector: refSector.trim() || undefined,
          country,
          num,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al buscar lookalikes')
      setResults(json.data ?? [])
      setReference(json.reference)
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // ── Añadir un resultado como lead al CRM ──
  const handleAddLead = async (result: LookalikeLead) => {
    const key = result.domain ?? result.company_name
    setAdding(key)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: result.company_name,
          website: result.website,
          domain: result.domain,
          email: result.email,
          description: result.description,
          campaign_id: campaignId || undefined,
          source: 'lookalike',
        }),
      })
      if (res.ok) {
        setResults(prev =>
          prev.map(r => (r.domain ?? r.company_name) === key ? { ...r, added: true } : r)
        )
        toast.success('Lead añadido', `${result.company_name} se ha añadido al CRM.`)
      } else {
        const json = await res.json()
        toast.error('Error', json.error ?? 'No se pudo añadir el lead.')
      }
    } finally {
      setAdding(null)
    }
  }

  const hasEmail = results.filter(r => r.email).length
  const noEmail  = results.filter(r => !r.email).length

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Lookalike Prospecting"
        subtitle="Encuentra empresas con el mismo perfil ICP que tu mejor cliente"
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6">

        {/* ── Panel de búsqueda ── */}
        <div className="card p-5 space-y-4">

          {/* Explicación breve */}
          <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-700 leading-relaxed">
              Introduce una empresa de referencia de tu cartera o simplemente un sector.
              El motor buscará empresas con el mismo perfil ICP (packaging, FMCG, pharma, retail),
              priorizando las que tienen email disponible.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Empresa de referencia */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                Empresa de referencia
                <span className="text-[10px] font-normal text-gray-400 normal-case">(opcional)</span>
              </label>
              <input
                className="input"
                placeholder="ej. Florette, Danone, Insud Pharma..."
                value={refCompany}
                onChange={e => setRefCompany(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Sector */}
            <div>
              <label className="label flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-gray-400" />
                Sector objetivo
                <span className="text-[10px] font-normal text-gray-400 normal-case">(opcional)</span>
              </label>
              <select
                className="input"
                value={refSector}
                onChange={e => setRefSector(e.target.value)}
              >
                <option value="">— Seleccionar sector ICP —</option>
                {ICP_SECTORS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* País */}
            <div>
              <label className="label">País</label>
              <select className="input" value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Nº de resultados */}
            <div>
              <label className="label">Resultados</label>
              <select className="input" value={num} onChange={e => setNum(Number(e.target.value))}>
                <option value={6}>6 empresas</option>
                <option value={8}>8 empresas</option>
                <option value={12}>12 empresas</option>
                <option value={16}>16 empresas</option>
              </select>
            </div>

            {/* Campaña */}
            <div>
              <label className="label">Añadir a campaña</label>
              <select className="input" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                <option value="">Sin campaña</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading || (!refCompany.trim() && !refSector.trim())}
            className="btn-primary w-full sm:w-auto"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Buscando lookalikes...</>
            ) : (
              <><Search className="w-4 h-4" /> Buscar empresas similares</>
            )}
          </button>
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Analizando mercado…</p>
                <p className="text-xs text-gray-400">Ejecutando 3 búsquedas en paralelo + verificación de emails</p>
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* ── Resultados ── */}
        {searched && !loading && (
          <div className="space-y-4">
            {/* Header de resultados */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {results.length} empresas similares encontradas
                  {reference?.name && <span className="font-normal text-gray-500"> a <span className="font-semibold">{reference.name}</span></span>}
                  {reference?.sector && !reference.name && <span className="font-normal text-gray-500"> en <span className="font-semibold">{reference.sector}</span></span>}
                </h3>
                {(hasEmail > 0 || noEmail > 0) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="text-green-600 font-medium">{hasEmail} con email</span>
                    {noEmail > 0 && <> · {noEmail} sin email</>}
                  </p>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <div className="card p-8 text-center text-gray-400">
                <Info className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No se encontraron resultados. Prueba con un sector diferente o amplía la búsqueda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((result, i) => {
                  const key = result.domain ?? result.company_name
                  const isAdding = adding === key
                  return (
                    <div
                      key={i}
                      className={`card p-4 flex items-start gap-4 transition-all ${result.added ? 'opacity-60' : ''}`}
                    >
                      {/* Logo/inicial */}
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-50 to-indigo-100 flex items-center justify-center shrink-0 border border-indigo-100">
                        <span className="text-sm font-bold text-brand-700">
                          {result.company_name[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{result.company_name}</span>
                          {result.email && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                              <Mail className="w-2.5 h-2.5" />
                              Email disponible
                              {result.email_confidence != null && (
                                <span className="text-green-500 ml-0.5">{result.email_confidence}%</span>
                              )}
                            </span>
                          )}
                        </div>
                        {result.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {result.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {result.email && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-green-500" />
                              {result.email}
                            </span>
                          )}
                          {result.website && (
                            <a
                              href={result.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand-500 hover:underline flex items-center gap-1"
                            >
                              <Globe className="w-3 h-3" />
                              {result.domain ?? result.website}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Acción */}
                      <div className="shrink-0">
                        {result.added ? (
                          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                            <CheckCircle className="w-4 h-4" /> Añadido
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddLead(result)}
                            disabled={isAdding}
                            className="btn-primary text-xs py-1.5"
                          >
                            {isAdding ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <><Plus className="w-3.5 h-3.5" /> Añadir al CRM</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Estado vacío inicial ── */}
        {!searched && !loading && (
          <div className="card p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
              <GitFork className="w-7 h-7 text-brand-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Encuentra tu próximo cliente ideal</h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
              Introduce una empresa de referencia (como Florette o Calidad Pascual) o elige
              un sector ICP para descubrir empresas con el mismo perfil de packaging y artwork.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
