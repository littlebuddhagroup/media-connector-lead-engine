'use client'

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import TopBar from '@/components/layout/TopBar'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import Link from 'next/link'
import {
  Plus, Send, Mail, MailOpen, Eye, Trash2, Edit2, Clock, CheckCircle2,
  Loader2, Users, FileText, Calendar, ChevronRight, AlertTriangle,
  Sparkles, BookTemplate, Save, X, Play, Pause, UserX, RotateCcw, Info
} from 'lucide-react'

// Editor HTML (lazy load)
const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor').catch(() => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <textarea
      className="input resize-none w-full font-mono text-xs"
      rows={16}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
})))

// ============================================================
// NEWSLETTERS — Envío masivo con editor HTML y plantillas
// ============================================================

type NewsletterStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'

interface Newsletter {
  id: string
  name: string
  subject: string
  body_html: string
  status: NewsletterStatus
  from_email: string
  from_name: string
  reply_to?: string
  scheduled_for?: string
  sent_at?: string
  total_recipients: number
  total_sent: number
  total_opened: number
  total_clicked: number
  total_bounced: number
  target_type: string
  created_at: string
}

interface Template {
  id: string
  name: string
  subject: string
  body_html: string
}

interface List {
  id: string
  name: string
  member_count?: number
}

interface Unsubscribe {
  id: string
  email: string
  reason?: string
  unsubscribed_at: string
  lead?: { id: string; company_name?: string; first_name?: string; last_name?: string } | null
  newsletter?: { id: string; name: string } | null
}

interface PreviewCount {
  total_candidates: number
  unsubscribed: number
  effective: number
}

