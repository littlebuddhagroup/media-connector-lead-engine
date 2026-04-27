'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { parseKeywords } from '@/lib/utils'

const SECTORS = [
  'Medios de comunicación', 'Publicidad y marketing', 'Tecnología', 'Entretenimiento',
  'Educación', 'Salud', 'Retail', 'Finanzas', 'Hostelería', 'Inmobiliaria',
  'Consultoría', 'Manufactura', 'Logística', 'Energía', 'Otro'
]

export default function NewCampaignPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', country: '', sector: '',
    language: 'es', keywords: '', target_type: '',
    target_size: '', status: 'draft' as const,
  })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        keywords: form.keywords ? parseKeywords(form.keywords) : [],
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Error creando campaña'); setLoading(false); return }
    router.push(`/campaigns/${json.data.id}`)
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Nueva campaña"
        actions={
          <Link href="/campaigns" className="btn-secondary text-xs py-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Link>
        }
      />

      <div className="p-6 max-w-2xl">
        <div className="card p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="label">Nombre de campaña *</label>
                <input className="input" placeholder="Ej: Agencias medios España Q1 2025"
                  value={form.name} onChange={set('name')} required />
              </div>

              <div className="sm:col-span-2">
                <label className="label">Descripción</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Objetivo de esta campaña..."
                  value={form.description} onChange={set('description')} />
              </div>

              <div>
                <label className="label">País</label>
                <input className="input" placeholder="España, México, Argentina..."
                  value={form.country} onChange={set('country')} />
              </div>

              <div>
                <label className="label">Sector</label>
                <select className="input" value={form.sector} onChange={set('sector')}>
                  <option value="">Seleccionar sector</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Idioma</label>
                <select className="input" value={form.language} onChange={set('language')}>
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                  <option value="pt">Portugués</option>
                  <option value="fr">Francés</option>
                </select>
              </div>

              <div>
                <label className="label">Estado inicial</label>
                <select className="input" value={form.status} onChange={set('status')}>
                  <option value="draft">Borrador</option>
                  <option value="active">Activa</option>
                </select>
              </div>

              <div>
                <label className="label">Tipo de empresa objetivo</label>
                <input className="input" placeholder="Ej: Agencia, Productora, SaaS..."
                  value={form.target_type} onChange={set('target_type')} />
              </div>

              <div>
                <label className="label">Tamaño de empresa</label>
                <select className="input" value={form.target_size} onChange={set('target_size')}>
                  <option value="">Cualquier tamaño</option>
                  <option value="1-10">1-10 empleados</option>
                  <option value="11-50">11-50 empleados</option>
                  <option value="51-200">51-200 empleados</option>
                  <option value="201-500">201-500 empleados</option>
                  <option value="500+">+500 empleados</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label">Palabras clave (separadas por coma)</label>
                <input className="input"
                  placeholder="media connector, integración, automatización, DAM, CMS..."
                  value={form.keywords} onChange={set('keywords')} />
                <p className="text-xs text-gray-400 mt-1">Para búsquedas de leads y generación de mensajes</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading} className="btn-primary">
                <Save className="w-4 h-4" /> {loading ? 'Creando...' : 'Crear campaña'}
              </button>
              <Link href="/campaigns" className="btn-secondary">Cancelar</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
