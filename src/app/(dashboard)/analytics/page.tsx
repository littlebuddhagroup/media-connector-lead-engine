'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import {
  Mail, MailOpen, MessageSquareReply, AlertTriangle, TrendingUp,
  RefreshCw, Loader2, CheckCircle2, XCircle, User, ChevronDown,
  ChevronUp, ExternalLink, AlertCircle, MousePointerClick, ShieldAlert,
  Download
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ============================================================
// ANALYTICS — Analíticas completas de emails, campañas, secuencias
// ============================================================

interface EmailRow {
  id: string
  subject: string
  from_email: string
  to_email?: string
  to_name?: string
  lead_id?: string
  company_name?: string
  status: string
  sent_at: string
  opened_at?: string
  clicked_at?: string
  replied_at?: string
  open_count?: number
  click_count?: number
  campaign_id?: string
  campaign_name?: string
}

interface Summary {
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  total_replied: number
  total_bounced: number
  total_failed: number
  total_spam: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
  delivery_rate: number
}

interface AccountRow {
  account: string
  sent: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
}

interface CampaignRow {
  name: string
  sent: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
}

interface DailyRow {
  date: string
  sent: number
  opened: number
  clicked: number
  replied: number
  bounced: number
}

interface DrillDown {
  bounced: EmailRow[]
  opened: EmailRow[]
  clicked: EmailRow[]
  replied: EmailRow[]
  failed: EmailRow[]
  spam: EmailRow[]
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  sent:      { label: 'Enviado',    className: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Entregado',  className: 'bg-green-100 text-green-700' },
  opened:    { label: 'Abierto',    className: 'bg-brand-100 text-brand-700' },
  clicked:   { label: 'Clicado',    className: 'bg-purple-100 text-purple-700' },
  replied:   { label: 'Respondido', className: 'bg-green-200 text-green-800' },
  bounced:   { label: 'Rebotado',   className: 'bg-red-100 text-red-700' },
  failed:    { label: 'Fallido',    className: 'bg-red-100 text-red-700' },
  spam:      { label: 'Spam',       className: 'bg-orange-100 text-orange-700' },
  delayed:   { label: 'Retrasado',  className: 'bg-amber-100 text-amber-700' },
  draft:     { label: 'Borrador',   className: 'bg-gray-100 text-gray-600' },
}

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })
}