const STATUS_STYLE: Record<NewsletterStatus, { label: string; className: string; icon: string }> = {
  draft:     { label: 'Borrador',    className: 'bg-gray-100 text-gray-600',   icon: '✏️' },
  scheduled: { label: 'Programado',  className: 'bg-amber-100 text-amber-700', icon: '⏰' },
  sending:   { label: 'Enviando…',   className: 'bg-blue-100 text-blue-700',   icon: '📤' },
  sent:      { label: 'Enviado',     className: 'bg-green-100 text-green-700', icon: '✅' },
  cancelled: { label: 'Cancelado',   className: 'bg-red-100 text-red-600',     icon: '🚫' },
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f8fafc; }
    .wrapper { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #1e293b; color: white; padding: 32px 40px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 8px 0 0; opacity: 0.7; font-size: 14px; }
    .content { padding: 40px; }
    .content p { color: #374151; line-height: 1.7; font-size: 15px; margin: 0 0 16px; }
    .cta { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .footer { padding: 24px 40px; background: #f1f5f9; color: #6b7280; font-size: 13px; }
    .footer a { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>MyMediaConnect</h1>
      <p>La plataforma de gestión de creatividades publicitarias</p>
    </div>
    <div class="content">
      <p>Hola {{nombre}},</p>
      <p>Quería compartir contigo una novedad importante sobre cómo podemos ayudar a <strong>tu empresa</strong> a optimizar vuestro proceso de aprobación de creatividades.</p>
      <p>En MyMediaConnect hemos ayudado a más de 50 empresas a reducir el tiempo de aprobación de artes finales en un 60%, eliminando los errores de comunicación entre equipos.</p>
      <a href="https://mymediaconnect.com" class="cta">Solicitar demo de 20 minutos →</a>
      <p>Si tienes cualquier pregunta, responde directamente a este email.</p>
      <p>Un saludo,<br><strong>El equipo de MyMediaConnect</strong></p>
    </div>
    <div class="footer">
      Has recibido este email porque tienes una relación comercial con nosotros.
      <a href="#">Cancelar suscripción</a>
    </div>
  </div>
</body>
</html>`

export default function NewslettersPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [lists, setLists] = useState<List[]>([])
  const [unsubscribes, setUnsubscribes] = useState<Unsubscribe[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'editor' | 'unsubscribes'>('list')
  const [previewCount, setPreviewCount] = useState<PreviewCount | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [reactivating, setReactivating] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form fields
  const [fName, setFName] = useState('')
  const [fSubject, setFSubject] = useState('')
  const [fHtml, setFHtml] = useState(DEFAULT_HTML)
  const [fFromEmail, setFFromEmail] = useState('')
  const [fFromName, setFFromName] = useState('MyMediaConnect')
  const [fReplyTo, setFReplyTo] = useState('')
  const [fScheduled, setFScheduled] = useState('')
  const [fTargetType, setFTargetType] = useState<'all' | 'list'>('all')
  const [fTargetList, setFTargetList] = useState('')
  const [fPreviewMode, setFPreviewMode] = useState<'code' | 'preview'>('code')

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendId, setSendId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [nlRes, tplRes, listRes, unsubRes] = await Promise.all([
      fetch('/api/newsletters'),
      fetch('/api/newsletters/templates'),
      fetch('/api/lists'),
      fetch('/api/newsletters/unsubscribes'),
    ])
    const [nlJson, tplJson, listJson, unsubJson] = await Promise.all([
      nlRes.json(), tplRes.json(), listRes.json(), unsubRes.json()
    ])
    setNewsletters(nlJson.data ?? [])
    setTemplates(tplJson.data ?? [])
    setLists(listJson.data ?? [])
    setUnsubscribes(unsubJson.data ?? [])
    setLoading(false)
  }, [])

  const loadPreview = useCallback(async (targetType: string, targetListId: string) => {
    setLoadingPreview(true)
    setPreviewCount(null)
    const params = new URLSearchParams({ target_type: targetType })
    if (targetType === 'list' && targetListId) params.set('target_list_id', targetListId)
    const res = await fetch(`/api/newsletters/recipients-preview?${params}`)
    const json = await res.json()
    setPreviewCount(json.data ?? null)
    setLoadingPreview(false)
  }, [])

  const handleReactivate = async (email: string) => {
    setReactivating(email)
    const res = await fetch(`/api/newsletters/unsubscribes?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
    setReactivating(null)
    if (res.ok) {
      toast.success('Reactivado', `${email} vuelve a recibir newsletters.`)
      load()
    } else {
      toast.error('Error', 'No se pudo reactivar.')
    }
  }

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setEditingId(null)
    setFName('')
    setFSubject('')
    setFHtml(DEFAULT_HTML)
    setFFromEmail('')
    setFFromName('MyMediaConnect')
    setFReplyTo('')
    setFScheduled('')
    setFTargetType('all')
    setFTargetList('')
    setFPreviewMode('code')
  }

  const openNew = () => {
    resetForm()
    setView('editor')
  }

  const openEdit = (nl: Newsletter) => {
    setEditingId(nl.id)
    setFName(nl.name)
    setFSubject(nl.subject)
    setFHtml(nl.body_html)
    setFFromEmail(nl.from_email)
    setFFromName(nl.from_name)
    setFReplyTo(nl.reply_to ?? '')
    setFScheduled(nl.scheduled_for ? nl.scheduled_for.slice(0, 16) : '')
    setFTargetType(nl.target_type === 'list' ? 'list' : 'all')
    setFTargetList('')
    setView('editor')
  }

  const handleSave = async (status?: string) => {
    if (!fName.trim()) { toast.error('Falta el nombre', 'Pon un nombre al newsletter.'); return }
    if (!fSubject.trim()) { toast.error('Falta el asunto', 'Escribe el asunto del email.'); return }
    if (!fHtml.trim()) { toast.error('Falta el contenido', 'Escribe el cuerpo del newsletter.'); return }

    setSaving(true)
    const body = {
      name: fName,
      subject: fSubject,
      body_html: fHtml,
      from_email: fFromEmail,
      from_name: fFromName,
      reply_to: fReplyTo,
      scheduled_for: fScheduled || null,
      target_type: fTargetType,
      target_list_id: fTargetType === 'list' ? fTargetList : null,
      ...(status ? { status } : {}),
    }

    const res = editingId
      ? await fetch(`/api/newsletters/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/newsletters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    setSaving(false)
    if (res.ok) {
      toast.success(editingId ? 'Guardado' : 'Creado', 'Newsletter guardado correctamente.')
      setView('list')
      load()
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo guardar.')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const res = await fetch(`/api/newsletters/${deleteId}`, { method: 'DELETE' })
    setShowDeleteModal(false)
    setDeleteId(null)
    if (res.ok) {
      toast.success('Borrado', 'Newsletter eliminado.')
      load()
    } else {
      toast.error('Error', 'No se pudo borrar.')
    }
  }

  const handleSend = async () => {
    if (!sendId) return
    setSending(true)
    const res = await fetch(`/api/newsletters/${sendId}/send`, { method: 'POST' })
    const json = await res.json()
    setSending(false)
    setShowSendModal(false)
    setSendId(null)
    setPreviewCount(null)
    if (res.ok) {
      toast.success('Newsletter enviado', `${json.data?.sent ?? 0} emails enviados (${json.data?.skipped ?? 0} omitidos por baja).`)
      load()
    } else {
      toast.error('Error al enviar', json.error ?? 'No se pudo enviar.')
    }
  }

  const openSendModal = (id: string, targetType: string, targetListId: string) => {
    setSendId(id)
    setShowSendModal(true)
    loadPreview(targetType, targetListId)
  }

  const applyTemplate = (tpl: Template) => {
    setFSubject(tpl.subject)
    setFHtml(tpl.body_html)
    setShowTemplatesModal(false)
    toast.success('Plantilla aplicada')
  }

  const saveAsTemplate = async () => {
    if (!newTemplateName.trim()) { toast.error('Nombre requerido'); return }
    setSavingTemplate(true)
    const res = await fetch('/api/newsletters/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTemplateName, subject: fSubject, body_html: fHtml }),
    })
    setSavingTemplate(false)
    if (res.ok) {
      toast.success('Plantilla guardada')
      setNewTemplateName('')
      load()
    } else {
      toast.error('Error', 'No se pudo guardar la plantilla.')
    }
  }

  const deleteTemplate = async (id: string) => {
    await fetch('/api/newsletters/templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: id }) })
    load()
  }

  if (view === 'editor') {
    return (
      <div className="animate-fade-in flex flex-col h-full">
        <TopBar
          title={editingId ? 'Editar Newsletter' : 'Nuevo Newsletter'}
          subtitle="Editor HTML con previsualización en tiempo real"
          actions={
            <div className="flex items-center gap-2">
              <button onClick={() => { resetForm(); setView('list') }} className="btn-secondary text-xs py-1.5">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button onClick={() => handleSave('draft')} disabled={saving} className="btn-secondary text-xs py-1.5">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando…' : 'Guardar borrador'}
              </button>
              <button
                onClick={() => { setSendId(editingId ?? 'new'); setShowSendModal(true) }}
                disabled={!editingId}
                className="btn-primary text-xs py-1.5 disabled:opacity-40"
                title={!editingId ? 'Guarda primero el newsletter' : ''}
              >
                <Send className="w-3.5 h-3.5" /> Enviar ahora
              </button>
            </div>
          }
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Panel izquierdo — configuración */}
          <div className="w-72 shrink-0 border-r border-gray-200 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
            <div>
              <label className="label text-xs">Nombre del newsletter *</label>
              <input className="input text-sm" value={fName} onChange={e => setFName(e.target.value)} placeholder="Newsletter Mayo 2026" />
            </div>
            <div>
              <label className="label text-xs">Asunto del email *</label>
              <input className="input text-sm" value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="¿Aprobáis creatividades en bucle?" />
            </div>
            <div>
              <label className="label text-xs">De (email)</label>
              <input className="input text-sm" value={fFromEmail} onChange={e => setFFromEmail(e.target.value)} placeholder="ivan@mymediaconnect.com" />
            </div>
            <div>
              <label className="label text-xs">De (nombre)</label>
              <input className="input text-sm" value={fFromName} onChange={e => setFFromName(e.target.value)} placeholder="Ivan · MyMediaConnect" />
            </div>
            <div>
              <label className="label text-xs">Reply-to</label>
              <input className="input text-sm" value={fReplyTo} onChange={e => setFReplyTo(e.target.value)} placeholder="ivan@mymediaconnect.com" />
            </div>
            <div>
              <label className="label text-xs">Programar envío (opcional)</label>
              <input type="datetime-local" className="input text-sm" value={fScheduled} onChange={e => setFScheduled(e.target.value)} />
              {fScheduled && (
                <p className="text-xs text-amber-600 mt-1">
                  ⏰ Se enviará el {new Date(fScheduled).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>
            <div>
              <label className="label text-xs">Destinatarios</label>
              <select className="input text-sm" value={fTargetType} onChange={e => setFTargetType(e.target.value as 'all' | 'list')}>
                <option value="all">Todos los leads con email</option>
                <option value="list">Lista específica</option>
              </select>
            </div>
            {fTargetType === 'list' && (
              <div>
                <label className="label text-xs">Seleccionar lista</label>
                <select className="input text-sm" value={fTargetList} onChange={e => setFTargetList(e.target.value)}>
                  <option value="">— Elige una lista —</option>
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.member_count ?? 0})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Guardar como plantilla */}
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-600 mb-2">Guardar como plantilla</p>
              <div className="flex gap-1">
                <input
                  className="input text-xs py-1 flex-1"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="Nombre de la plantilla"
                />
                <button onClick={saveAsTemplate} disabled={savingTemplate} className="btn-secondary text-xs py-1 px-2">
                  {savingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Plantillas disponibles */}
            {templates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Cargar plantilla</p>
                <div className="space-y-1">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="flex items-center gap-1">
                      <button
                        onClick={() => applyTemplate(tpl)}
                        className="flex-1 text-left text-xs text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-2 py-1.5 rounded-lg transition-colors truncate"
                      >
                        {tpl.name}
                      </button>
                      <button onClick={() => deleteTemplate(tpl.id)} className="text-gray-300 hover:text-red-400 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Panel derecho — editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Barra de tabs code/preview */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white">
              <button
                onClick={() => setFPreviewMode('code')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  fPreviewMode === 'code' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                &lt;/&gt; HTML
              </button>
              <button
                onClick={() => setFPreviewMode('preview')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  fPreviewMode === 'preview' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Eye className="w-3 h-3 inline mr-1" /> Vista previa
              </button>
              <span className="text-xs text-gray-400 ml-auto">
                Usa <code className="bg-gray-100 px-1 rounded">{'{{nombre}}'}</code> para personalizar
              </span>
            </div>

            {fPreviewMode === 'code' ? (
              <div className="flex-1 overflow-auto p-4">
                <Suspense fallback={<div className="h-64 flex items-center justify-center text-gray-400 text-sm">Cargando editor...</div>}>
                  <RichTextEditor
                    value={fHtml}
                    onChange={setFHtml}
                    placeholder="Escribe el HTML de tu newsletter..."
                  />
                </Suspense>
                <p className="text-xs text-gray-400 mt-2">
                  También puedes pegar HTML directamente. El editor soporta HTML completo con estilos inline.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-gray-100 p-4">
                <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
                  <iframe
                    srcDoc={fHtml.replace(/\{\{nombre\}\}/gi, 'María García').replace(/\{\{name\}\}/gi, 'Maria')}
                    className="w-full"
                    style={{ height: '600px', border: 'none' }}
                    title="Vista previa newsletter"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal confirmar envío */}
        <Modal isOpen={showSendModal} onClose={() => setShowSendModal(false)} title="Confirmar envío" size="sm">
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ Esta acción no se puede deshacer</p>
              <p className="text-xs">El newsletter se enviará inmediatamente a todos los destinatarios seleccionados. Asegúrate de haber revisado el contenido y los destinatarios.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
              <div><strong>Asunto:</strong> {fSubject}</div>
              <div><strong>De:</strong> {fFromName} &lt;{fFromEmail}&gt;</div>
              <div><strong>Destinatarios:</strong> {fTargetType === 'all' ? 'Todos los leads con email' : `Lista: ${lists.find(l => l.id === fTargetList)?.name ?? '—'}`}</div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSendModal(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={() => { setShowSendModal(false); handleSave().then(() => { if (editingId) handleSend() }) }} disabled={sending} className="btn-primary text-xs">
                {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</> : <><Send className="w-3.5 h-3.5" /> Enviar ahora</>}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // Vista bajas (lista negra)
  if (view === 'unsubscribes') {
    return (
      <div className="animate-fade-in">
        <TopBar
          title="Bajas de newsletter"
          subtitle="Emails que han solicitado no recibir más comunicaciones"
          actions={
            <button onClick={() => setView('list')} className="btn-secondary text-xs py-1.5">
              <Mail className="w-3.5 h-3.5" /> Volver a newsletters
            </button>
          }
        />
        <div className="p-3 md:p-6 space-y-3 md:space-y-4">
          {unsubscribes.length === 0 ? (
            <div className="card p-12 text-center space-y-3">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
                <UserX className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Sin bajas registradas</h3>
                <p className="text-sm text-gray-500 mt-1">Nadie se ha dado de baja de tus newsletters todavía.</p>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Lista negra — {unsubscribes.length} email{unsubscribes.length !== 1 ? 's' : ''}
                </h3>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Info className="w-3.5 h-3.5" />
                  <span>Reactivar elimina la baja y permite futuros envíos</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {unsubscribes.map(u => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <UserX className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{u.email}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {u.lead?.company_name && (
                          <span>{u.lead.company_name}</span>
                        )}
                        {u.newsletter?.name && (
                          <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            vía {u.newsletter.name}
                          </span>
                        )}
                        {u.reason && u.reason !== 'manual' && (
                          <span className="text-gray-400">— {u.reason}</span>
                        )}
                        {u.reason === 'manual' && (
                          <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">manual</span>
                        )}
                        <span>
                          {new Date(u.unsubscribed_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleReactivate(u.email)}
                      disabled={reactivating === u.email}
                      className="btn-secondary text-xs py-1 px-2 text-green-600 border-green-200 hover:bg-green-50 disabled:opacity-50"
                      title="Reactivar — eliminar baja"
                    >
                      {reactivating === u.email
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <><RotateCcw className="w-3.5 h-3.5" /> Reactivar</>
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Vista lista
  return (
    <div className="animate-fade-in">
      <TopBar
        title="Newsletters"
        subtitle="Envíos masivos a tus leads con editor HTML y plantillas"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('unsubscribes')}
              className="btn-secondary text-xs py-1.5 relative"
            >
              <UserX className="w-3.5 h-3.5" /> Bajas
              {unsubscribes.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">
                  {unsubscribes.length}
                </span>
              )}
            </button>
            <button onClick={openNew} className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Nuevo newsletter
            </button>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {loading ? (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando newsletters...</p>
          </div>
        ) : newsletters.length === 0 ? (
          <div className="card p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-brand-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sin newsletters todavía</h3>
              <p className="text-sm text-gray-500 mt-1">Crea tu primer newsletter y envíalo a todos tus leads.</p>
            </div>
            <button onClick={openNew} className="btn-primary text-sm inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Crear primer newsletter
            </button>
          </div>
        ) : (
          <>
            {/* Stats rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { label: 'Total newsletters', value: newsletters.length, icon: Mail, color: 'bg-brand-50 text-brand-600' },
                { label: 'Enviados', value: newsletters.filter(n => n.status === 'sent').length, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
                { label: 'Emails enviados', value: newsletters.reduce((acc, n) => acc + (n.total_sent || 0), 0), icon: Send, color: 'bg-blue-50 text-blue-600' },
                { label: 'Dados de baja', value: unsubscribes.length, icon: UserX, color: 'bg-red-50 text-red-500', onClick: () => setView('unsubscribes') },
              ] as Array<{ label: string; value: number; icon: React.ElementType; color: string; onClick?: () => void }>).map(card => (
                <div
                  key={card.label}
                  className={`card p-4 flex items-center gap-3 ${card.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                  onClick={card.onClick}
                >
                  <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center shrink-0`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                    <p className="text-xs text-gray-500">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Lista de newsletters */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Newsletters ({newsletters.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {newsletters.map(nl => {
                  const st = STATUS_STYLE[nl.status] ?? STATUS_STYLE.draft
                  const openRate = nl.total_sent > 0 ? Math.round((nl.total_opened / nl.total_sent) * 100) : 0
                  const canEdit = ['draft', 'scheduled'].includes(nl.status)
                  const canSend = nl.status === 'draft'
                  return (
                    <div key={nl.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 text-xl mt-0.5">
                        {st.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{nl.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.className}`}>{st.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">Asunto: {nl.subject}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {nl.status === 'sent' ? (
                            <>
                              <span className="flex items-center gap-1"><Send className="w-3 h-3" />{nl.total_sent} enviados</span>
                              <span className="flex items-center gap-1"><MailOpen className="w-3 h-3 text-blue-400" />{nl.total_opened} abiertos ({openRate}%)</span>
                              {nl.total_bounced > 0 && (
                                <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />{nl.total_bounced} rebotes</span>
                              )}
                              {nl.sent_at && <span>{new Date(nl.sent_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}</span>}
                            </>
                          ) : nl.status === 'scheduled' ? (
                            <span className="text-amber-500">⏰ Programado: {nl.scheduled_for ? new Date(nl.scheduled_for).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                          ) : (
                            <span>{new Date(nl.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <button onClick={() => openEdit(nl)} className="btn-secondary text-xs py-1 px-2" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canSend && (
                          <button
                            onClick={() => openSendModal(nl.id, nl.target_type, '')}
                            className="btn-primary text-xs py-1 px-2"
                            title="Enviar ahora"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {nl.status !== 'sending' && (
                          <button
                            onClick={() => { setDeleteId(nl.id); setShowDeleteModal(true) }}
                            className="btn-secondary text-xs py-1 px-2 text-red-500 border-red-200 hover:bg-red-50"
                            title="Borrar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal confirmar envío (desde lista) */}
      <Modal isOpen={showSendModal && !!sendId} onClose={() => { setShowSendModal(false); setPreviewCount(null) }} title="Enviar newsletter" size="sm">
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠️ Esta acción no se puede deshacer</p>
            <p className="text-xs">El newsletter se enviará inmediatamente a todos los destinatarios.</p>
          </div>

          {/* Preview de destinatarios */}
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando destinatarios…
              </div>
            ) : previewCount ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Leads con email</span>
                  <span className="font-semibold text-gray-700">{previewCount.total_candidates}</span>
                </div>
                {previewCount.unsubscribed > 0 && (
                  <div className="flex items-center justify-between text-red-500">
                    <span className="flex items-center gap-1"><UserX className="w-3 h-3" /> Dados de baja</span>
                    <span className="font-semibold">−{previewCount.unsubscribed}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-800">Envíos efectivos</span>
                  <span className="font-bold text-green-600 text-sm">{previewCount.effective}</span>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowSendModal(false); setPreviewCount(null) }} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleSend} disabled={sending || loadingPreview} className="btn-primary text-xs">
              {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</> : <><Send className="w-3.5 h-3.5" /> Enviar</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar borrado */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Borrar newsletter" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">¿Seguro que quieres borrar este newsletter? Esta acción es irreversible.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowDeleteModal(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleDelete} className="btn-primary text-xs bg-red-600 hover:bg-red-700 border-red-600">
              Borrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
