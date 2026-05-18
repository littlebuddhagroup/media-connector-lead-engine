'use client'

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import TopBar from '@/components/layout/TopBar'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import {
  Plus, Send, Mail, MailOpen, Eye, Trash2, Edit2, CheckCircle2,
  Loader2, AlertTriangle, Save, X, UserX, RotateCcw, Info, Zap, ChevronDown, ChevronUp,
  CalendarClock, Youtube, Video, List
} from 'lucide-react'

// Convierte un ISO UTC a formato "YYYY-MM-DDTHH:MM" en hora local (para datetime-local input)
function utcToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convierte el valor de datetime-local (hora local) a ISO UTC para guardar en DB
function localInputToUtc(local: string): string {
  return new Date(local).toISOString()
}
import { getPresetTemplates, TAG_STYLES, TAG_LABELS, LANG_LABELS, type Lang } from '@/lib/newsletterTemplates'

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
type ViewMode = 'list' | 'editor' | 'unsubscribes' | 'report'

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
  total_clicked?: number
  total_bounced: number
  target_type: string
  target_list_id?: string | null
  target_list_ids?: string[] | null
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
  icon?: string
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

interface RecipientDetail {
  id: string
  email: string
  name?: string
  status: 'pending' | 'sent' | 'opened' | 'failed' | 'bounced'
  sent_at?: string
  opened_at?: string
  open_count?: number
  lead_id?: string
}

interface NewsletterDetail extends Newsletter {
  newsletter_recipients: RecipientDetail[]
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
    .header { background: #1e293b; padding: 32px 40px; }
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
      <img src="https://media-connector-lead-engine.vercel.app/logo.png" alt="MyMediaConnect" width="160" style="display:block;border:0" />
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
      <a href="{{UNSUBSCRIBE_URL}}">Cancelar suscripción</a>
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
  const [view, setView] = useState<ViewMode>('list')
  const [reportData, setReportData] = useState<NewsletterDetail | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportSearch, setReportSearch] = useState('')
  const [reportFilter, setReportFilter] = useState<string>('all')
  const [previewCount, setPreviewCount] = useState<PreviewCount | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [reactivating, setReactivating] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form fields
  const [fName, setFName] = useState('')
  const [fSubject, setFSubject] = useState('')
  const [fHtml, setFHtml] = useState(DEFAULT_HTML)
  const [fScheduled, setFScheduled] = useState('')
  const [fPreviewMode, setFPreviewMode] = useState<'editor' | 'code' | 'preview'>('editor')
  const [showPresets, setShowPresets] = useState(true)
  const [presetLang, setPresetLang] = useState<Lang>('es')
  const [showVideoPanel, setShowVideoPanel] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [fTargetLists, setFTargetLists] = useState<string[]>([])

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendId, setSendId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
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

