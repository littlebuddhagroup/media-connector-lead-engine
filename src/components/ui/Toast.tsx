'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

// ─── Singleton store (sin Context para evitar wrapping) ──────────────────────
type Listener = (toasts: ToastData[]) => void
let _toasts: ToastData[] = []
let _listeners: Listener[] = []

function notify() {
  _listeners.forEach(l => l([..._toasts]))
}

export const toast = {
  show(data: Omit<ToastData, 'id'>) {
    const id = Math.random().toString(36).slice(2)
    _toasts = [..._toasts, { id, duration: 5000, ...data }]
    notify()
  },
  success(title: string, message?: string) {
    this.show({ type: 'success', title, message })
  },
  error(title: string, message?: string) {
    this.show({ type: 'error', title, message, duration: 8000 })
  },
  warning(title: string, message?: string) {
    this.show({ type: 'warning', title, message, duration: 7000 })
  },
  info(title: string, message?: string) {
    this.show({ type: 'info', title, message })
  },
  // Helper específico para errores de IA
  aiError(rawError: string) {
    if (rawError.includes('Cuota') || rawError.includes('RESOURCE_EXHAUSTED') || rawError.includes('429')) {
      this.error(
        'Cuota de Gemini agotada',
        'Activa el billing en console.cloud.google.com → Facturación para seguir usando la IA.'
      )
    } else if (rawError.includes('API key') || rawError.includes('403')) {
      this.error('API key inválida', 'Revisa GEMINI_API_KEY en la configuración del servidor.')
    } else {
      this.error('Error de IA', rawError)
    }
  },
  remove(id: string) {
    _toasts = _toasts.filter(t => t.id !== id)
    notify()
  },
}

// ─── Componente Toast individual ─────────────────────────────────────────────
const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />,
  error:   <XCircle    className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
  info:    <Info       className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
}

const BORDERS: Record<ToastType, string> = {
  success: 'border-l-green-500',
  error:   'border-l-red-500',
  warning: 'border-l-amber-500',
  info:    'border-l-blue-500',
}

function ToastItem({ t, onRemove }: { t: ToastData; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, t.duration ?? 5000)
    return () => clearTimeout(timer)
  }, [t.duration, onRemove])

  return (
    <div className={`
      flex items-start gap-3 w-80 bg-white border border-gray-200 border-l-4 ${BORDERS[t.type]}
      rounded-xl shadow-lg p-4 animate-fade-in
    `}>
      {ICONS[t.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{t.title}</p>
        {t.message && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.message}</p>}
      </div>
      <button onClick={onRemove} className="text-gray-400 hover:text-gray-600 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Contenedor global (montar una vez en el layout) ─────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    const listener: Listener = (t) => setToasts(t)
    _listeners.push(listener)
    return () => { _listeners = _listeners.filter(l => l !== listener) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem t={t} onRemove={() => toast.remove(t.id)} />
        </div>
      ))}
    </div>
  )
}
