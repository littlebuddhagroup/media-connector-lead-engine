'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Search, Plus, CheckCircle, ExternalLink, Loader2, User, Building2, Briefcase, Globe } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import type { Campaign } from '@/types'

// ============================================================
// APOLLO.IO — Búsqueda de contactos por cargo y sector
// ============================================================

// Apollo indexa mejor los cargos en inglés
const JOB_TITLE_PRESETS = [
  'Marketing Director',
  'Brand Manager',
  'Marketing Manager',
  'Head of Marketing',
  'Chief Marketing Officer',
  'Brand Director',
  'Packaging Manager',
  'Marketing Communications Manager',
  'Product Marketing Manager',
  'Director of Communications',
]

// Apollo acepta estas como q_organization_keyword_tags (keywords de empresa)
const INDUSTRY_PRESETS = [
  'food and beverage',
  'consumer goods',
  'cosmetics',
  'pharmaceuticals',
  'retail',
  'fashion',
  'health wellness',
  'packaging',
  'beverages',
  'FMCG',
  'beauty',
  'nutrition',
]

const COUNTRY_PRESETS = [
  { label: 'España', value: 'Spain' },
  { label: 'México', value: 'Mexico' },
  { label: 'Argentina', value: 'Argentina' },
  { label: 'Colombia', value: 'Colombia' },
  { label: 'Francia', value: 'France' },
  { label: 'Italia', value: 'Italy' },
  { label: 'Portugal', value: 'Portugal' },
]

interface ApolloResult {
  company_name: string
  domain?: string
  website?: string
  sector?: string
  country?: string
  contact_name?: string
  contact_title?: string
  contact_email?: string
  contact_linkedin?: string
  already_exists: boolean
  added?: boolean
}