  const loadPreview = useCallback(async (listIds: string[]) => {
    if (listIds.length === 0) { setPreviewCount(null); return }
    setLoadingPreview(true)
    setPreviewCount(null)
    const params = new URLSearchParams({ list_ids: listIds.join(',') })
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

  // ── YouTube helpers ──────────────────────────────────────────
  function extractYouTubeId(url: string): string | null {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/)
    return m ? m[1] : null
  }

  const insertYouTubeBlock = () => {
    const videoId = extractYouTubeId(videoUrl.trim())
    if (!videoId) {
      toast.error('URL inválida', 'Pega un enlace de YouTube válido (youtube.com/watch?v=... o youtu.be/...).')
      return
    }
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`
    const block = `
<!-- BLOQUE VIDEO YOUTUBE -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
  <tr>
    <td align="center" style="padding:0 20px;">
      <a href="${ytUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;border:0;line-height:0;">
        <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg"
             alt="Ver video en YouTube"
             width="480"
             style="max-width:100%;border-radius:10px;display:block;border:0;" />
      </a>
      <div style="margin-top:14px;">
        <a href="${ytUrl}"
           target="_blank" rel="noopener noreferrer"
           style="display:inline-block;background:#FF0000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;padding:11px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.01em;">
          &#9654;&nbsp;&nbsp;Ver en YouTube
        </a>
      </div>
    </td>
  </tr>
</table>
<!-- FIN BLOQUE VIDEO YOUTUBE -->`

    // Insertar antes del footer si existe, si no antes de </body>, si no al final
    let updated: string
    if (fHtml.includes('<div class="footer"')) {
      updated = fHtml.replace('<div class="footer"', `${block}\n    <div class="footer"`)
    } else if (fHtml.includes('</body>')) {
      updated = fHtml.replace('</body>', `${block}\n</body>`)
    } else {
      updated = fHtml + block
    }

    setFHtml(updated)
    setVideoUrl('')
    setShowVideoPanel(false)
    setFPreviewMode('preview')
    toast.success('Video añadido ✓', 'Bloque de YouTube insertado. Revísalo en la vista previa.')
  }

  const resetForm = () => {
    setEditingId(null)
    setFName('')
    setFSubject('')
    setFHtml(DEFAULT_HTML)
    setFScheduled('')
    setFTargetLists([])
    setFPreviewMode('editor')
    setShowPresets(true)
    setShowVideoPanel(false)
    setVideoUrl('')
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
    setFScheduled(nl.scheduled_for ? utcToLocalInput(nl.scheduled_for) : '')
    // Recuperar listas seleccionadas: usar target_list_ids si existe, sino target_list_id (legacy)
    const savedLists = nl.target_list_ids?.length
      ? nl.target_list_ids
      : nl.target_list_id ? [nl.target_list_id] : []
    setFTargetLists(savedLists)
    setFPreviewMode('editor')
    setShowPresets(false)
    setView('editor')
  }

  const handleSave = async (status?: string) => {
    if (!fName.trim()) { toast.error('Falta el nombre', 'Pon un nombre al newsletter.'); return }
    if (!fSubject.trim()) { toast.error('Falta el asunto', 'Escribe el asunto del email.'); return }
    if (!fHtml.trim()) { toast.error('Falta el contenido', 'Escribe el cuerpo del newsletter.'); return }
    if (fTargetLists.length === 0) { toast.error('Sin destinatarios', 'Selecciona al menos una lista de destinatarios.'); return }

    setSaving(true)

    const scheduledUtc = fScheduled ? localInputToUtc(fScheduled) : null

    const body = {
      name: fName,
      subject: fSubject,
      body_html: fHtml,
      from_email: '',
      from_name: '',
      reply_to: '',
      scheduled_for: status === 'draft' ? null : scheduledUtc,
      target_type: 'list',
      target_list_ids: fTargetLists,
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

  const openSendModal = (id: string, listIds: string[]) => {
    setSendId(id)
    setShowSendModal(true)
    loadPreview(listIds)
  }

  const openReport = async (id: string) => {
    setLoadingReport(true)
    setReportData(null)
    setReportSearch('')
    setReportFilter('all')
    setView('report')
    const res = await fetch(`/api/newsletters/${id}`)
    const json = await res.json()
    setReportData(json.data ?? null)
    setLoadingReport(false)
  }

  const applyTemplate = (tpl: Template) => {
    setFSubject(tpl.subject)
    setFHtml(tpl.body_html)
    toast.success('Plantilla aplicada')
  }

  const handleSchedule = async () => {
    if (!fScheduled) {
      toast.error('Sin fecha', 'Selecciona primero la fecha y hora de envío.')
      return
    }
    const selected = new Date(fScheduled)
    if (selected <= new Date()) {
      toast.error('Fecha inválida', 'La fecha de programación debe ser futura.')
      return
    }
    await handleSave('scheduled')
  }

  const applyPreset = (preset: ReturnType<typeof getPresetTemplates>[0]) => {
    setFSubject(preset.subject)
    setFHtml(preset.body_html)
    if (!fName) setFName(preset.name)
    setShowPresets(false)
    setFPreviewMode('preview')
    toast.success('Plantilla aplicada', preset.description)
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
                <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando…' : 'Borrador'}
              </button>
              <button
                onClick={handleSchedule}
                disabled={saving || !fScheduled}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                  fScheduled
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                    : 'bg-white text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                }`}
                title={!fScheduled ? 'Primero selecciona la fecha y hora de envío' : `Programar para el ${new Date(fScheduled).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                {saving ? 'Guardando…' : 'Programar'}
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

            {/* ── Plantillas premium ── */}
            <div className="border border-purple-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowPresets(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-semibold text-purple-700">Plantillas premium</span>
                </div>
                {showPresets
                  ? <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                }
              </button>
              {showPresets && (
                <div className="bg-white">
                  {/* Selector de idioma */}
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mr-1">Idioma:</span>
                    {(['es', 'en', 'fr'] as Lang[]).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setPresetLang(lang)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors border ${
                          presetLang === lang
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
                        }`}
                      >
                        {LANG_LABELS[lang]}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 space-y-1.5">
                    {getPresetTemplates(presetLang).map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className="w-full text-left rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 p-2.5 transition-all group"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TAG_STYLES[preset.tag]}`}>
                            {TAG_LABELS[preset.tag]}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 group-hover:text-purple-700 truncate">{preset.name}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-tight">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Datos básicos ── */}
            <div>
              <label className="label text-xs">Nombre del newsletter *</label>
              <input className="input text-sm" value={fName} onChange={e => setFName(e.target.value)} placeholder="Newsletter Mayo 2026" />
            </div>
            <div>
              <label className="label text-xs">Asunto del email *</label>
              <input className="input text-sm" value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="¿Aprobáis creatividades en bucle?" />
            </div>

            {/* ── Remitente — info ── */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-700 mb-0.5 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Envío con rotación automática
              </p>
              <p className="text-[11px] text-blue-500 leading-snug">
                Los emails se envían rotando entre las 4 cuentas de Guillaume para maximizar la entregabilidad.
              </p>
            </div>

            <div>
              <label className="label text-xs flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
                Fecha de envío programado
              </label>
              <input
                type="datetime-local"
                className="input text-sm"
                value={fScheduled}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                onChange={e => setFScheduled(e.target.value)}
              />
              {fScheduled ? (
                <div className="mt-1.5 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">
                      {new Date(fScheduled).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[11px] text-amber-600 mt-0.5">Hora local · pulsa "Programar" para confirmar</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Deja vacío para enviar manualmente</p>
              )}
            </div>
            {/* ── Destinatarios — solo listas ── */}
            <div>
              <label className="label text-xs flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-brand-500" />
                Listas de destinatarios *
              </label>
              {lists.length === 0 ? (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                  No tienes listas creadas. Ve a{' '}
                  <a href="/leads" className="text-brand-600 underline">Leads → sidebar</a> para crear una.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {lists.map(l => {
                    const checked = fTargetLists.includes(l.id)
                    return (
                      <label
                        key={l.id}
                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-gray-100 last:border-0 ${
                          checked ? 'bg-brand-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...fTargetLists, l.id]
                              : fTargetLists.filter(id => id !== l.id)
                            setFTargetLists(next)
                          }}
                          className="accent-brand-600 w-3.5 h-3.5 shrink-0"
                        />
                        <span className="text-base leading-none">{l.icon ?? '📋'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{l.name}</p>
                          <p className="text-[10px] text-gray-400">{l.member_count ?? 0} leads</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
              {fTargetLists.length > 0 && (
                <p className="text-[11px] text-brand-600 mt-1.5 font-medium">
                  ✓ {fTargetLists.length} lista{fTargetLists.length !== 1 ? 's' : ''} seleccionada{fTargetLists.length !== 1 ? 's' : ''}
                </p>
              )}
              {fTargetLists.length === 0 && lists.length > 0 && (
                <p className="text-[11px] text-amber-600 mt-1.5">⚠ Selecciona al menos una lista</p>
              )}
            </div>

            {/* ── Guardar como plantilla ── */}
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

            {/* ── Mis plantillas ── */}
            {templates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Mis plantillas guardadas</p>
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
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Barra de tabs: Editor / Código / Vista previa / YouTube */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white shrink-0 flex-wrap">
              <button
                onClick={() => setFPreviewMode('editor')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  fPreviewMode === 'editor' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                ✏️ Editor
              </button>
              <button
                onClick={() => setFPreviewMode('code')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  fPreviewMode === 'code' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                &lt;/&gt; Código
              </button>
              <button
                onClick={() => setFPreviewMode('preview')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  fPreviewMode === 'preview' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Eye className="w-3 h-3 inline mr-1" /> Vista previa
              </button>

              {/* Separador */}
              <div className="w-px h-4 bg-gray-200 mx-1" />

              {/* Botón insertar video YouTube */}
              <button
                onClick={() => setShowVideoPanel(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                  showVideoPanel
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400'
                }`}
                title="Insertar video de YouTube como thumbnail clicable (recomendado para email)"
              >
                <Youtube className="w-3.5 h-3.5" />
                <span>Insertar video</span>
              </button>

