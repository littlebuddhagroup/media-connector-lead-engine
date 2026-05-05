'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Save, CheckCircle, AlertCircle, Zap, XCircle, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))

const SERVICE_LABELS: Record<string, { label: string; description: string }> = {
  gemini:  { label: 'Google Gemini',   description: 'IA — enriquecimiento y mensajes' },
  groq:    { label: 'Groq',            description: 'IA — alternativa gratuita con Llama 3.3 70B' },
  resend:  { label: 'Resend',          description: 'Envío de emails y tracking de aperturas' },
  serpapi: { label: 'SerpAPI',         description: 'Búsqueda de leads en Google' },
  hunter:  { label: 'Hunter.io',       description: 'Búsqueda de emails verificados por dominio' },
  apollo:  { label: 'Apollo.io',       description: 'Búsqueda de contactos por cargo y sector' },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    email_from_address: '',
    email_from_name: 'Alicia Gómez',
    email_signature: '',
    email_daily_limit: 50,
    ai_model: 'gemini-2.5-flash',
    ai_provider: 'groq' as string,
    sender_email: '' as string,
    default_language: 'es',
    default_tone: 'consultivo',
    scraping_provider: 'serpapi',
  })
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({})
  const [resendFrom, setResendFrom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Gemini test
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [geminiError, setGeminiError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/settings/status').then(r => r.json()),
    ]).then(([settingsJson, statusJson]) => {
      if (settingsJson.data?.settings) {
        const loaded = settingsJson.data.settings
        // Corregir nombre de remitente heredado del valor por defecto antiguo
        if (!loaded.email_from_name || loaded.email_from_name === 'Media Connector') {
          loaded.email_from_name = 'Alicia Gómez'
        }
        setSettings(s => ({ ...s, ...loaded }))
      }
      if (statusJson.data) {
        const { gemini, groq, resend, serpapi, hunter, apollo, resend_from } = statusJson.data
        setServiceStatus({ gemini, groq, resend, serpapi, hunter, apollo })
        setResendFrom(resend_from)
      }
      setLoading(false)
    })
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      if (json.warning) {
        toast.warning('Configuración parcial', json.warning)
      }
    } else {
      toast.error('Error al guardar', json.error || 'Inténtalo de nuevo.')
    }
  }

  const handleTestGemini = async () => {
    setGeminiStatus('loading')
    setGeminiError('')
    const model = settings.ai_model || 'gemini-2.5-flash'
    const res = await fetch(`/api/settings/test-gemini?model=${encodeURIComponent(model)}`)
    const json = await res.json()
    if (json.ok) {
      setGeminiStatus('ok')
    } else {
      setGeminiStatus('error')
      setGeminiError(json.error ?? 'Error desconocido')
    }
  }

  if (loading) return <div className="p-6 text-gray-400">Cargando configuración...</div>

  const allActive = Object.values(serviceStatus).every(Boolean)

  return (
    <div className="animate-fade-in">
      <TopBar title="Configuración" subtitle="Email, IA y parámetros generales" />

      <div className="p-6 max-w-2xl space-y-6">

        {/* Estado de integraciones */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-900">Integraciones activas</h2>
            {allActive
              ? <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Todas activas</span>
              : <span className="ml-auto text-xs text-amber-600 font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Algunas pendientes</span>
            }
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Las claves API están configuradas globalmente para todos los usuarios. No necesitas introducirlas manualmente.
          </p>

          <div className="space-y-2">
            {Object.entries(SERVICE_LABELS).map(([key, { label, description }]) => {
              const active = serviceStatus[key]
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  {active
                    ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {active ? 'Configurado' : 'Sin configurar'}
                  </span>
                </div>
              )
            })}
          </div>

          {!allActive && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <p className="font-medium mb-1">Servicios sin configurar</p>
              <p>Añade las variables de entorno correspondientes en el archivo <code className="bg-amber-100 px-1 rounded">.env.local</code> y reinicia el servidor para activarlas.</p>
            </div>
          )}
        </div>

        {/* Configuración de email */}
        <form onSubmit={handleSaveSettings} className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Email</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Email remitente</label>
                <input
                  className="input"
                  type="email"
                  placeholder={resendFrom || 'leads@tudominio.com'}
                  value={settings.email_from_address}
                  onChange={e => setSettings(s => ({ ...s, email_from_address: e.target.value }))}
                />
                {resendFrom && (
                  <p className="text-xs text-gray-400 mt-1">
                    Por defecto: <span className="font-mono">{resendFrom}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="label">Nombre remitente</label>
                <input
                  className="input"
                  placeholder="Alicia Gómez"
                  value={settings.email_from_name}
                  onChange={e => setSettings(s => ({ ...s, email_from_name: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="label">
                Firma de email
                <span className="ml-1 text-xs text-gray-400 font-normal">— admite imágenes, logos y enlaces</span>
              </label>
              <Suspense fallback={
                <textarea
                  className="input resize-none"
                  rows={4}
                  placeholder="Tu nombre · Tu empresa · www.tuempresa.com"
                  value={settings.email_signature}
                  onChange={e => setSettings(s => ({ ...s, email_signature: e.target.value }))}
                />
              }>
                <RichTextEditor
                  value={settings.email_signature}
                  onChange={v => setSettings(s => ({ ...s, email_signature: v }))}
                  placeholder="Tu nombre · Tu empresa · www.tuempresa.com — puedes añadir logo con el botón de imagen"
                  minHeight={120}
                />
              </Suspense>
              <p className="text-xs text-gray-400 mt-1">
                Se añade automáticamente al final de cada email enviado.
              </p>
            </div>

            <div>
              <label className="label">Límite diario de emails</label>
              <select
                className="input w-48"
                value={settings.email_daily_limit}
                onChange={e => setSettings(s => ({ ...s, email_daily_limit: parseInt(e.target.value) }))}
              >
                {[10, 25, 50, 75, 100, 150, 200, 300, 500].map(n => (
                  <option key={n} value={n}>{n} emails / día</option>
                ))}
                <option value={0}>Sin límite</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Límite de seguridad para evitar bloqueos y caer en spam.
                {settings.email_daily_limit === 0 && (
                  <span className="text-amber-600"> ⚠ Sin límite — úsalo con precaución.</span>
                )}
              </p>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-900 mb-4 mt-6">Inteligencia Artificial</h2>

          {/* Selector de proveedor */}
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
            <label className="label mb-0">Proveedor de IA</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, ai_provider: 'groq' }))}
                className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
                  settings.ai_provider === 'groq'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">Groq</span>
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Gratis</span>
                </div>
                <p className="text-xs text-gray-500">Sin tarjeta. Llama 3.3 70B. Muy rápido.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettings(s => ({ ...s, ai_provider: 'gemini' }))
                  setGeminiStatus('idle')
                }}
                className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
                  settings.ai_provider === 'gemini'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">Google Gemini</span>
                  {geminiStatus === 'ok' && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3" /> Conectado
                    </span>
                  )}
                  {geminiStatus === 'error' && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Error</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Gemini 2.0 Flash. Alta calidad.</p>
              </button>
            </div>

            {/* Test Gemini + Selector de modelo — solo visible cuando está seleccionado */}
            {settings.ai_provider === 'gemini' && (
              <div className="pt-1 space-y-3">
                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={geminiStatus === 'loading'}
                  className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-brand-400 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {geminiStatus === 'loading'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando...</>
                    : <><Zap className="w-3.5 h-3.5 text-brand-500" /> Verificar conexión</>
                  }
                </button>
                {geminiStatus === 'ok' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> API key válida y billing configurado correctamente.
                  </p>
                )}
                {geminiStatus === 'error' && (
                  <p className="text-xs text-red-600">{geminiError}</p>
                )}

                {/* Selector de modelo Gemini */}
                <div>
                  <label className="label mb-2">Modelo Gemini</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'gemini-2.5-flash',   label: 'Gemini 2.5 Flash',   badge: 'Recomendado',  badgeColor: 'bg-brand-100 text-brand-700',   desc: 'El modelo actual de Gemini. Rápido e inteligente.' },
                      { id: 'gemini-1.5-flash',   label: 'Gemini 1.5 Flash',   badge: 'Más estable',  badgeColor: 'bg-green-100 text-green-700',   desc: 'Versión anterior. Sin errores 503. Ideal si hay alta demanda.' },
                      { id: 'gemini-1.5-pro',     label: 'Gemini 1.5 Pro',     badge: 'Estable',      badgeColor: 'bg-green-100 text-green-700',   desc: 'Versión pro anterior. Potente y sin problemas de cuota.' },
                      { id: 'gemini-2.5-pro',     label: 'Gemini 2.5 Pro',     badge: 'Más potente',  badgeColor: 'bg-purple-100 text-purple-700', desc: 'El más capaz. Cuota diaria limitada en plan gratuito.' },
                    ].map(model => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, ai_model: model.id }))}
                        className={`flex flex-col items-start p-2.5 rounded-xl border-2 transition-all text-left ${
                          settings.ai_model === model.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-900">{model.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${model.badgeColor}`}>{model.badge}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-tight">{model.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">
              El proveedor se configura en <code className="bg-gray-100 px-1 rounded">.env.local</code> con <code className="bg-gray-100 px-1 rounded">AI_PROVIDER=groq</code> o <code className="bg-gray-100 px-1 rounded">AI_PROVIDER=gemini</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tono por defecto</label>
              <select
                className="input"
                value={settings.default_tone}
                onChange={e => setSettings(s => ({ ...s, default_tone: e.target.value }))}>
                <option value="consultivo">Consultivo</option>
                <option value="cercano">Cercano</option>
                <option value="formal">Formal</option>
                <option value="tecnico">Técnico</option>
                <option value="directo">Directo</option>
              </select>
            </div>
            <div>
              <label className="label">Idioma por defecto</label>
              <select
                className="input"
                value={settings.default_language}
                onChange={e => setSettings(s => ({ ...s, default_language: e.target.value }))}>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
                <option value="pt">Portugués</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            {saved && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" /> Guardado correctamente
              </div>
            )}
          </div>
        </form>

      </div>
    </div>
  )
}