function MultiTag({
  values,
  suggestions,
  placeholder,
  onChange,
}: {
  values: string[]
  suggestions: string[]
  placeholder: string
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')
  const filteredSuggestions = suggestions.filter(
    s => !values.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  )

  const add = (val: string) => {
    const trimmed = val.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 text-xs bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-brand-900 font-bold">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
        />
        {input.trim() && (
          <button onClick={() => add(input)} className="btn-secondary text-xs px-3">Añadir</button>
        )}
      </div>
      {input && filteredSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {filteredSuggestions.slice(0, 6).map(s => (
            <button
              key={s}
              onClick={() => add(s)}
              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-brand-50 hover:text-brand-700 rounded-full transition-colors text-gray-600"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      {!input && suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-400 mb-1.5">Sugerencias rápidas:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.filter(s => !values.includes(s)).slice(0, 8).map(s => (
              <button
                key={s}
                onClick={() => add(s)}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-brand-50 hover:text-brand-700 rounded-full transition-colors text-gray-600"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApolloPage() {
  const [jobTitles, setJobTitles] = useState<string[]>(['Marketing Director', 'Brand Manager'])
  const [industries, setIndustries] = useState<string[]>(['food and beverage', 'consumer goods'])
  const [countries, setCountries] = useState<string[]>(['Spain'])
  const [perPage, setPerPage] = useState(20)
  const [campaignId, setCampaignId] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [results, setResults] = useState<ApolloResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(j => setCampaigns(j.data ?? []))
  }, [])

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)

    const res = await fetch('/api/apollo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_titles: jobTitles,
        industries,
        countries,
        per_page: perPage,
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error || 'Error en la búsqueda'); return }
    setResults(json.data ?? [])
    setTotal(json.total ?? json.data?.length ?? 0)
  }

  const handleAdd = async (result: ApolloResult, idx: number) => {
    const key = result.contact_email ?? result.domain ?? String(idx)
    setAdding(key)
    const res = await fetch('/api/apollo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, campaign_id: campaignId || null }),
    })
    setAdding(null)
    if (res.ok) {
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, added: true } : r))
      toast.success('Lead añadido', 'El contacto ha sido añadido a tu lista de leads.')
    } else {
      const json = await res.json()
      toast.error('Error al añadir contacto', json.error || 'Inténtalo de nuevo.')
    }
  }

  const handleAddAll = async () => {
    const toAdd = results.filter(r => !r.already_exists && !r.added)
    for (let i = 0; i < toAdd.length; i++) {
      const idx = results.findIndex(r => (r.contact_email ?? r.domain) === (toAdd[i].contact_email ?? toAdd[i].domain))
      await handleAdd(toAdd[i], idx)
    }
  }

  const newCount = results.filter(r => !r.already_exists && !r.added).length
  const withEmail = results.filter(r => r.contact_email).length

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Apollo.io — Contactos"
        subtitle="Encuentra directores de marketing y brand managers por sector"
        actions={
          newCount > 0 ? (
            <button onClick={handleAddAll} className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Añadir todos ({newCount})
            </button>
          ) : undefined
        }
      />

      <div className="p-6 space-y-6">
        {/* Formulario */}
        <div className="card p-5 space-y-5">
          <form onSubmit={handleSearch}>
            {/* Cargos */}
            <div className="mb-4">
              <label className="label mb-2 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Cargos a buscar
              </label>
              <MultiTag
                values={jobTitles}
                suggestions={JOB_TITLE_PRESETS}
                placeholder='Ej: "Director de Marketing"'
                onChange={setJobTitles}
              />
            </div>

            {/* Sectores */}
            <div className="mb-4">
              <label className="label mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Sectores / Industrias
              </label>
              <MultiTag
                values={industries}
                suggestions={INDUSTRY_PRESETS}
                placeholder='Ej: "Food & Beverages"'
                onChange={setIndustries}
              />
            </div>

            {/* Países */}
            <div className="mb-5">
              <label className="label mb-2 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Países
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {COUNTRY_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      if (countries.includes(c.value)) {
                        setCountries(countries.filter(x => x !== c.value))
                      } else {
                        setCountries([...countries, c.value])
                      }
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      countries.includes(c.value)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opciones adicionales */}
            <div className="flex items-end gap-4 pt-4 border-t border-gray-100">
              <div>
                <label className="label text-xs">Resultados</label>
                <select className="input text-sm w-36" value={perPage} onChange={e => setPerPage(Number(e.target.value))}>
                  <option value={10}>10 contactos</option>
                  <option value={20}>20 contactos</option>
                  <option value={50}>50 contactos</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Añadir a campaña</label>
                <select className="input text-sm w-56" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                  <option value="">Sin campaña</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading || (jobTitles.length === 0 && industries.length === 0)}
                className="btn-primary ml-auto text-sm px-6"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
                  : <><Search className="w-4 h-4" /> Buscar contactos</>
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
            <p className="text-sm text-gray-500">Buscando en Apollo.io...</p>
            <p className="text-xs text-gray-400 mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}

        {searched && !loading && results.length === 0 && !error && (
          <div className="card p-8 text-center text-gray-400 text-sm">
            No se encontraron contactos. Prueba con otros criterios.
          </div>
        )}

        {/* Resultados */}
        {results.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{results.length} contactos encontrados</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="text-green-600 font-medium">{withEmail} con email</span>
                  {' · '}
                  {results.filter(r => r.already_exists).length} ya en el CRM
                  {total > results.length && ` · ${total} resultados totales en Apollo`}
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${result.already_exists ? 'bg-gray-50/50 opacity-60' : 'hover:bg-gray-50/30'}`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-brand-600" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{result.company_name}</p>
                      {result.sector && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{result.sector}</span>
                      )}
                      {result.already_exists && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Ya en CRM</span>
                      )}
                      {result.added && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Añadido
                        </span>
                      )}
                    </div>

                    {result.website && (
                      <a href={result.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                        {result.domain} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Contacto */}
                    <div className="mt-2 flex items-center flex-wrap gap-4">
                      {result.contact_name && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-700">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="font-medium">{result.contact_name}</span>
                          {result.contact_title && <span className="text-gray-400">· {result.contact_title}</span>}
                        </div>
                      )}
                      {result.contact_email && (
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <span className="font-medium">✉ {result.contact_email}</span>
                        </div>
                      )}
                      {result.contact_linkedin && (
                        <a
                          href={result.contact_linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Acción */}
                  {!result.already_exists && !result.added && (
                    <button
                      onClick={() => handleAdd(result, idx)}
                      disabled={adding === (result.contact_email ?? result.domain ?? String(idx))}
                      className="btn-primary text-xs py-1.5 px-3 shrink-0"
                    >
                      {adding === (result.contact_email ?? result.domain ?? String(idx))
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
