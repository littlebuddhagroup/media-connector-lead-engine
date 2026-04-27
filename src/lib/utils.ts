import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(new Date(date))
}

export function formatDateRelative(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes}m`
  if (hours < 24) return `Hace ${hours}h`
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return formatDate(date)
}

export function extractDomain(url?: string): string {
  if (!url) return ''
  try {
    const u = url.startsWith('http') ? url : `https://${url}`
    return new URL(u).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export function scoreToColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-500'
}

export function scoreToBg(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-800'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-700'
}

export function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
  }
  return map[priority] ?? priority
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Nuevo',
    enriched: 'Enriquecido',
    pending_review: 'Pendiente revisión',
    approved: 'Aprobado',
    contacted: 'Contactado',
    replied: 'Respondido',
    interested: 'Interesado',
    not_interested: 'No interesado',
    meeting_scheduled: 'Reunión agendada',
    closed: 'Cerrado',
    discarded: 'Descartado',
    // campaigns
    draft: 'Borrador',
    active: 'Activa',
    paused: 'Pausada',
    finished: 'Finalizada',
  }
  return map[status] ?? status
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    new: 'bg-gray-100 text-gray-700',
    enriched: 'bg-blue-100 text-blue-700',
    pending_review: 'bg-orange-100 text-orange-700',
    approved: 'bg-indigo-100 text-indigo-700',
    contacted: 'bg-purple-100 text-purple-700',
    replied: 'bg-cyan-100 text-cyan-700',
    interested: 'bg-green-100 text-green-800',
    not_interested: 'bg-red-100 text-red-700',
    meeting_scheduled: 'bg-emerald-100 text-emerald-800',
    closed: 'bg-green-200 text-green-900',
    discarded: 'bg-gray-200 text-gray-500',
    // campaigns
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    finished: 'bg-blue-100 text-blue-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  }
  return map[priority] ?? 'bg-gray-100 text-gray-600'
}

export function truncate(str: string, maxLength = 80): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function parseKeywords(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
}
