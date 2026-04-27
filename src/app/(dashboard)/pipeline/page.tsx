'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Loader2, Mail, Star, GripVertical } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import Link from 'next/link'

// ============================================================
// PIPELINE KANBAN — Gestión visual de estados de leads
// ============================================================

interface PipelineLead {
  id: string
  company_name: string
  email?: string
  sector?: string
  country?: string
  status: string
  priority: string
  score: number
  website?: string
  updated_at: string
}

interface Column {
  id: string
  label: string
  color: string
  bgColor: string
  borderColor: string
  textColor: string
  dotColor: string
}

const COLUMNS: Column[] = [
  { id: 'new',              label: 'Nuevos',       color: 'gray',   bgColor: 'bg-gray-50',    borderColor: 'border-gray-200', textColor: 'text-gray-700',   dotColor: 'bg-gray-400' },
  { id: 'contacted',        label: 'Contactados',  color: 'blue',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200', textColor: 'text-blue-700',   dotColor: 'bg-blue-500' },
  { id: 'interested',       label: 'Interesados',  color: 'amber',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-200',textColor: 'text-amber-700',  dotColor: 'bg-amber-500' },
  { id: 'meeting_scheduled',label: 'Demo / Reunión',color: 'purple', bgColor: 'bg-purple-50',  borderColor: 'border-purple-200',textColor: 'text-purple-700', dotColor: 'bg-purple-500' },
  { id: 'closed',           label: 'Cerrados',     color: 'green',  bgColor: 'bg-green-50',   borderColor: 'border-green-200',textColor: 'text-green-700',  dotColor: 'bg-green-500' },
]

const PRIORITY_STARS: Record<string, number> = { high: 3, medium: 2, low: 1 }

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-gray-300'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-6 text-right">{score}</span>
    </div>
  )
}

function LeadCard({
  lead,
  onDragStart,
}: {
  lead: PipelineLead
  onDragStart: (e: React.DragEvent, lead: PipelineLead) => void
}) {
  const stars = PRIORITY_STARS[lead.priority] ?? 1

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, lead)}
      className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0 group-hover:text-gray-400 transition-colors" />
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <Link
              href={`/leads/${lead.id}`}
              className="text-sm font-semibold text-gray-900 hover:text-brand-600 truncate transition-colors"
              onClick={e => e.stopPropagation()}
            >
              {lead.company_name}
            </Link>
            <div className="flex shrink-0">
              {Array.from({ length: stars }).map((_, i) => (
                <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
              ))}
            </div>
          </div>

          {/* Email */}
          {lead.email && (
            <div className="flex items-center gap-1 mb-1.5">
              <Mail className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 truncate">{lead.email}</span>
            </div>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {lead.sector && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
                {lead.sector}
              </span>
            )}
            {lead.country && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {lead.country.toUpperCase()}
              </span>
            )}
          </div>

          {/* Score bar */}
          <ScoreBar score={lead.score} />
        </div>
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<PipelineLead[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedLead, setDraggedLead] = useState<PipelineLead | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leads/pipeline')
      .then(r => r.json())
      .then(j => {
        setLeads(j.data ?? [])
        setLoading(false)
      })
  }, [])

  const handleDragStart = (e: React.DragEvent, lead: PipelineLead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedLead || draggedLead.status === columnId) {
      setDraggedLead(null)
      return
    }

    // Optimistic update
    const prevLeads = leads
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status: columnId } : l))
    setUpdating(draggedLead.id)

    try {
      const res = await fetch('/api/leads/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: draggedLead.id, status: columnId }),
      })
      if (!res.ok) {
        setLeads(prevLeads)
        toast.error('Error al mover lead', 'No se pudo actualizar el estado. Inténtalo de nuevo.')
      }
    } catch {
      setLeads(prevLeads)
      toast.error('Error de conexión', 'Comprueba tu conexión a internet.')
    } finally {
      setUpdating(null)
      setDraggedLead(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedLead(null)
    setDragOverColumn(null)
  }

  const totalLeads = leads.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <TopBar
        title="Pipeline de ventas"
        subtitle={`${totalLeads} leads activos · Arrastra las tarjetas para cambiar el estado`}
      />

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full" style={{ minWidth: `${COLUMNS.length * 280}px` }}>
          {COLUMNS.map(col => {
            const colLeads = leads.filter(l => l.status === col.id)
            const isDragOver = dragOverColumn === col.id

            return (
              <div
                key={col.id}
                className="flex flex-col flex-1 min-w-[260px] max-w-[320px]"
                onDragOver={e => handleDragOver(e, col.id)}
                onDrop={e => handleDrop(e, col.id)}
                onDragLeave={() => setDragOverColumn(null)}
              >
                {/* Column Header */}
                <div className={`rounded-xl border-2 p-3 mb-3 transition-all ${isDragOver ? `${col.bgColor} ${col.borderColor}` : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <span className={`text-sm font-semibold ${isDragOver ? col.textColor : 'text-gray-700'}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDragOver ? `${col.bgColor} ${col.textColor}` : 'bg-gray-100 text-gray-500'}`}>
                      {colLeads.length}
                    </span>
                  </div>
                </div>

                {/* Drop Zone */}
                <div
                  className={`flex-1 rounded-xl transition-all space-y-2 min-h-[200px] p-2 ${isDragOver ? `${col.bgColor} border-2 border-dashed ${col.borderColor}` : 'bg-gray-50/50 border-2 border-transparent'}`}
                >
                  {colLeads.length === 0 && (
                    <div className={`flex items-center justify-center h-20 text-xs ${isDragOver ? col.textColor : 'text-gray-300'}`}>
                      {isDragOver ? 'Soltar aquí' : 'Sin leads'}
                    </div>
                  )}

                  {colLeads.map(lead => (
                    <div
                      key={lead.id}
                      className={`transition-opacity ${updating === lead.id ? 'opacity-50' : 'opacity-100'} ${draggedLead?.id === lead.id ? 'opacity-40' : ''}`}
                    >
                      <LeadCard lead={lead} onDragStart={handleDragStart} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 pb-4 flex items-center gap-4 text-xs text-gray-400">
        <GripVertical className="w-3.5 h-3.5" />
        <span>Arrastra las tarjetas entre columnas para actualizar el estado del lead</span>
        <span>·</span>
        <span>★★★ Alta prioridad &nbsp; ★★ Media &nbsp; ★ Baja</span>
      </div>
    </div>
  )
}
