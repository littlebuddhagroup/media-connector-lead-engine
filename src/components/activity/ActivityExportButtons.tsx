'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

const EVENT_LABELS: Record<string, string> = {
  email_sent:        'Email enviado',
  email_opened:      'Email abierto',
  email_clicked:     'Click en email',
  email_bounced:     'Email rebotado',
  email_replied:     'Email respondido',
  reply_detected:    'Respuesta detectada',
  sequence_replied:  'Secuencia — respuesta',
  enriched:          'Lead enriquecido',
  lead_created:      'Lead creado',
  imported:          'Lead importado',
  note_added:        'Nota añadida',
  task_completed:    'Tarea completada',
  status_changed:    'Estado cambiado',
  campaign_assigned: 'Asignado a campaña',
}

interface ActivityRow {
  id: string
  type: string
  title: string
  description?: string
  created_at: string
  lead_name?: string
  campaign_name?: string
}

interface ExportData {
  data: ActivityRow[]
  summary: Record<string, number>
  total: number
  days: number
}

async function fetchExportData(filter: string, days: number): Promise<ExportData | null> {
  const res = await fetch(`/api/activity/export?filter=${encodeURIComponent(filter)}&days=${days}`)
  if (!res.ok) return null
  return res.json()
}

function exportToPDF(exportData: ExportData) {
  const { data, summary, days } = exportData
  const totalEvents = data.length

  // Contar tipos específicos
  const emailSent    = summary['email_sent']    ?? 0
  const emailOpened  = summary['email_opened']  ?? 0
  const emailClicked = summary['email_clicked'] ?? 0
  const emailReplied = (summary['email_replied'] ?? 0) + (summary['reply_detected'] ?? 0) + (summary['sequence_replied'] ?? 0)
  const seqActive    = summary['email_sent']    ?? 0  // proxy
  const seqCompleted = summary['sequence_replied'] ?? 0

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Informe de Actividad — MyMediaConnect</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#fff; color:#1a1a1a; padding:32px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #6c47ff; }
  .logo { font-size:20px; font-weight:800; color:#6c47ff; letter-spacing:-0.5px; }
  .period { font-size:12px; color:#888; margin-top:4px; }
  .meta { text-align:right; font-size:12px; color:#999; }
  h2 { font-size:14px; font-weight:700; color:#374151; margin:24px 0 12px; padding-bottom:6px; border-bottom:1px solid #e5e7eb; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
  .kpi { background:#f8f7ff; border:1px solid #e8e4ff; border-radius:12px; padding:16px; }
  .kpi-val { font-size:28px; font-weight:800; color:#6c47ff; line-height:1; }
  .kpi-label { font-size:11px; color:#6b7280; margin-top:4px; }
  .summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:24px; }
  .summary-card { border:1px solid #e5e7eb; border-radius:8px; padding:10px 14px; }
  .summary-card-label { font-size:11px; color:#6b7280; }
  .summary-card-val { font-size:18px; font-weight:700; color:#374151; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#6c47ff; color:#fff; padding:8px 10px; text-align:left; font-weight:600; }
  tr:nth-child(even) { background:#f8f7ff; }
  td { padding:7px 10px; border-bottom:1px solid #ede9ff; }
  .footer { margin-top:28px; text-align:center; font-size:11px; color:#bbb; padding-top:14px; border-top:1px solid #e5e7eb; }
  @media print { body { padding:16px; } }
</style>
</head><body>

<div class="header">
  <div>
    <div class="logo">📊 MyMediaConnect · Informe de Actividad</div>
    <div class="period">Período: últimos ${days} días · ${new Date().toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' })}</div>
  </div>
  <div class="meta">Generado: ${new Date().toLocaleString('es-ES')}</div>
</div>

<h2>📧 Resumen de emails</h2>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${emailSent}</div><div class="kpi-label">Emails enviados</div></div>
  <div class="kpi"><div class="kpi-val">${emailOpened}</div><div class="kpi-label">Emails abiertos</div></div>
  <div class="kpi"><div class="kpi-val">${emailClicked}</div><div class="kpi-label">Clics en emails</div></div>
  <div class="kpi"><div class="kpi-val">${emailReplied}</div><div class="kpi-label">Respondidos</div></div>
</div>

<h2>📋 Resumen por tipo de evento</h2>
<div class="summary-grid">
  ${Object.entries(summary).sort((a,b)=>b[1]-a[1]).map(([type, count]) => `
  <div class="summary-card">
    <div class="summary-card-label">${EVENT_LABELS[type] ?? type}</div>
    <div class="summary-card-val">${count}</div>
  </div>`).join('')}
</div>

<h2>🗓️ Historial de actividad (${totalEvents} eventos)</h2>
<table>
<thead><tr>
  <th>Fecha</th><th>Tipo</th><th>Título</th><th>Lead / Empresa</th><th>Campaña</th><th>Descripción</th>
</tr></thead>
<tbody>
${data.slice(0, 500).map(row => `<tr>
  <td style="white-space:nowrap">${new Date(row.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
  <td style="white-space:nowrap"><span style="font-size:10px;background:#ede9fe;color:#6d28d9;padding:2px 6px;border-radius:99px">${EVENT_LABELS[row.type] ?? row.type}</span></td>
  <td>${row.title ?? ''}</td>
  <td>${row.lead_name ?? ''}</td>
  <td>${row.campaign_name ?? ''}</td>
  <td style="color:#6b7280;font-size:10px">${row.description ?? ''}</td>
</tr>`).join('')}
</tbody>
</table>
${data.length > 500 ? `<p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:8px">Mostrando los primeros 500 de ${data.length} eventos. Usa Excel para el listado completo.</p>` : ''}

<div class="footer">MyMediaConnect · Informe generado automáticamente · ${new Date().toLocaleString('es-ES')}</div>
</body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600) }
}

async function exportToExcel(exportData: ExportData) {
  const XLSX = await import('xlsx')
  const { data, summary, days } = exportData
  const wb = XLSX.utils.book_new()

  // Hoja 1: Resumen
  const summaryRows = [
    ['Período', `Últimos ${days} días`],
    ['Fecha exportación', new Date().toLocaleString('es')],
    ['Total eventos', data.length],
    [],
    ['TIPO DE EVENTO', 'TOTAL'],
    ...Object.entries(summary).sort((a,b)=>b[1]-a[1]).map(([type, count]) => [EVENT_LABELS[type] ?? type, count]),
    [],
    ['── EMAILS ──', ''],
    ['Enviados',    summary['email_sent']    ?? 0],
    ['Abiertos',   summary['email_opened']  ?? 0],
    ['Clicados',   summary['email_clicked'] ?? 0],
    ['Respondidos', (summary['email_replied'] ?? 0) + (summary['reply_detected'] ?? 0) + (summary['sequence_replied'] ?? 0)],
    ['── LEADS ──', ''],
    ['Creados',    summary['lead_created']  ?? 0],
    ['Importados', summary['imported']      ?? 0],
    ['Enriquecidos', summary['enriched']    ?? 0],
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(summaryRows)
  wsResumen['!cols'] = [{ wch: 26 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Hoja 2: Actividad completa
  const headers = ['Fecha', 'Hora', 'Tipo', 'Título', 'Lead / Empresa', 'Campaña', 'Descripción']
  const rows = data.map(row => {
    const d = new Date(row.created_at)
    return [
      d.toLocaleDateString('es-ES'),
      d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      EVENT_LABELS[row.type] ?? row.type,
      row.title ?? '',
      row.lead_name ?? '',
      row.campaign_name ?? '',
      row.description ?? '',
    ]
  })
  const wsActivity = XLSX.utils.aoa_to_sheet([headers, ...rows])
  wsActivity['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 40 }, { wch: 26 }, { wch: 26 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsActivity, 'Actividad completa')

  // Hoja 3: Solo emails
  const emailEvents = data.filter(r => r.type.startsWith('email_') || r.type.includes('reply'))
  if (emailEvents.length > 0) {
    const emailHeaders = ['Fecha', 'Tipo email', 'Asunto / Título', 'Lead / Empresa', 'Campaña']
    const emailRows = emailEvents.map(row => {
      const d = new Date(row.created_at)
      return [
        d.toLocaleString('es-ES'),
        EVENT_LABELS[row.type] ?? row.type,
        row.title ?? '',
        row.lead_name ?? '',
        row.campaign_name ?? '',
      ]
    })
    const wsEmails = XLSX.utils.aoa_to_sheet([emailHeaders, ...emailRows])
    wsEmails['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 26 }, { wch: 26 }]
    XLSX.utils.book_append_sheet(wb, wsEmails, 'Emails')
  }

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `actividad-${date}.xlsx`)
}

interface Props {
  filter: string
  totalCount: number
}

export default function ActivityExportButtons({ filter, totalCount }: Props) {
  const [days, setDays] = useState(90)
  const [loadingPDF, setLoadingPDF] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  const handlePDF = async () => {
    setLoadingPDF(true)
    const d = await fetchExportData(filter, days)
    setLoadingPDF(false)
    if (d) exportToPDF(d)
  }

  const handleExcel = async () => {
    setLoadingExcel(true)
    const d = await fetchExportData(filter, days)
    setLoadingExcel(false)
    if (d) await exportToExcel(d)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={days}
        onChange={e => setDays(Number(e.target.value))}
        className="input text-xs w-32 py-1.5"
        title="Período para exportar"
      >
        <option value={30}>30 días</option>
        <option value={60}>60 días</option>
        <option value={90}>90 días</option>
        <option value={180}>6 meses</option>
        <option value={365}>1 año</option>
      </select>
      <button
        onClick={handleExcel}
        disabled={loadingExcel || totalCount === 0}
        className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"
        title="Exportar actividad a Excel"
      >
        {loadingExcel
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
          : <><Download className="w-3.5 h-3.5" /> Excel</>
        }
      </button>
      <button
        onClick={handlePDF}
        disabled={loadingPDF || totalCount === 0}
        className="btn-primary text-xs py-1.5 flex items-center gap-1.5"
        title="Exportar informe PDF ejecutivo"
      >
        {loadingPDF
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
          : <><Download className="w-3.5 h-3.5" /> PDF Ejecutivo</>
        }
      </button>
    </div>
  )
}