              <span className="text-xs text-gray-400 ml-auto hidden sm:block">
                Usa <code className="bg-gray-100 px-1 rounded">{'{{nombre}}'}</code> para personalizar
              </span>
            </div>

            {/* Panel insertar video YouTube */}
            {showVideoPanel && (
              <div className="shrink-0 border-b border-red-100 bg-red-50/60 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Youtube className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 mb-0.5">Insertar video de YouTube</p>
                    <p className="text-[11px] text-gray-500 mb-2 leading-snug">
                      Se inserta como <strong>thumbnail clicable</strong> — sin iframes, sin riesgo de spam.
                      Al hacer clic se abre YouTube en el navegador.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && insertYouTubeBlock()}
                        placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                        className="input text-xs flex-1 py-1.5"
                        autoFocus
                      />
                      <button
                        onClick={insertYouTubeBlock}
                        disabled={!videoUrl.trim()}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-40 shrink-0"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Insertar
                      </button>
                      <button
                        onClick={() => { setShowVideoPanel(false); setVideoUrl('') }}
                        className="text-gray-400 hover:text-gray-600 p-1.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      💡 Formatos aceptados: youtube.com/watch?v=ID · youtu.be/ID · youtube.com/embed/ID
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Editor WYSIWYG (TipTap) ── */}
            {fPreviewMode === 'editor' && (
              <div className="flex-1 overflow-auto p-4">
                <Suspense fallback={<div className="h-64 flex items-center justify-center text-gray-400 text-sm">Cargando editor...</div>}>
                  <RichTextEditor
                    value={fHtml}
                    onChange={setFHtml}
                    placeholder="Escribe el contenido de tu newsletter..."
                  />
                </Suspense>
                <p className="text-xs text-gray-400 mt-2">
                  Editor visual. Para editar el HTML directamente usa la pestaña <strong>Código</strong>.
                </p>
              </div>
            )}

