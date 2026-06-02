'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Upload, FileText, AlertCircle, CheckCircle, X, ArrowRight, FileSpreadsheet, Info } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import Papa from 'papaparse'
import type { Campaign } from '@/types'

const LEAD_FIELDS = [
  { key: 'company_name', label: 'Nombre empresa', required: true },
  { key: 'first_name', label: 'Nombre (contacto)' },
  { key: 'last_name', label: 'Apellidos (contacto)' },
  { key: 'website', label: 'Web' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'country', label: 'País' },
  { key: 'city', label: 'Ciudad' },
  { key: 'sector', label: 'Sector' },
  { key: 'description', label: 'Descripción' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
]

const MAX_ROWS = 5000

type ParsedRow = Record<string, string>
type FileType = 'csv' | 'xlsx'

function ImportsPageContent() {
  const searchParams = useSearchParams()
  const listIdFromUrl = searchParams.get('list') ?? ''
  const listNameFromUrl = searchParams.get('listName') ?? ''
  const campaignIdFromUrl = searchParams.get('campaign') ?? ''

  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'result'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState<FileType>('csv')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [campaignId, setCampaignId] = useState(campaignIdFromUrl)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    total: number; imported: number; skipped: number
    errors: Array<{row: number; message: string}>
  } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [rowWarning, setRowWarning] = useState(false)

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(j => setCampaigns(j.data ?? []))
  }, [])

  // ─── Auto-mapeo inteligente ──────────────────────────────────
  const buildAutoMap = (hdrs: string[]) => {
    const autoMap: Record<string, string> = {}
    LEAD_FIELDS.forEach(field => {
      const match = hdrs.find(h => {
        const hl = h.toLowerCase()
        return (
          hl.includes(field.key.toLowerCase()) ||
          hl.includes(field.label.toLowerCase()) ||
          (field.key === 'company_name' && (hl.includes('empresa') || hl.includes('company') || hl === 'nombre')) ||
          (field.key === 'first_name' && (hl === 'nombre' || hl === 'first_name' || hl === 'firstname' || hl === 'nombre contacto' || hl === 'nombre_contacto' || hl === 'first name' || hl === 'prénom')) ||
          (field.key === 'last_name' && (hl === 'apellidos' || hl === 'apellido' || hl === 'last_name' || hl === 'lastname' || hl === 'last name' || hl === 'nom')) ||
          (field.key === 'email' && hl.includes('mail')) ||
          (field.key === 'website' && (hl.includes('web') || hl.includes('url') || hl.includes('site') || hl.includes('dominio'))) ||
          (field.key === 'phone' && (hl.includes('tel') || hl.includes('phone') || hl.includes('móvil'))) ||
          (field.key === 'country' && (hl.includes('país') || hl.includes('pais') || hl.includes('country'))) ||
          (field.key === 'sector' && (hl.includes('sector') || hl.includes('industria') || hl.includes('industry')))
        )
      })
      if (match) autoMap[field.key] = match
    })
    return autoMap
  }

  // ─── Procesar CSV ────────────────────────────────────────────
  const handleCSV = (file: File) => {
    setFileType('csv')
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        let data = result.data as ParsedRow[]
        const hdrs = result.meta.fields ?? []
        const truncated = data.length > MAX_ROWS
        if (truncated) {
          data = data.slice(0, MAX_ROWS)
          setRowWarning(true)
        } else {
          setRowWarning(false)
        }
        setRows(data)
        setHeaders(hdrs)
        setMapping(buildAutoMap(hdrs))
        setStep('map')
      },
    })
  }

  // ─── Procesar Excel ──────────────────────────────────────────
  const handleExcel = async (file: File) => {
    setFileType('xlsx')
    setFileName(file.name)
    try {
      // Import dinámico para no añadir peso al bundle inicial
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      // Usar la primera hoja
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      // Convertir a JSON con cabeceras
      let data: ParsedRow[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false,
      })

      const hdrs = data.length > 0 ? Object.keys(data[0]) : []
      const truncated = data.length > MAX_ROWS
      if (truncated) {
        data = data.slice(0, MAX_ROWS)
        setRowWarning(true)
      } else {
        setRowWarning(false)
      }

      setRows(data)
      setHeaders(hdrs)
      setMapping(buildAutoMap(hdrs))
      setStep('map')
    } catch {
      toast.error('Error al leer Excel', 'Asegúrate de que el archivo no está protegido con contraseña.')
    }
  }

  // ─── Dispatcher de archivo ───────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith('.csv')) {
      handleCSV(file)
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      handleExcel(file)
    } else {
      toast.warning('Formato no válido', 'Solo se aceptan archivos .csv, .xlsx o .xls')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ─── Importar ────────────────────────────────────────────────
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
        list_id: listIdFromUrl || null,
      }),
    })
    const json = await res.json()
    setImporting(false)
    if (res.ok) {
      setResult(json.data)
      setStep('result')
    } else {
      toast.error('Error al importar', json.error || 'Inténtalo de nuevo.')
    }
  }

  const previewRows = rows.slice(0, 5)

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Importar leads"
        subtitle="Sube un archivo CSV o Excel y mapea las columnas"
      />

      <div className="p-6 max-w-3xl">
        {/* Contexto de lista */}
        {listIdFromUrl && (
          <div className="mb-4 p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-800 flex items-center gap-2">
            <span className="text-base">📋</span>
            <span>Los leads importados se añadirán automáticamente a la lista <strong>{listNameFromUrl || listIdFromUrl}</strong>.</span>
          </div>
        )}
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {(['upload', 'map', 'preview', 'result'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
                step === s ? 'bg-brand-600 text-white' :
                ['upload', 'map', 'preview', 'result'].indexOf(step) > i ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>{i + 1}</div>
              <span className={step === s ? 'text-brand-700 font-medium' : 'text-gray-500'}>
                {s === 'upload' ? 'Subir archivo' : s === 'map' ? 'Mapear columnas' : s === 'preview' ? 'Vista previa' : 'Resultado'}
              </span>
              {i < 3 && <ArrowRight className="w-3 h-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Zona drag & drop */}
            <div
              className={`card border-2 border-dashed transition-colors cursor-pointer ${
                dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-brand-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('import-file')?.click()}
            >
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-gray-300 text-2xl font-light">|</div>
                  <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-green-500" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  Arrastra tu archivo aquí o haz clic
                </h3>
                <p className="text-sm text-gray-500">Formatos aceptados: <span className="font-medium">.csv</span> y <span className="font-medium">.xlsx / .xls</span></p>
                <p className="text-xs text-gray-400 mt-2">
                  Máximo {MAX_ROWS.toLocaleString()} filas por importación
                </p>
              </div>
              <input
                id="import-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>

            {/* Info límite */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Límite de <strong>{MAX_ROWS.toLocaleString()} filas</strong> por importación.
                Para volúmenes mayores, divide el archivo en varias importaciones.
                Los duplicados (mismo dominio o email) se detectan y omiten automáticamente.
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Mapear columnas */}
        {step === 'map' && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                {fileType === 'xlsx'
                  ? <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  : <FileText className="w-4 h-4 text-brand-500" />
                }
                <span className="text-sm font-medium text-gray-700">{fileName}</span>
                <span className="text-xs text-gray-400">({rows.length} filas)</span>
                {rowWarning && (
                  <span className="ml-auto text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Truncado a {MAX_ROWS.toLocaleString()} filas
                  </span>
                )}
              </div>

              <div>
                <label className="label">Campaña destino (opcional)</label>
                <select className="input mb-4" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                  <option value="">Sin campaña</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Mapear columnas del archivo → campos del lead
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
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="odd:bg-white even:bg-indigo-50/30">
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

            {rowWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                El archivo tenía más de {MAX_ROWS.toLocaleString()} filas. Solo se importarán las primeras {rows.length.toLocaleString()}.
              </div>
            )}

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-medium">Antes de importar:</p>
                <p>Se detectarán duplicados por dominio y email. Las filas duplicadas serán omitidas automáticamente.</p>
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
                onClick={() => { setStep('upload'); setRows([]); setHeaders([]); setMapping({}); setResult(null); setRowWarning(false) }}
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

export default function ImportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Cargando...</div>}>
      <ImportsPageContent />
    </Suspense>
  )
}
