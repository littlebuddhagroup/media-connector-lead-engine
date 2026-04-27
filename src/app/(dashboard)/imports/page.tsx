'use client'

import { useState, useCallback, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Upload, FileText, AlertCircle, CheckCircle, X, ArrowRight } from 'lucide-react'
import Papa from 'papaparse'
import type { Campaign } from '@/types'

const LEAD_FIELDS = [
  { key: 'company_name', label: 'Nombre empresa', required: true },
  { key: 'website', label: 'Web' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'country', label: 'País' },
  { key: 'city', label: 'Ciudad' },
  { key: 'sector', label: 'Sector' },
  { key: 'description', label: 'Descripción' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
]

type ParsedRow = Record<string, string>

export default function ImportsPage() {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'result'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [campaignId, setCampaignId] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{total: number; imported: number; skipped: number; errors: Array<{row: number; message: string}>} | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(j => setCampaigns(j.data ?? []))
  }, [])

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { alert('Solo se aceptan archivos CSV'); return }
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as ParsedRow[]
        const hdrs = result.meta.fields ?? []
        setRows(data)
        setHeaders(hdrs)
        // Auto-mapeo inteligente
        const autoMap: Record<string, string> = {}
        LEAD_FIELDS.forEach(field => {
          const match = hdrs.find(h =>
            h.toLowerCase().includes(field.key.toLowerCase()) ||
            h.toLowerCase().includes(field.label.toLowerCase()) ||
            (field.key === 'company_name' && (h.toLowerCase().includes('empresa') || h.toLowerCase().includes('company') || h.toLowerCase().includes('nombre'))) ||
            (field.key === 'email' && h.toLowerCase().includes('email')) ||
            (field.key === 'website' && (h.toLowerCase().includes('web') || h.toLowerCase().includes('url') || h.toLowerCase().includes('site')))
          )
          if (match) autoMap[field.key] = match
        })
        setMapping(autoMap)
        setStep('map')
      },
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const handleImport = async () => {
    setImporting(true)
    const res = await fetch('/api/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows,
        column_mapping: mapping,
        campaign_id: campaignId || null,
        filename: fileName,
      }),
    })
    const json = await res.json()
    setImporting(false)
    if (res.ok) {
      setResult(json.data)
      setStep('result')
    } else {
      alert(json.error)
    }
  }

  const previewRows = rows.slice(0, 5)

  return (
    <div className="animate-fade-in">
      <TopBar title="Importar leads CSV" subtitle="Sube tu CSV y mapea las columnas" />

      <div className="p-6 max-w-3xl">
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {(['upload','map','preview','result'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
                step === s ? 'bg-brand-600 text-white' :
                ['upload','map','preview','result'].indexOf(step) > i ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>{i + 1}</div>
              <span className={step === s ? 'text-brand-700 font-medium' : 'text-gray-500'}>
                {s === 'upload' ? 'Subir CSV' : s === 'map' ? 'Mapear columnas' : s === 'preview' ? 'Vista previa' : 'Resultado'}
              </span>
              {i < 3 && <ArrowRight className="w-3 h-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div
            className={`card border-2 border-dashed transition-colors cursor-pointer ${
              dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-brand-300'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('csv-file')?.click()}
          >
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-brand-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Arrastra tu CSV aquí o haz clic
              </h3>
              <p className="text-sm text-gray-500">Solo archivos .csv</p>
              <p className="text-xs text-gray-400 mt-2">
                Columnas sugeridas: empresa, web, email, teléfono, país, sector
              </p>
            </div>
            <input
              id="csv-file" type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        )}

        {/* STEP 2: Mapear columnas */}
        {step === 'map' && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-brand-500" />
                <span className="text-sm font-medium text-gray-700">{fileName}</span>
                <span className="text-xs text-gray-400">({rows.length} filas)</span>
              </div>

              <div>
                <label className="label">Campaña destino (opcional)</label>
                <select className="input mb-4" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                  <option value="">Sin campaña</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Mapear columnas CSV → campos del lead
              </h4>
              <div className="space-y-2">
                {LEAD_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-36 shrink-0">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                    <select
                      className="input flex-1 text-sm"
                      value={mapping[field.key] ?? ''}
                      onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      <option value="">— No mapear —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {mapping[field.key] && (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="btn-secondary text-xs">← Volver</button>
              <button
                onClick={() => setStep('preview')}
                disabled={!mapping.company_name}
                className="btn-primary text-xs"
              >
                Vista previa →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Vista previa */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Vista previa (primeras 5 filas)</h3>
                <span className="text-xs text-gray-500">{rows.length} filas totales</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {LEAD_FIELDS.filter(f => mapping[f.key]).map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {LEAD_FIELDS.filter(f => mapping[f.key]).map(f => (
                          <td key={f.key} className="px-3 py-2 text-gray-700 max-w-[150px] truncate">
                            {row[mapping[f.key]] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-medium">Antes de importar:</p>
                <p>Se detectarán duplicados por dominio y email. Las filas duplicadas serán omitidas.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('map')} className="btn-secondary text-xs">← Volver</button>
              <button onClick={handleImport} disabled={importing} className="btn-primary text-xs">
                {importing ? `Importando ${rows.length} leads...` : `Importar ${rows.length} leads →`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Resultado */}
        {step === 'result' && result && (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">¡Importación completada!</h3>

            <div className="grid grid-cols-3 gap-4 my-6">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                <p className="text-xs text-gray-500">Total filas</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                <p className="text-xs text-gray-500">Importados</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <p className="text-2xl font-bold text-orange-700">{result.skipped}</p>
                <p className="text-xs text-gray-500">Omitidos</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="text-left mb-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Errores ({result.errors.length})
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-600">
                      <X className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Fila {err.row}: {err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setStep('upload'); setRows([]); setHeaders([]); setMapping({}); setResult(null) }}
                className="btn-secondary text-xs"
              >
                Nueva importación
              </button>
              <a href="/leads" className="btn-primary text-xs">Ver leads →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
