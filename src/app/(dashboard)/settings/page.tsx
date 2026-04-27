'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Save, CheckCircle, AlertCircle, Zap, XCircle } from 'lucide-react'

const SERVICE_LABELS: Record<string, { label: string; description: string }> = {
  openai:  { label: 'OpenAI (GPT-4)',  description: 'Enriquecimiento IA y generación de mensajes' },
  resend:  { label: 'Resend',          description: 'Envío de emails de outreach' },
  serpapi: { label: 'SerpAPI',         description: 'Búsqueda de leads en Google' },
  hunter:  { label: 'Hunter.io',       description: 'Búsqueda de emails por dominio' },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    email_from_address: '',
    email_from_name: 'Media Connector',
    email_signature: '',
    email_daily_limit: 50,
    ai_model: 'gpt-4o-mini',
    default_language: 'es',
    default_tone: 'consultivo',
    scraping_provider: 'serpapi',
  })
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({})
  const [resendFrom, setResendFrom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/settings/status').then(r => r.json()),
    ]).then(([settingsJson, statusJson]) => {
      if (settingsJson.data?.settings) setSettings(s => ({ ...s, ...settingsJson.data.settings }))
      if (statusJson.data) {
        const { openai, resend, serpapi, hunter, resend_from } = statusJson.data
        setServiceStatus({ openai, resend, serpapi, hunter })
        setResendFrom(resend_from)
      }
      setLoading(false)
    })
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
                  placeholder="Media Connector"
                  value={settings.email_from_name}
                  onChange={e => setSettings(s => ({ ...s, email_from_name: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="label">Firma de email</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Tu nombre&#10;Tu empresa&#10;www.tuempresa.com"
                value={settings.email_signature}
                onChange={e => setSettings(s => ({ ...s, email_signature: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Límite diario de emails</label>
              <input
                className="input w-32"
                type="number"
                min={1}
                max={500}
                value={settings.email_daily_limit}
                onChange={e => setSettings(s => ({ ...s, email_daily_limit: parseInt(e.target.value) }))}
              />
              <p className="text-xs text-gray-400 mt-1">Límite de seguridad para evitar bloqueos</p>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-900 mb-4 mt-6">Inteligencia Artificial</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Modelo OpenAI</label>
              <select
                className="input"
                value={settings.ai_model}
                onChange={e => setSettings(s => ({ ...s, ai_model: e.target.value }))}>
                <option value="gpt-4o-mini">GPT-4o Mini (recomendado)</option>
                <option value="gpt-4o">GPT-4o (mejor calidad)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (económico)</option>
              </select>
            </div>
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
