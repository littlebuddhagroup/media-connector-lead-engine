'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import {
  Search, Mail, Shield, CheckCircle, XCircle, AlertTriangle,
  Loader2, Copy, Plus, Globe, User, Wrench, HelpCircle
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'

// ============================================================
// HERRAMIENTAS DE PROSPECCIÓN
// Tab 1: Email Finder — busca el email de una persona concreta
// Tab 2: Email Verifier — verifica si uno o varios emails son válidos
// ============================================================

type Tab = 'finder' | 'verifier'

// ─── Email Finder ─────────────────────────────────────────────
interface FinderResult {
  email: string | null
  score: number
  domain: string
  position?: string
  linkedin?: string
  sources: { domain: string; uri: string }[]
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-amber-400' : score >= 50 ? 'bg-orange-400' : 'bg-red-400'
  const label = score >= 90 ? 'Alta' : score >= 70 ? 'Media' : score >= 50 ? 'Baja' : 'Muy baja'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-16">{score}% — {label}</span>
    </div>
  )
}

function FinderTab() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [domain, setDomain] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FinderResult | null>(null)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/hunter/finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, domain, company }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error || 'Error buscando email'); return }
    setResult(json)
  }

  const copyEmail = () => {
    if (!result?.email) return
    navigator.clipboard.writeText(result.email)
    toast.success('Email copiado', result.email)
  }

  return (
    <div className="space-y-6">
      <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-700">
        Introduce el nombre y apellido de una persona junto con el dominio o nombre de su empresa. Hunter buscará su email más probable.
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Juan" value={firstName}
                onChange={e => setFirstName(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Apellido *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="García" value={lastName}
                onChange={e => setLastName(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Dominio web <span className="text-gray-400 font-normal">(más preciso)</span></label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="empresa.com" value={domain}
                onChange={e => setDomain(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Nombre empresa <span className="text-gray-400 font-normal">(alternativo)</span></label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Nombre de la empresa" value={company}
                onChange={e => setCompany(e.target.value)} />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !firstName.trim() || !lastName.trim() || (!domain.trim() && !company.trim())}
          className="btn-primary px-6"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
            : <><Search className="w-4 h-4" /> Buscar email</>
          }
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {result && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {result.email ? (
            <>
              <div className="bg-green-50 border-b border-green-100 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Email encontrado</p>
                    <p className="text-xs text-gray-500">{result.position || 'Cargo no disponible'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-mono font-bold text-green-700">{result.email}</span>
                  <button onClick={copyEmail}
                    className="p-1.5 rounded-lg hover:bg-green-100 text-green-700 transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Confianza de la predicción</p>
                  <ScoreBar score={result.score} />
                </div>
                {result.linkedin && (
                  <a href={result.linkedin} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline block">
                    Ver LinkedIn →
                  </a>
                )}
                {result.sources.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fuentes encontradas ({result.sources.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.sources.slice(0, 5).map((s, i) => (
                        <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full hover:underline">
                          {s.domain}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="px-5 py-8 text-center">
              <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No se encontró email para esta persona en Hunter.</p>
              <p className="text-xs text-gray-400 mt-1">Prueba con el dominio exacto o comprueba el nombre.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Email Verifier ───────────────────────────────────────────
type VerifyStatus = 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'unknown'

interface VerifyResult {
  email: string
  status: VerifyStatus
  score: number
  disposable: boolean
  webmail: boolean
  mx_records: boolean
  smtp_check: boolean
  error?: string
}

const STATUS_CONFIG: Record<VerifyStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  valid:      { label: 'Válido',       icon: <CheckCircle className="w-4 h-4" />,    color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  invalid:    { label: 'Inválido',     icon: <XCircle className="w-4 h-4" />,        color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  accept_all: { label: 'Acepta todo',  icon: <AlertTriangle className="w-4 h-4" />,  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  webmail:    { label: 'Webmail',      icon: <AlertTriangle className="w-4 h-4" />,  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  unknown:    { label: 'Desconocido',  icon: <HelpCircle className="w-4 h-4" />,     color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
}

function VerifierTab() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<VerifyResult[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const emailList = input.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailList.length) return
    setLoading(true)
    setError('')
    setResults([])
    setProgress(0)

    const res = await fetch('/api/hunter/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emailList }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error || 'Error verificando'); return }
    setResults(json.data ?? [])
    setProgress(100)
  }

  const validCount = results.filter(r => r.status === 'valid').length
  const invalidCount = results.filter(r => r.status === 'invalid').length

  return (
    <div className="space-y-6">
      <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-700">
        Pega hasta 20 emails (uno por línea, o separados por comas) para verificar si son válidos antes de enviar tu campaña.
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="label">Emails a verificar</label>
          <textarea
            className="input resize-none font-mono text-sm"
            rows={6}
            placeholder={'juan@empresa.com\npedro@otra.com\ninfo@marca.es'}
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            {emailList.length} email{emailList.length !== 1 ? 's' : ''} detectado{emailList.length !== 1 ? 's' : ''}
            {emailList.length > 20 && <span className="text-red-500 font-medium"> — máximo 20</span>}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || emailList.length === 0 || emailList.length > 20}
          className="btn-primary px-6"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando ({results.length}/{emailList.length})...</>
            : <><Shield className="w-4 h-4" /> Verificar emails</>
          }
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{validCount}</p>
              <p className="text-xs text-gray-500 mt-1">Válidos</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{invalidCount}</p>
              <p className="text-xs text-gray-500 mt-1">Inválidos</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{results.length - validCount - invalidCount}</p>
              <p className="text-xs text-gray-500 mt-1">Inciertos</p>
            </div>
          </div>

          {/* Lista */}
          <div className="card overflow-hidden divide-y divide-gray-50">
            {results.map((r, i) => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.unknown
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} shrink-0`}>
                    {cfg.icon} {cfg.label}
                  </div>
                  <span className="text-sm font-mono text-gray-800 flex-1 truncate">{r.email}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.disposable && (
                      <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">Desechable</span>
                    )}
                    {r.webmail && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Webmail</span>
                    )}
                    <span className={`text-xs font-semibold ${r.score >= 80 ? 'text-green-600' : r.score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {r.score}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => {
              const valid = results.filter(r => r.status === 'valid').map(r => r.email).join('\n')
              navigator.clipboard.writeText(valid)
              toast.success('Copiados', `${validCount} emails válidos copiados al portapapeles`)
            }}
            className="btn-secondary text-xs"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar solo los válidos ({validCount})
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>('finder')

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Herramientas"
        subtitle="Email Finder y Verificador de emails"
      />

      <div className="p-6 max-w-3xl space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setTab('finder')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === 'finder' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search className="w-3.5 h-3.5" /> Email Finder
          </button>
          <button
            onClick={() => setTab('verifier')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === 'verifier' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Verificador de emails
          </button>
        </div>

        <div className="card p-6">
          {tab === 'finder' ? <FinderTab /> : <VerifierTab />}
        </div>
      </div>
    </div>
  )
}