function KpiCard({
  icon: Icon, label, value, sub, color, onClick, isActive, drillCount,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
  onClick?: () => void; isActive?: boolean; drillCount?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`card p-5 flex items-start gap-4 w-full text-left transition-all ${
        onClick ? 'hover:shadow-md hover:border-brand-300 cursor-pointer' : ''
      } ${isActive ? 'border-brand-400 bg-brand-50/30' : ''}`}
    >
      <div className={`p-2.5 rounded-xl ${color} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {onClick && drillCount !== undefined && drillCount > 0 && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isActive
            ? <ChevronUp className="w-4 h-4 text-brand-500" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
          <span className="text-xs text-gray-400">{drillCount}</span>
        </div>
      )}
    </button>
  )
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}%</span>
    </div>
  )
}

function MiniBar({ data }: { data: DailyRow[] }) {
  const max = Math.max(...data.map(d => d.sent), 1)
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map(d => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative"
          title={`${d.date}: ${d.sent} enviados, ${d.opened} abiertos, ${d.clicked} clics, ${d.replied} respondidos`}>
          <div className="w-full relative">
            <div className="w-full bg-brand-500 rounded-t transition-all" style={{ height: `${(d.sent / max) * 48}px` }} />
            <div className="w-full bg-blue-300 absolute bottom-0 rounded-t" style={{ height: `${(d.opened / max) * 48}px` }} />
            <div className="w-full bg-purple-400 absolute bottom-0 rounded-t" style={{ height: `${(d.clicked / max) * 48}px` }} />
            <div className="w-full bg-green-400 absolute bottom-0 rounded-t" style={{ height: `${(d.replied / max) * 48}px` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DrillDownPanel({ emails, emptyText, showRepliedAt }: { emails: EmailRow[]; emptyText: string; showRepliedAt?: boolean }) {
  if (emails.length === 0) {
    return <div className="py-6 text-center text-sm text-gray-400">{emptyText}</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/80">
          <tr>
            <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Empresa / Destinatario</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Asunto</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Cuenta envío</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Campaña</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Estado</th>
            {showRepliedAt
              ? <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Respondió</th>
              : <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Enviado</th>
            }
            <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Aperturas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {emails.map(email => {
            const cfg = STATUS_CONFIG[email.status] ?? { label: email.status, className: 'bg-gray-100 text-gray-600' }
            return (
              <tr key={email.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-2.5">
                  {email.lead_id ? (
                    <Link href={`/leads/${email.lead_id}`}
                      className="group flex items-center gap-1 hover:text-brand-600">
                      <div>
                        <p className="text-xs font-medium text-gray-900 group-hover:text-brand-600">
                          {email.company_name || email.to_name || '—'}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{email.to_email ?? ''}</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-brand-500 shrink-0" />
                    </Link>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-900">{email.to_name || email.to_email || '—'}</p>
                      {email.to_email && <p className="text-xs text-gray-400 font-mono">{email.to_email}</p>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-xs text-gray-600 truncate max-w-[200px]" title={email.subject}>{email.subject}</p>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-xs text-gray-400 font-mono truncate max-w-[150px]">{email.from_email}</p>
                </td>
                <td className="px-4 py-2.5">
                  {email.campaign_name ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{email.campaign_name}</span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.label}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-400 whitespace-nowrap">
                  {showRepliedAt ? fmt(email.replied_at) : fmtDate(email.sent_at)}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                  {email.open_count ? (
                    <span className="bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-medium">{email.open_count}×</span>
                  ) : (email.opened_at ? <span className="text-gray-400">1×</span> : <span className="text-gray-200">—</span>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Excel export ─────────────────────────────────────────────────────────────
function exportToExcel(params: {
  summary: Summary
  byAccount: AccountRow[]
  byCampaign: CampaignRow[]
  daily: DailyRow[]
  recentEmails: EmailRow[]
  drillDown: DrillDown
  days: number
}) {
  const { summary, byAccount, byCampaign, daily, recentEmails, drillDown, days } = params
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Resumen ──
  const summaryData = [
    ['Período', `Últimos ${days} días`],
    ['Fecha exportación', new Date().toLocaleString('es')],
    [],
    ['MÉTRICA', 'VALOR', 'TASA'],
    ['Emails enviados',   summary.total_sent,      '—'],
    ['Entregados',        summary.total_delivered,  `${summary.delivery_rate}%`],
    ['Abiertos',          summary.total_opened,     `${summary.open_rate}%`],
    ['Clics en enlaces',  summary.total_clicked,    `${summary.click_rate}%`],
    ['Respondidos',       summary.total_replied,    `${summary.reply_rate}%`],
    ['Rebotados',         summary.total_bounced,    `${summary.bounce_rate}%`],
    ['Fallidos',          summary.total_failed,     '—'],
    ['Spam',              summary.total_spam,       '—'],
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(summaryData)
  wsResumen['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ── Hoja 2: Por cuenta de envío ──
  const accountHeaders = ['Cuenta', 'Enviados', 'Abiertos', '% Apertura', 'Clics', '% Clics', 'Respondidos', '% Respuesta', 'Rebotados', '% Rebote']
  const accountRows = byAccount.map(r => [
    r.account, r.sent, r.opened, `${r.open_rate}%`, r.clicked, `${r.click_rate}%`,
    r.replied, `${r.reply_rate}%`, r.bounced, `${r.bounce_rate}%`
  ])
  const wsCuentas = XLSX.utils.aoa_to_sheet([accountHeaders, ...accountRows])
  wsCuentas['!cols'] = [{ wch: 32 }, ...Array(9).fill({ wch: 14 })]
  XLSX.utils.book_append_sheet(wb, wsCuentas, 'Por cuenta')

  // ── Hoja 3: Por campaña ──
  const campHeaders = ['Campaña', 'Enviados', 'Abiertos', '% Apertura', 'Clics', '% Clics', 'Respondidos', '% Respuesta', 'Rebotados', '% Rebote']
  const campRows = byCampaign.map(r => [
    r.name, r.sent, r.opened, `${r.open_rate}%`, r.clicked, `${r.click_rate}%`,
    r.replied, `${r.reply_rate}%`, r.bounced, `${r.bounce_rate}%`
  ])
  const wsCamp = XLSX.utils.aoa_to_sheet([campHeaders, ...campRows])
  wsCamp['!cols'] = [{ wch: 28 }, ...Array(9).fill({ wch: 14 })]
  XLSX.utils.book_append_sheet(wb, wsCamp, 'Por campaña')

  // ── Hoja 4: Evolución diaria ──
  const dailyHeaders = ['Fecha', 'Enviados', 'Abiertos', 'Clics', 'Respondidos', 'Rebotados']
  const dailyRows = daily.map(r => [r.date, r.sent, r.opened, r.clicked, r.replied, r.bounced])
  const wsDaily = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows])
  wsDaily['!cols'] = [{ wch: 14 }, ...Array(5).fill({ wch: 14 })]
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Evolución diaria')

  // ── Hoja 5: Respondidos ──
  const repliedHeaders = ['Empresa', 'Email destinatario', 'Asunto', 'Cuenta envío', 'Campaña', 'Fecha envío', 'Fecha respuesta', 'Aperturas']
  const repliedRows = drillDown.replied.map(e => [
    e.company_name || e.to_name || '',
    e.to_email || '',
    e.subject,
    e.from_email,
    e.campaign_name || '',
    e.sent_at ? new Date(e.sent_at).toLocaleString('es') : '',
    e.replied_at ? new Date(e.replied_at).toLocaleString('es') : '',
    e.open_count ?? (e.opened_at ? 1 : 0),
  ])
  const wsReplied = XLSX.utils.aoa_to_sheet([repliedHeaders, ...repliedRows])
  wsReplied['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 36 }, { wch: 28 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsReplied, 'Respondidos')

  // ── Hoja 6: Rebotados ──
  const bouncedHeaders = ['Empresa', 'Email destinatario', 'Asunto', 'Cuenta envío', 'Campaña', 'Fecha envío']
  const bouncedRows = drillDown.bounced.map(e => [
    e.company_name || e.to_name || '',
    e.to_email || '',
    e.subject,
    e.from_email,
    e.campaign_name || '',
    e.sent_at ? new Date(e.sent_at).toLocaleString('es') : '',
  ])
  const wsBounced = XLSX.utils.aoa_to_sheet([bouncedHeaders, ...bouncedRows])
  wsBounced['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 36 }, { wch: 28 }, { wch: 24 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsBounced, 'Rebotados')

  // ── Hoja 7: Todos los emails ──
  const allHeaders = ['Empresa', 'Email dest.', 'Asunto', 'Cuenta envío', 'Campaña', 'Estado', 'Fecha envío', 'Fecha apertura', 'Fecha clic', 'Fecha respuesta', 'Nº aperturas', 'Nº clics']
  const allRows = recentEmails.map(e => [
    e.company_name || e.to_name || '',
    e.to_email || '',
    e.subject,
    e.from_email,
    e.campaign_name || '',
    e.status,
    e.sent_at    ? new Date(e.sent_at).toLocaleString('es')    : '',
    e.opened_at  ? new Date(e.opened_at).toLocaleString('es')  : '',
    e.clicked_at ? new Date(e.clicked_at).toLocaleString('es') : '',
    e.replied_at ? new Date(e.replied_at).toLocaleString('es') : '',
    e.open_count  ?? '',
    e.click_count ?? '',
  ])
  const wsAll = XLSX.utils.aoa_to_sheet([allHeaders, ...allRows])
  wsAll['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 36 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, ...Array(6).fill({ wch: 20 })]
  XLSX.utils.book_append_sheet(wb, wsAll, 'Todos los emails')

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `analytics-emails-${date}.xlsx`)
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [byAccount, setByAccount] = useState<AccountRow[]>([])
  const [byCampaign, setByCampaign] = useState<CampaignRow[]>([])
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [recentEmails, setRecentEmails] = useState<EmailRow[]>([])
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState<'bounced' | 'opened' | 'clicked' | 'replied' | 'failed' | 'spam' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/analytics?days=${days}`)
    const json = await res.json()
    if (json.data) {
      setSummary(json.data.summary)
      setByAccount(json.data.by_account)
      setByCampaign(json.data.by_campaign)
      setDaily(json.data.daily)
      setRecentEmails(json.data.recent_emails)
      setDrillDown(json.data.drill_down ?? null)
    }
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  const togglePanel = (panel: typeof activePanel) => {
    setActivePanel(prev => prev === panel ? null : panel)
  }

  const handleExport = () => {
    if (!summary || !drillDown) return
    exportToExcel({ summary, byAccount, byCampaign, daily, recentEmails, drillDown, days })
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Analíticas"
        subtitle="Rendimiento de emails, aperturas, clics y respuestas"
        actions={
          <div className="flex items-center gap-2">
            <select
              className="input text-xs w-36 py-1.5"
              value={days}
              onChange={e => setDays(Number(e.target.value))}
            >
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={60}>Últimos 60 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>
            <button onClick={load} className="btn-secondary text-xs py-1.5" disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
            {summary && (
              <button onClick={handleExport} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Exportar Excel
              </button>
            )}
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {loading && !summary ? (
          <div className="card p-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando analíticas...</p>
          </div>
        ) : summary ? (
          <>
            {/* KPIs — fila 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={Mail} label="Emails enviados" value={summary.total_sent}
                sub={`${summary.delivery_rate}% entregados`} color="bg-brand-100 text-brand-700"
              />
              <KpiCard
                icon={MailOpen} label="Aperturas" value={summary.total_opened}
                sub={`${summary.open_rate}% tasa`} color="bg-blue-100 text-blue-700"
                onClick={() => togglePanel('opened')}
                isActive={activePanel === 'opened'}
                drillCount={drillDown?.opened.length}
              />
              <KpiCard
                icon={MousePointerClick} label="Clics en links" value={summary.total_clicked}
                sub={`${summary.click_rate}% tasa`} color="bg-purple-100 text-purple-700"
                onClick={() => togglePanel('clicked')}
                isActive={activePanel === 'clicked'}
                drillCount={drillDown?.clicked.length}
              />
              <KpiCard
                icon={MessageSquareReply} label="Respuestas" value={summary.total_replied}
                sub={`${summary.reply_rate}% tasa`} color="bg-green-100 text-green-700"
                onClick={() => togglePanel('replied')}
                isActive={activePanel === 'replied'}
                drillCount={drillDown?.replied.length}
              />
            </div>

            {/* KPIs — fila 2 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={CheckCircle2} label="Entregados" value={summary.total_delivered}
                sub={`${summary.delivery_rate}%`} color="bg-teal-100 text-teal-700"
              />
              <KpiCard
                icon={AlertTriangle} label="Rebotes" value={summary.total_bounced}
                sub={`${summary.bounce_rate}% tasa`} color="bg-red-100 text-red-600"
                onClick={() => togglePanel('bounced')}
                isActive={activePanel === 'bounced'}
                drillCount={drillDown?.bounced.length}
              />
              <KpiCard
                icon={XCircle} label="Fallidos" value={summary.total_failed}
                sub="Sin entregar" color="bg-gray-100 text-gray-600"
                onClick={() => togglePanel('failed')}
                isActive={activePanel === 'failed'}
                drillCount={drillDown?.failed.length}
              />
              <KpiCard
                icon={ShieldAlert} label="Marcados spam" value={summary.total_spam}
                sub="Complaints" color="bg-orange-100 text-orange-700"
                onClick={drillDown?.spam.length ? () => togglePanel('spam') : undefined}
                isActive={activePanel === 'spam'}
                drillCount={drillDown?.spam.length}
              />
            </div>

            {/* Panel de drill-down expandible */}
            {activePanel && drillDown && (
              <div className="card overflow-hidden border-brand-200">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {activePanel === 'bounced'  && <><AlertTriangle className="w-4 h-4 text-red-500"    /><span className="text-sm font-semibold text-gray-900">Emails rebotados</span></>}
                    {activePanel === 'opened'   && <><MailOpen className="w-4 h-4 text-blue-500"         /><span className="text-sm font-semibold text-gray-900">Emails abiertos</span></>}
                    {activePanel === 'clicked'  && <><MousePointerClick className="w-4 h-4 text-purple-500" /><span className="text-sm font-semibold text-gray-900">Clics en enlaces</span></>}
                    {activePanel === 'replied'  && <><MessageSquareReply className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold text-gray-900">Emails respondidos</span></>}
                    {activePanel === 'failed'   && <><AlertCircle className="w-4 h-4 text-red-500"      /><span className="text-sm font-semibold text-gray-900">Emails fallidos</span></>}
                    {activePanel === 'spam'     && <><ShieldAlert className="w-4 h-4 text-orange-500"   /><span className="text-sm font-semibold text-gray-900">Marcados como spam</span></>}
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                      {drillDown[activePanel].length} emails
                    </span>
                  </div>
                  <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
                {activePanel === 'bounced' && (
                  <div className="px-5 py-3 bg-red-50 border-b border-red-100 text-xs text-red-700">
                    <strong>⚠️ Sobre los rebotes:</strong> Los hard bounces indican dirección email inválida. Considera actualizar o eliminar estos leads. Los soft bounces pueden ser temporales (buzón lleno, servidor caído).
                  </div>
                )}
                {activePanel === 'spam' && (
                  <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 text-xs text-orange-700">
                    <strong>⚠️ Complaints de spam:</strong> Si acumulas muchos complaints Resend puede suspender el envío. Revisa si el lead dio consentimiento y elimínalo de futuras campañas.
                  </div>
                )}
                <DrillDownPanel
                  emails={drillDown[activePanel]}
                  showRepliedAt={activePanel === 'replied'}
                  emptyText={
                    activePanel === 'bounced'  ? '✅ Sin rebotes en este período.' :
                    activePanel === 'opened'   ? 'Sin aperturas registradas en este período.' :
                    activePanel === 'clicked'  ? 'Sin clics en enlaces en este período.' :
                    activePanel === 'replied'  ? 'Sin respuestas en este período.' :
                    activePanel === 'spam'     ? '✅ Sin complaints de spam en este período.' :
                    'Sin emails fallidos en este período.'
                  }
                />
              </div>
            )}

            {/* Tasas + gráfico */}
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Tasas de rendimiento</h3>
                <div className="space-y-3">
                  <RateBar label="Entregados"   value={summary.delivery_rate} color="bg-brand-500" />
                  <RateBar label="Abiertos"     value={summary.open_rate}     color="bg-blue-500" />
                  <RateBar label="Clics"        value={summary.click_rate}    color="bg-purple-500" />
                  <RateBar label="Respondidos"  value={summary.reply_rate}    color="bg-green-500" />
                  <RateBar label="Rebotados"    value={summary.bounce_rate}   color="bg-red-400" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" /> {summary.total_delivered} entregados
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-400" />
                    <button onClick={() => togglePanel('failed')} className="hover:text-red-500 transition-colors">
                      {summary.total_failed} fallidos
                    </button>
                  </span>
                  {summary.total_spam > 0 && (
                    <span className="flex items-center gap-1 col-span-2">
                      <ShieldAlert className="w-3 h-3 text-orange-400" />
                      <button onClick={() => togglePanel('spam')} className="hover:text-orange-500 transition-colors">
                        {summary.total_spam} spam
                      </button>
                    </span>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Envíos por día</h3>
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Enviados</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-300 inline-block" /> Abiertos</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400 inline-block" /> Clics</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Respondidos</span>
                </div>
                {daily.length > 0 ? <MiniBar data={daily} /> : (
                  <p className="text-xs text-gray-400 py-6 text-center">Sin datos en este período</p>
                )}
                <div className="flex justify-between mt-1 text-xs text-gray-300">
                  <span>{daily[0]?.date.slice(5)}</span>
                  <span>{daily[daily.length - 1]?.date.slice(5)}</span>
                </div>
              </div>
            </div>

            {/* Por cuenta remitente */}
            {byAccount.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Rendimiento por cuenta de envío</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Cuenta</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Enviados</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Abiertos</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">% Apertura</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Clics</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">% Clics</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Respondidos</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">% Respuesta</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Rebotes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {byAccount.map(row => (
                        <tr key={row.account} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-mono text-xs text-gray-700">{row.account}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.sent}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.opened}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row.open_rate >= 30 ? 'bg-green-100 text-green-700' :
                              row.open_rate >= 15 ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{row.open_rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.clicked}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row.click_rate >= 5 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                            }`}>{row.click_rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.replied}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row.reply_rate >= 10 ? 'bg-green-100 text-green-700' :
                              row.reply_rate >= 5  ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{row.reply_rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.bounced > 0 ? (
                              <button onClick={() => togglePanel('bounced')}
                                className="text-xs text-red-500 font-semibold hover:text-red-700 hover:underline">
                                {row.bounced}
                              </button>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Por campaña */}
            {byCampaign.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Rendimiento por campaña</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Campaña</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Enviados</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Abiertos</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">% Apertura</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Clics</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Respondidos</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">% Respuesta</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Rebotes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {byCampaign.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{row.name}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.sent}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.opened}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row.open_rate >= 30 ? 'bg-green-100 text-green-700' :
                              row.open_rate >= 15 ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{row.open_rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.clicked}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.replied}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row.reply_rate >= 10 ? 'bg-green-100 text-green-700' :
                              row.reply_rate >= 5  ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{row.reply_rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.bounced > 0 ? (
                              <span className="text-xs text-red-500 font-semibold">{row.bounced}</span>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Emails recientes */}
            {recentEmails.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Últimos emails enviados</h3>
                  <span className="text-xs text-gray-400">{recentEmails.length} emails</span>
                </div>
                <DrillDownPanel emails={recentEmails} emptyText="Sin emails en este período" />
              </div>
            )}

            {summary.total_sent === 0 && (
              <div className="card p-10 text-center text-gray-400">
                <Mail className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">No hay emails enviados en los últimos {days} días.</p>
                <p className="text-xs mt-1">Ve a un lead y envía o lanza una secuencia para empezar.</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