            {/* ── Editor de código HTML en bruto ── */}
            {fPreviewMode === 'code' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
                  <span className="text-xs text-amber-400 font-mono font-semibold">newsletter.html</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono">{fHtml.length.toLocaleString()} chars</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(fHtml)
                        toast.success('Copiado', 'HTML copiado al portapapeles.')
                      }}
                      className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/30"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
                <textarea
                  value={fHtml}
                  onChange={e => setFHtml(e.target.value)}
                  spellCheck={false}
                  className="flex-1 w-full resize-none bg-transparent text-gray-200 font-mono text-xs leading-relaxed p-4 focus:outline-none"
                  style={{ tabSize: 2 }}
                  placeholder="<!-- Pega o escribe tu HTML aquí -->"
                  onKeyDown={e => {
                    // Tab inserta 2 espacios en lugar de cambiar foco
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const el = e.currentTarget
                      const start = el.selectionStart
                      const end = el.selectionEnd
                      const newVal = fHtml.substring(0, start) + '  ' + fHtml.substring(end)
                      setFHtml(newVal)
                      requestAnimationFrame(() => {
                        el.selectionStart = el.selectionEnd = start + 2
                      })
                    }
                  }}
                />
              </div>
            )}

            {/* ── Vista previa renderizada ── */}
            {fPreviewMode === 'preview' && (
              <div className="flex-1 overflow-auto bg-gray-100">
                {/* Barra de herramientas de preview */}
                <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 sticky top-0 z-10">
                  <span className="text-xs text-gray-500">Vista previa · el texto <code className="bg-gray-100 px-1 rounded">{'{{nombre}}'}</code> se sustituye por ejemplo</span>
                  <button
                    onClick={() => {
                      const previewHtml = fHtml
                        .replace(/\{\{nombre\}\}/gi, 'María García')
                        .replace(/\{\{name\}\}/gi, 'Maria')
                        .replace(/\{\{prénom\}\}/gi, 'Marie')
                      const printWin = window.open('', '_blank', 'width=900,height=700')
                      if (printWin) {
                        printWin.document.write(`<!DOCTYPE html><html><head><title>${fSubject || 'Newsletter'}</title><style>@media print{body{margin:0}}</style></head><body>${previewHtml}</body></html>`)
                        printWin.document.close()
                        printWin.onload = () => { printWin.focus(); printWin.print() }
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium"
                  >
                    📄 Exportar PDF
                  </button>
                </div>
                <iframe
                  key={fHtml}
                  srcDoc={fHtml.replace(/\{\{nombre\}\}/gi, 'María García').replace(/\{\{name\}\}/gi, 'Maria').replace(/\{\{prénom\}\}/gi, 'Marie')}
                  className="w-full block"
                  style={{ minHeight: 'calc(100vh - 220px)', border: 'none' }}
                  title="Vista previa newsletter"
                  sandbox="allow-same-origin"
                  onLoad={(e) => {
                    try {
                      const doc = e.currentTarget.contentDocument
                      if (doc) {
                        const h = doc.documentElement.scrollHeight
                        if (h > 0) e.currentTarget.style.height = h + 'px'
                      }
                    } catch { /* cross-origin safety */ }
                  }}
                />
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
              <div><strong>De:</strong> Guillaume — rotación de 4 cuentas</div>
              <div><strong>Listas:</strong> {fTargetLists.length === 0 ? '—' : fTargetLists.map(id => lists.find(l => l.id === id)?.name ?? id).join(', ')}</div>
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

  // ── Vista reporte de newsletter ────────────────────────────
  if (view === 'report') {
    const nl = reportData
    const recipients = nl?.newsletter_recipients ?? []

    // Métricas
    const totalSent      = nl?.total_sent ?? 0
    const totalOpened    = nl?.total_opened ?? 0
    const totalClicked   = nl?.total_clicked ?? 0
    const totalBounced   = nl?.total_bounced ?? 0
    const totalFailed    = recipients.filter(r => r.status === 'failed').length
    const openRate       = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
    const clickRate      = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0
    const bounceRate     = totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0

    // Filtro + búsqueda en tabla
    const filtered = recipients.filter(r => {
      const matchSearch = !reportSearch ||
        r.email.toLowerCase().includes(reportSearch.toLowerCase()) ||
        (r.name ?? '').toLowerCase().includes(reportSearch.toLowerCase())
      const matchFilter = reportFilter === 'all' || r.status === reportFilter
      return matchSearch && matchFilter
    })

    const RECIPIENT_STATUS: Record<string, { label: string; className: string; dot: string }> = {
      sent:    { label: 'Entregado',  className: 'bg-blue-50 text-blue-600',   dot: 'bg-blue-400' },
      opened:  { label: 'Abierto',    className: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
      failed:  { label: 'Fallido',    className: 'bg-red-50 text-red-600',     dot: 'bg-red-400' },
      bounced: { label: 'Rebotado',   className: 'bg-orange-50 text-orange-600', dot: 'bg-orange-400' },
      pending: { label: 'Pendiente',  className: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-300' },
    }

    return (
      <div className="animate-fade-in">
        <TopBar
          title={loadingReport ? 'Cargando reporte…' : (nl?.name ?? 'Reporte newsletter')}
          subtitle={nl ? `Enviado el ${new Date(nl.sent_at ?? nl.created_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}` : ''}
          actions={
            <button onClick={() => setView('list')} className="btn-secondary text-xs py-1.5">
              <X className="w-3.5 h-3.5" /> Volver
            </button>
          }
        />

        {loadingReport ? (
          <div className="p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando datos del reporte…</p>
          </div>
        ) : !nl ? (
          <div className="p-10 text-center text-sm text-gray-500">No se pudieron cargar los datos.</div>
        ) : (
          <div className="p-3 md:p-6 space-y-5">

            {/* Info del envío */}
            <div className="card px-5 py-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <div><span className="font-semibold text-gray-700">Asunto:</span> {nl.subject}</div>
              <div className="w-px h-4 bg-gray-200 hidden sm:block" />
              <div><span className="font-semibold text-gray-700">Destinatarios:</span> {nl.total_recipients}</div>
              <div className="w-px h-4 bg-gray-200 hidden sm:block" />
              <div><span className="font-semibold text-gray-700">Remitente:</span> Guillaume — rotación 4 cuentas</div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Enviados',      value: totalSent,    sub: `de ${nl.total_recipients}`,  color: 'bg-blue-50',   text: 'text-blue-600',   icon: Send },
                { label: 'Tasa apertura', value: `${openRate}%`, sub: `${totalOpened} abiertos`,  color: 'bg-green-50',  text: 'text-green-600',  icon: MailOpen },
                { label: 'Tasa clicks',   value: `${clickRate}%`, sub: `${totalClicked} clicks`,  color: 'bg-purple-50', text: 'text-purple-600', icon: Eye },
                { label: 'Rebotes',       value: totalBounced, sub: `${bounceRate}% tasa`,         color: 'bg-orange-50', text: 'text-orange-600', icon: AlertTriangle },
                { label: 'Fallidos',      value: totalFailed,  sub: 'error al enviar',             color: 'bg-red-50',    text: 'text-red-500',    icon: X },
              ].map(card => (
                <div key={card.label} className={`card p-4 flex flex-col gap-1 border-0 ${card.color}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">{card.label}</span>
                    <card.icon className={`w-3.5 h-3.5 ${card.text}`} />
                  </div>
                  <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
                  <p className="text-[11px] text-gray-400">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Barras de progreso */}
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Distribución de resultados</p>
              {[
                { label: 'Abiertos',   count: totalOpened,  total: totalSent, color: 'bg-green-500' },
                { label: 'Solo entregados (no abiertos)', count: Math.max(0, totalSent - totalOpened - totalBounced - totalFailed), total: totalSent, color: 'bg-blue-400' },
                { label: 'Rebotes',    count: totalBounced, total: totalSent, color: 'bg-orange-400' },
                { label: 'Fallidos',   count: totalFailed,  total: totalSent, color: 'bg-red-400' },
              ].filter(b => b.count > 0).map(bar => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-44 shrink-0">{bar.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${bar.color} transition-all`}
                      style={{ width: `${bar.total > 0 ? Math.round((bar.count / bar.total) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-10 text-right">{bar.count}</span>
                  <span className="text-xs text-gray-400 w-8">{bar.total > 0 ? Math.round((bar.count / bar.total) * 100) : 0}%</span>
                </div>
              ))}
            </div>

            {/* Tabla de destinatarios */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Destinatarios ({recipients.length})</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Estado individual de cada envío</p>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                  {/* Filtro por estado */}
                  <select
                    value={reportFilter}
                    onChange={e => setReportFilter(e.target.value)}
                    className="input text-xs py-1 w-auto"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="opened">Abiertos</option>
                    <option value="sent">Entregados</option>
                    <option value="bounced">Rebotados</option>
                    <option value="failed">Fallidos</option>
                    <option value="pending">Pendientes</option>
                  </select>
                  {/* Búsqueda */}
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={e => setReportSearch(e.target.value)}
                    placeholder="Buscar email o nombre…"
                    className="input text-xs py-1 w-48"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  {reportSearch || reportFilter !== 'all' ? 'Sin resultados para ese filtro.' : 'Sin destinatarios registrados.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Email / Nombre</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Estado</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600 hidden md:table-cell">Aperturas</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600 hidden md:table-cell">Último abrir</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600 hidden lg:table-cell">Enviado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map(r => {
                        const st = RECIPIENT_STATUS[r.status] ?? RECIPIENT_STATUS.pending
                        return (
                          <tr key={r.id} className="odd:bg-white even:bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{r.email}</p>
                              {r.name && <p className="text-gray-400 mt-0.5">{r.name}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.className}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`} />
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {(r.open_count ?? 0) > 0
                                ? <span className="font-semibold text-green-600">{r.open_count}×</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-gray-400">
                              {r.opened_at
                                ? new Date(r.opened_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell text-gray-400">
                              {r.sent_at
                                ? new Date(r.sent_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {filtered.length < recipients.length && (
                    <div className="px-4 py-2.5 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                      Mostrando {filtered.length} de {recipients.length} destinatarios
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
                { label: 'Emails enviados', value: newsletters.reduce((acc, n) => acc + (n.total_sent || 0), 0), icon: Send, color: 'bg-blue-50 text-blue-600' },
                { label: 'Aperturas totales', value: newsletters.reduce((acc, n) => acc + (n.total_opened || 0), 0), icon: MailOpen, color: 'bg-green-50 text-green-600' },
                { label: 'Clicks totales', value: newsletters.reduce((acc, n) => acc + (n.total_clicked || 0), 0), icon: Eye, color: 'bg-purple-50 text-purple-600' },
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
                              {(nl.total_clicked ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-green-500">
                                  <Eye className="w-3 h-3" />{nl.total_clicked} clicks
                                </span>
                              )}
                              {nl.total_bounced > 0 && (
                                <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />{nl.total_bounced} rebotes</span>
                              )}
                              {nl.sent_at && <span>{new Date(nl.sent_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}</span>}
                            </>
                          ) : (nl.status === 'scheduled' || nl.status === 'draft') ? (() => {
                            const nlListIds = nl.target_list_ids?.length
                              ? nl.target_list_ids
                              : nl.target_list_id ? [nl.target_list_id] : []
                            const nlLists = lists.filter(l => nlListIds.includes(l.id))
                            const totalLeads = nlLists.reduce((acc, l) => acc + (l.member_count ?? 0), 0)
                            return (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                {nl.status === 'scheduled' && (
                                  <span className="text-amber-600 font-medium flex items-center gap-1">
                                    <CalendarClock className="w-3 h-3" />
                                    {nl.scheduled_for
                                      ? new Date(nl.scheduled_for).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
                                      : '—'}
                                  </span>
                                )}
                                {nlLists.length > 0 ? (
                                  <span className="flex items-center gap-1 text-gray-500">
                                    <List className="w-3 h-3 text-brand-400" />
                                    {nlLists.map(l => l.name).join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-red-400 text-[11px]">⚠ Sin lista asignada</span>
                                )}
                                {totalLeads > 0 && (
                                  <span className="flex items-center gap-1 text-brand-600 font-medium">
                                    <Send className="w-3 h-3" />
                                    ~{totalLeads} envío{totalLeads !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            )
                          })() : (
                            <span>{new Date(nl.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {nl.status === 'sent' && (
                          <button
                            onClick={() => openReport(nl.id)}
                            className="btn-secondary text-xs py-1 px-2 text-brand-600 border-brand-200 hover:bg-brand-50"
                            title="Ver reporte"
                          >
                            <MailOpen className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline ml-1">Reporte</span>
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={() => openEdit(nl)} className="btn-secondary text-xs py-1 px-2" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canSend && (
                          <button
                            onClick={() => openSendModal(nl.id, nl.target_list_ids ?? (nl.target_list_id ? [nl.target_list_id] : []))}
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
