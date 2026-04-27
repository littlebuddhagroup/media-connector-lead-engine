'use client'

import { useState, useEffect, use } from 'react'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import {
  ArrowLeft, Globe, Mail, Phone, Linkedin, Zap, MessageSquare,
  Send, StickyNote, CheckSquare, Activity, Star, Edit2, ExternalLink
} from 'lucide-react'
import {
  statusLabel, statusColor, priorityColor, scoreToBg,
  formatDate, formatDateRelative
} from '@/lib/utils'
import Modal from '@/components/ui/Modal'

const STATUSES = [
  'new','enriched','pending_review','approved','contacted',
  'replied','interested','not_interested','meeting_scheduled','closed','discarded'
]

const MESSAGE_TYPES = [
  { value: 'initial_email', label: 'Email inicial' },
  { value: 'followup_1', label: 'Follow-up 1' },
  { value: 'followup_2', label: 'Follow-up 2' },
  { value: 'linkedin_message', label: 'Mensaje LinkedIn' },
  { value: 'internal_summary', label: 'Resumen interno' },
]

const TONES = [
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'cercano', label: 'Cercano' },
  { value: 'formal', label: 'Formal' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'directo', label: 'Directo' },
]

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [lead, setLead] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [activeTab, setActiveTab] = useState<'info'|'messages'|'emails'|'notes'|'tasks'|'activity'>('info')

  // Modals
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showSendEmailModal, setShowSendEmailModal] = useState(false)

  // Generate message form
  const [msgType, setMsgType] = useState('initial_email')
  const [msgTone, setMsgTone] = useState('consultivo')
  const [generatingMsg, setGeneratingMsg] = useState(false)
  const [generatedMsg, setGeneratedMsg] = useState<{subject?: string; body: string} | null>(null)

  // Note form
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Email send form
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const fetchLead = async () => {
    const res = await fetch(`/api/leads/${id}`)
    const json = await res.json()
    setLead(json.data)
    setLoading(false)
  }

  useEffect(() => { fetchLead() }, [id])

  const handleEnrich = async () => {
    setEnriching(true)
    const res = await fetch(`/api/leads/${id}/enrich`, { method: 'POST' })
    setEnriching(false)
    if (res.ok) fetchLead()
    else {
      const json = await res.json()
      alert(json.error)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchLead()
  }

  const handleGenerateMessage = async () => {
    setGeneratingMsg(true)
    setGeneratedMsg(null)
    const res = await fetch('/api/messages/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id, type: msgType, tone: msgTone }),
    })
    setGeneratingMsg(false)
    if (res.ok) {
      const json = await res.json()
      setGeneratedMsg({ subject: json.data.subject, body: json.data.body })
      fetchLead()
    } else {
      const json = await res.json()
      alert(json.error)
    }
  }

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return
    setSavingNote(true)
    const supabase = await import('@/lib/supabase/client').then(m => m.createClient())
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/leads/' + id, { method: 'GET' }) // just to get lead
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: id, content: noteContent }),
    })
    setSavingNote(false)
    setNoteContent('')
    setShowNoteModal(false)
    fetchLead()
  }

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSendingEmail(true)
    const res = await fetch('/api/emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: id,
        to_email: (lead as Record<string, string>)?.email,
        subject: emailSubject,
        email_body: emailBody,
        campaign_id: (lead as Record<string, string>)?.campaign_id,
      }),
    })
    setSendingEmail(false)
    if (res.ok) {
      setShowSendEmailModal(false)
      setEmailSubject('')
      setEmailBody('')
      fetchLead()
    } else {
      const json = await res.json()
      alert(json.error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full py-20 text-gray-400">Cargando...</div>
  }

  if (!lead) return <div className="p-6 text-red-500">Lead no encontrado.</div>

  const enrichment = (lead.enrichment as unknown[])?.[0] as Record<string, unknown> | undefined
  const messages = (lead.messages as unknown[]) ?? []
  const emails = (lead.emails as unknown[]) ?? []
  const notes = (lead.notes as unknown[]) ?? []
  const tasks = (lead.tasks as unknown[]) ?? []
  const activities = (lead.activity_logs as unknown[]) ?? []

  const tabs = [
    { id: 'info', label: 'Análisis IA', count: enrichment ? 1 : 0 },
    { id: 'messages', label: 'Mensajes', count: messages.length },
    { id: 'emails', label: 'Emails', count: emails.length },
    { id: 'notes', label: 'Notas', count: notes.length },
    { id: 'tasks', label: 'Tareas', count: tasks.length },
    { id: 'activity', label: 'Actividad', count: activities.length },
  ] as const

  return (
    <div className="animate-fade-in">
      <TopBar
        title={lead.company_name as string}
        subtitle={(lead as Record<string, {name: string}>).campaign?.name ?? 'Sin campaña'}
        actions={
          <div className="flex gap-2">
            <Link href="/leads" className="btn-secondary text-xs py-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Leads
            </Link>
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="btn-primary text-xs py-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              {enriching ? 'Analizando...' : lead.is_enriched ? 'Re-enriquecer' : 'Enriquecer con IA'}
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Panel izquierdo: datos del lead */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{lead.company_name as string}</h2>
                  {(lead as Record<string, string>).sector && (
                    <p className="text-xs text-gray-500">{(lead as Record<string, string>).sector}</p>
                  )}
                </div>
                <span className={`badge font-bold text-sm ${scoreToBg(lead.score as number)}`}>
                  {lead.score as number}
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                {(lead as Record<string, string>).website && (
                  <a href={(lead as Record<string, string>).website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-brand-600 hover:text-brand-700">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span className="truncate">{(lead as Record<string, string>).domain || (lead as Record<string, string>).website}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
                {(lead as Record<string, string>).email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4 shrink-0 text-gray-400" />
                    <span className="truncate">{(lead as Record<string, string>).email}</span>
                  </div>
                )}
                {(lead as Record<string, string>).phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>{(lead as Record<string, string>).phone}</span>
                  </div>
                )}
                {(lead as Record<string, string>).linkedin_url && (
                  <a href={(lead as Record<string, string>).linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                    <Linkedin className="w-4 h-4 shrink-0" />
                    <span>LinkedIn</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
                {((lead as Record<string, string>).country || (lead as Record<string, string>).city) && (
                  <p className="text-gray-500">
                    📍 {[(lead as Record<string, string>).city, (lead as Record<string, string>).country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Estado</span>
                  <select
                    className="text-xs font-medium border-0 bg-transparent cursor-pointer focus:outline-none"
                    value={lead.status as string}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Prioridad</span>
                  <span className={`badge ${priorityColor(lead.priority as string)}`}>
                    {lead.priority as string}
                  </span>
                </div>
                {(lead as Record<string, string>).source && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Origen</span>
                    <span className="text-xs text-gray-600">{(lead as Record<string, string>).source}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Acciones</p>
              <button onClick={() => setShowMessageModal(true)}
                className="btn-secondary w-full justify-start text-xs">
                <MessageSquare className="w-4 h-4" /> Generar mensaje
              </button>
              {(lead as Record<string, string>).email && (
                <button onClick={() => setShowSendEmailModal(true)}
                  className="btn-secondary w-full justify-start text-xs">
                  <Send className="w-4 h-4" /> Enviar email
                </button>
              )}
              <button onClick={() => setShowNoteModal(true)}
                className="btn-secondary w-full justify-start text-xs">
                <StickyNote className="w-4 h-4" /> Añadir nota
              </button>
            </div>
          </div>

          {/* Panel derecho: tabs */}
          <div className="lg:col-span-2">
            <div className="card">
              {/* Tabs */}
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? 'border-brand-500 text-brand-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ml-1.5 bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* TAB: Análisis IA */}
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    {!enrichment ? (
                      <div className="text-center py-8">
                        <Zap className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 mb-4">Este lead no ha sido analizado con IA todavía.</p>
                        <button onClick={handleEnrich} disabled={enriching} className="btn-primary text-xs">
                          <Zap className="w-3.5 h-3.5" /> {enriching ? 'Analizando...' : 'Enriquecer ahora'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {enrichment.company_summary && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Resumen</h4>
                            <p className="text-sm text-gray-700">{enrichment.company_summary as string}</p>
                          </div>
                        )}
                        {(enrichment.detected_needs as string[])?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Necesidades detectadas</h4>
                            <ul className="space-y-1">
                              {(enrichment.detected_needs as string[]).map((n, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className="text-green-500 mt-0.5">✓</span> {n}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(enrichment.detected_problems as string[])?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Problemas detectados</h4>
                            <ul className="space-y-1">
                              {(enrichment.detected_problems as string[]).map((p, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className="text-orange-400 mt-0.5">⚠</span> {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {enrichment.media_connector_fit && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Encaje con Media Connector</h4>
                            <p className="text-sm text-gray-700">{enrichment.media_connector_fit as string}</p>
                          </div>
                        )}
                        {(enrichment.auto_tags as string[])?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tags IA</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {(enrichment.auto_tags as string[]).map(t => (
                                <span key={t} className="badge bg-brand-50 text-brand-700">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* TAB: Mensajes generados */}
                {activeTab === 'messages' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">{messages.length} mensajes generados</p>
                      <button onClick={() => setShowMessageModal(true)} className="btn-primary text-xs py-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> Nuevo mensaje
                      </button>
                    </div>
                    {messages.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">Sin mensajes. Genera uno con IA.</p>
                    )}
                    {(messages as { id: string; type: string; subject?: string; body: string; created_at: string }[]).map((msg) => (
                      <div key={msg.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                            {msg.type.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                        </div>
                        {msg.subject && (
                          <p className="text-sm font-medium text-gray-800 mb-1">Asunto: {msg.subject}</p>
                        )}
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              setEmailSubject(msg.subject || '')
                              setEmailBody(msg.body)
                              setShowSendEmailModal(true)
                            }}
                            className="btn-secondary text-xs py-1"
                            disabled={!(lead as Record<string, string>).email}
                          >
                            <Send className="w-3 h-3" /> Usar para enviar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Emails */}
                {activeTab === 'emails' && (
                  <div className="space-y-3">
                    {emails.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin emails enviados.</p>}
                    {(emails as { id: string; subject: string; status: string; to_email: string; sent_at?: string }[]).map((email) => (
                      <div key={email.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800">{email.subject}</span>
                          <span className={`badge ${statusColor(email.status)}`}>{email.status}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Para: {email.to_email} {email.sent_at ? `· ${formatDate(email.sent_at)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Notas */}
                {activeTab === 'notes' && (
                  <div className="space-y-3">
                    <button onClick={() => setShowNoteModal(true)} className="btn-primary text-xs py-1.5">
                      <StickyNote className="w-3.5 h-3.5" /> Añadir nota
                    </button>
                    {notes.length === 0 && <p className="text-sm text-gray-400 py-4">Sin notas.</p>}
                    {(notes as { id: string; content: string; created_at: string }[]).map((note) => (
                      <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-gray-400 mt-2">{formatDateRelative(note.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Tareas */}
                {activeTab === 'tasks' && (
                  <div className="space-y-3">
                    {tasks.length === 0 && <p className="text-sm text-gray-400 py-4">Sin tareas.</p>}
                    {(tasks as { id: string; title: string; is_completed: boolean; due_date?: string }[]).map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl">
                        <CheckSquare className={`w-4 h-4 mt-0.5 shrink-0 ${task.is_completed ? 'text-green-500' : 'text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                          </p>
                          {task.due_date && (
                            <p className="text-xs text-gray-400">{formatDate(task.due_date)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Actividad */}
                {activeTab === 'activity' && (
                  <div className="space-y-0">
                    {activities.length === 0 && <p className="text-sm text-gray-400 py-4">Sin actividad registrada.</p>}
                    {(activities as { id: string; title: string; description?: string; created_at: string }[]).map((act, idx) => (
                      <div key={act.id} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                            <Activity className="w-3 h-3 text-brand-600" />
                          </div>
                          {idx < activities.length - 1 && (
                            <div className="w-px flex-1 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm text-gray-800">{act.title}</p>
                          {act.description && <p className="text-xs text-gray-500">{act.description}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateRelative(act.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Generar mensaje */}
      <Modal isOpen={showMessageModal} onClose={() => { setShowMessageModal(false); setGeneratedMsg(null) }}
        title="Generar mensaje con IA" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de mensaje</label>
              <select className="input" value={msgType} onChange={e => setMsgType(e.target.value)}>
                {MESSAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tono</label>
              <select className="input" value={msgTone} onChange={e => setMsgTone(e.target.value)}>
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {generatedMsg ? (
            <div className="space-y-3">
              {generatedMsg.subject && (
                <div>
                  <label className="label">Asunto</label>
                  <input className="input" value={generatedMsg.subject}
                    onChange={e => setGeneratedMsg(prev => prev ? {...prev, subject: e.target.value} : null)} />
                </div>
              )}
              <div>
                <label className="label">Mensaje</label>
                <textarea className="input resize-none" rows={8} value={generatedMsg.body}
                  onChange={e => setGeneratedMsg(prev => prev ? {...prev, body: e.target.value} : null)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleGenerateMessage} disabled={generatingMsg}
                  className="btn-secondary text-xs">Regenerar</button>
                {(lead as Record<string, string>).email && (
                  <button
                    onClick={() => {
                      setEmailSubject(generatedMsg.subject || '')
                      setEmailBody(generatedMsg.body)
                      setShowMessageModal(false)
                      setGeneratedMsg(null)
                      setShowSendEmailModal(true)
                    }}
                    className="btn-primary text-xs"
                  >
                    <Send className="w-3.5 h-3.5" /> Usar para enviar email
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button onClick={handleGenerateMessage} disabled={generatingMsg} className="btn-primary w-full justify-center">
              <Zap className="w-4 h-4" /> {generatingMsg ? 'Generando con IA...' : 'Generar mensaje'}
            </button>
          )}
        </div>
      </Modal>

      {/* Modal: Añadir nota */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Añadir nota">
        <div className="space-y-4">
          <div>
            <label className="label">Nota</label>
            <textarea className="input resize-none" rows={4} placeholder="Escribe tu nota aquí..."
              value={noteContent} onChange={e => setNoteContent(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNoteModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleSaveNote} disabled={savingNote || !noteContent.trim()}
              className="btn-primary text-xs">
              {savingNote ? 'Guardando...' : 'Guardar nota'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Enviar email */}
      <Modal isOpen={showSendEmailModal} onClose={() => setShowSendEmailModal(false)} title="Enviar email" size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
            ⚠️ Revisa el mensaje antes de enviar. Los emails enviados quedan registrados.
          </div>
          <div>
            <label className="label">Para</label>
            <input className="input bg-gray-50" value={(lead as Record<string, string>).email || ''} readOnly />
          </div>
          <div>
            <label className="label">Asunto *</label>
            <input className="input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
              placeholder="Asunto del email" />
          </div>
          <div>
            <label className="label">Mensaje *</label>
            <textarea className="input resize-none" rows={8} value={emailBody}
              onChange={e => setEmailBody(e.target.value)} placeholder="Cuerpo del email..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSendEmailModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
              className="btn-primary text-xs"
            >
              <Send className="w-3.5 h-3.5" /> {sendingEmail ? 'Enviando...' : 'Enviar email'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
