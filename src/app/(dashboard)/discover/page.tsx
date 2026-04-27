'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Search, Plus, CheckCircle, AlertCircle, ExternalLink, Telescope, Loader2, Mail, User } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import type { Campaign } from '@/types'

const SEARCH_SUGGESTIONS = [
  'empresas de cerveza España',
  'bodegas vino Rioja',
  'productoras audiovisuales Madrid',
  'agencias de publicidad Barcelona',
  'estudios de arquitectura Valencia',
  'empresas software SaaS España',
  'cadenas de restaurantes España',
  'distribuidoras alimentación España',
  'clínicas dentales Madrid',
  'constructoras inmobiliarias España',
]

const COUNTRIES = [
  { code: 'es', label: 'España' },
  { code: 'mx', label: 'México' },
  { code: 'ar', label: 'Argentina' },
  { code: 'co', label: 'Colombia' },
  { code: 'us', label: 'EE.UU.' },
  { code: 'gb', label: 'Reino Unido' },
  { code: 'fr', label: 'Francia' },
  { code: 'de', label: 'Alemania' },
  { code: 'pt', label: 'Portugal' },
]

interface DiscoverResult {
  company_name: string
  website: string
  domain: string
  description: string
  email?: string
  confidence?: number
  first_name?: string
  last_name?: string
  position?: string
  already_exists: boolean
  added?: boolean
}

export default function DiscoverPage() {
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('es')
  const [num, setNum] = useState(10)
  const [campaignId, setCampaignId] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [results, setResults] = useState<DiscoverResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(j => setCampaigns(j.data ?? []))
  }, [])

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)

    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, country, num }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error || 'Error en la búsqueda'); return }
    setResults(json.data ?? [])
  }

  const handleAdd = async (result: DiscoverResult, idx: number) => {
    setAdding(result.domain)
    const res = await fetch('/api/discover', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: result.company_name,
        website: result.website,
        domain: result.domain,
        description: result.description,
        email: result.email,
        campaign_id: campaignId || null,
      }),
    })
    setAdding(null)
    if (res.ok) {
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, added: true } : r))
      toast.success('Lead añadido', 'La empresa ha sido añadida a tu lista de leads.')
    } else {
      const json = await res.json()
      toast.error('Error al añadir empresa', json.error || 'Inténtalo de nuevo.')
    }
  }

  const handleAddAll = async () => {
    const toAdd = results.filter(r => !r.already_exists && !r.added)
    for (let i = 0; i < toAdd.length; i++) {
      const idx = results.findIndex(r => r.domain === toAdd[i].domain)
      await handleAdd(toAdd[i], idx)
    }
  }

  const withEmail = results.filter(r => r.email).length
  const newCount = results.filter(r => !r.already_exists && !r.added).length

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Búsqueda de emails"
        subtitle="Encuentra emails de contacto de empresas por sector o criterio"
        actions={
          newCount > 0 ? (
            <button onClick={handleAddAll} className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Añadir todos al CRM ({newCount})
            </button>
          ) : undefined
        }
      />

      <div className="p-6 space-y-6">
        {/* Formulario */}
        <div className="card p-5">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9 text-sm"
                  placeholder='Ej: "empresas de cerveza España", "bodegas vino Rioja"...'
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <select className="input w-36 text-sm" value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <select className="input w-32 text-sm" value={num} onChange={e => setNum(Number(e.target.value))}>
                <option value={5}>5 empresas</option>
                <option value={10}>10 empresas</option>
                <option value={20}>20 empresas</option>
              </select>
              <button type="submit" disabled={loading || !query.trim()} className="btn-primary text-sm px-5">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
                  : <><Telescope className="w-4 h-4" /> Buscar</>
                }
              </button>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label className="label text-xs">Añadir resultados a campaña</label>
                <select className="input text-sm w-56" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                  <option value="">Sin campaña</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Sugerencias */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Ejemplos de búsqueda:</p>
              <div className="flex flex-wrap gap-1.5">
                {SEARCH_SUGGESTIONS.map(s => (
                  <button key={s} type="button"
                    onClick={() => setQuery(s)}
                    className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-brand-50 hover:text-brand-700 rounded-full transition-colors text-gray-600">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Info sobre Hunter.io */}
        {!searched && (
          <div className="p-4 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-3 text-sm text-brand-800">
            <Mail className="w-4 h-4 shrink-0 mt-0.5 text-brand-600" />
            <div>
              <p className="font-medium mb-0.5">Búsqueda de emails automática</p>
              <p className="text-xs text-brand-700">
                Para cada empresa encontrada, el sistema intenta localizar automáticamente un email de contacto usando Hunter.io.
                Los resultados con email aparecen marcados en verde.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading && (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Buscando empresas y localizando emails...</p>
            <p className="text-xs text-gray-400 mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}

        {searched && !loading && results.length === 0 && !error && (
          <div className="card p-8 text-center text-gray-400 text-sm">
            No se encontraron resultados. Prueba con otros términos.
          </div>
        )}

        {/* Resultados */}
        {results.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{results.length} empresas encontradas</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="text-green-600 font-medium">{withEmail} con email</span>
                  {' · '}
                  {results.filter(r => r.already_exists).length} ya en el CRM
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {results.map((result, idx) => (
                <div key={idx} className={`flex items-start gap-4 px-5 py-4 transition-colors ${result.already_exists ? 'bg-gray-50/50 opacity-60' : result.email ? 'hover:bg-green-50/30' : 'hover:bg-gray-50/30'}`}>

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${result.email ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <span className={`text-xs font-bold ${result.email ? 'text-green-700' : 'text-gray-500'}`}>
                      {result.company_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{result.company_name}</p>
                      {result.already_exists && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Ya en CRM</span>
                      )}
                      {result.added && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Añadido
                        </span>
                      )}
                    </div>

                    <a href={result.website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                      {result.domain} <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* Email encontrado */}
                    {result.email ? (
                      <div className="mt-2 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">{result.email}</span>
                          {result.confidence && (
                            <span className="text-xs text-gray-400">({result.confidence}% confianza)</span>
                          )}
                        </div>
                        {(result.first_name || result.position) && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <User className="w-3 h-3" />
                            <span>
                              {[result.first_name, result.last_name].filter(Boolean).join(' ')}
                              {result.position && ` · ${result.position}`}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-300" />
                        <span className="text-xs text-gray-400">Email no encontrado</span>
                      </div>
                    )}

                    {result.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{result.description}</p>
                    )}
                  </div>

                  {/* Acción */}
                  {!result.already_exists && !result.added && (
                    <button
                      onClick={() => handleAdd(result, idx)}
                      disabled={adding === result.domain}
                      className={`btn-primary text-xs py-1.5 px-3 shrink-0 ${result.email ? '' : 'btn-secondary'}`}
                    >
                      {adding === result.domain
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
