// ============================================================
// DEMO BRIEF — One-pager HTML generado con IA para un lead
// GET /api/leads/[id]/demo-brief
//
// Genera un documento HTML imprimible con análisis completo:
//   · Perfil empresa + datos de contacto
//   · Historial de interacciones y estado de secuencia
//   · Artwork Gap Analysis (4 dimensiones de riesgo)
//   · Análisis IA: talking points, objeciones, contexto competitivo
//   · Módulos recomendados + ROI personalizado
//   · CTA listo para imprimir / guardar como PDF
//
// Accesible por todos los miembros del equipo (RLS via get_team_user_ids)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAISettings } from '@/lib/getUserAIProvider'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'

// ─── Helpers: Artwork Gap Analysis ──────────────────────────
const ARTWORK_DIMENSIONS = [
  {
    label: 'Complejidad',
    sublabel: 'Volumen de SKUs y versiones',
    keywords: [
      'multi-sku', 'sku', 'variant', 'gama', 'portafolio', 'portfolio',
      'catálogo', 'catalog', 'idioma', 'language', 'market', 'mercado',
      'international', 'global', 'region', 'format', 'formato', 'version', 'versión',
    ],
  },
  {
    label: 'Proceso manual',
    sublabel: 'Riesgo por flujos sin digitalizar',
    keywords: [
      'manual', 'excel', 'email', 'aprov', 'approv', 'revision', 'revisión',
      'corrección', 'proof', 'artwork', 'bottleneck', 'delay', 'retraso',
      'error', 'rework', 'sign-off', 'workflow', 'flujo', 'proceso',
    ],
  },
  {
    label: 'Riesgo regulatorio',
    sublabel: 'Compliance y etiquetado',
    keywords: [
      'regulat', 'compliance', 'normativa', 'etiqueta', 'label', 'recall',
      'retirada', 'fda', 'efsa', 'nutriscore', 'ingrediente', 'allergen',
      'alérgeno', 'legal', 'claim', 'pharma', 'fármac', 'medical',
    ],
  },
  {
    label: 'Escala global',
    sublabel: 'Distribución multi-mercado',
    keywords: [
      'global', 'international', 'multinacional', 'export', 'exporta',
      'distribu', 'expansion', 'expansión', 'europe', 'europa', 'latam',
      'retail', 'retailer', 'grocery', 'supermarket',
    ],
  },
]

function computeArtworkScores(enrichment: Record<string, unknown>): number[] {
  const corpus = [
    ...(enrichment.detected_problems as string[] ?? []),
    ...(enrichment.detected_needs as string[] ?? []),
    (enrichment.company_summary as string) ?? '',
    (enrichment.priority_reason as string) ?? '',
    (enrichment.media_connector_fit as string) ?? '',
    (enrichment.what_they_do as string) ?? '',
  ].join(' ').toLowerCase()

  return ARTWORK_DIMENSIONS.map(dim => {
    const hits = dim.keywords.filter(k => corpus.includes(k)).length
    const base = Math.round((hits / dim.keywords.length) * 82 + 12)
    const jitter = (corpus.length % (7 + dim.keywords.length)) % 10
    return Math.min(94, Math.max(12, base + jitter))
  })
}

function getRecommendedModules(scores: number[]): string[] {
  const modules = []
  if (scores[0] >= 50) modules.push('DAM — Repositorio centralizado de activos')
  if (scores[1] >= 50) modules.push('Flujos de aprobación — Workflows personalizados')
  if (scores[2] >= 50) modules.push('Softproofing — Verificación pixel-perfect y trazabilidad')
  if (scores[3] >= 50) modules.push('Dashboard de visibilidad — KPIs multi-mercado en tiempo real')
  return modules.length > 0 ? modules : ['Softproofing', 'Flujos de aprobación']
}

// ─── Generación IA del análisis de demo ─────────────────────
interface AIBriefAnalysis {
  executive_summary: string          // 2-3 frases: por qué este lead es relevante ahora
  pain_points_deep: string[]         // 3-4 dolores específicos detectados en profundidad
  talking_points: string[]           // 3-4 puntos de conversación para la demo
  objections_handling: Array<{ objection: string; response: string }>  // 2-3 objeciones típicas con respuesta
  competitive_context: string        // Qué herramientas usa o podría estar usando
  custom_roi: string                 // ROI personalizado al sector/tamaño de la empresa
  demo_agenda: string[]              // Agenda de 20 min sugerida para la demo
  next_steps: string[]               // Próximos pasos recomendados post-demo
}

async function generateAIBriefAnalysis(
  lead: Record<string, unknown>,
  enrichment: Record<string, unknown>,
  sequenceSummary: string,
  provider: string,
  model: string
): Promise<AIBriefAnalysis> {
  const systemPrompt = `Eres un consultor experto en ventas B2B de software de gestión de artes gráficas y packaging para la plataforma MyMediaConnect (Artwork Proofing Platform).
Tu tarea es generar un análisis profundo y accionable para preparar una demo de 20 minutos con el decisor de esta empresa.

MyMediaConnect resuelve:
1. Complejidad en gestión de artes y aprobación de packaging (FMCG, alimentación, pharma, retail)
2. Procesos manuales: Excel, emails, revisiones en papel → workflows digitales
3. Riesgo regulatorio: trazabilidad, compliance FDA/EFSA, recall de etiquetas
4. Escala global: gestión multi-mercado, multi-idioma, multi-versión de artes

Módulos principales: DAM (Digital Asset Management), Flujos de aprobación, Softproofing, Dashboard de visibilidad.

Responde SIEMPRE en JSON válido con la estructura exacta indicada. Sin texto fuera del JSON.`

  const userPrompt = `Analiza este lead para preparar una demo personalizada:

EMPRESA: ${lead.company_name}
SECTOR: ${lead.sector ?? 'No especificado'}
PAÍS: ${lead.country ?? 'No especificado'}
WEB: ${lead.website ?? 'No disponible'}
CONTACTO: ${lead.first_name ?? ''} ${lead.last_name ?? ''} — ${lead.email ?? ''} — ${lead.department ?? ''}
FIT SCORE: ${lead.score ?? 0}/100
PRIORIDAD: ${lead.priority ?? 'medium'}

DESCRIPCIÓN EMPRESA:
${(enrichment.what_they_do as string) || (lead.description as string) || 'Sin descripción disponible'}

RESUMEN CONTEXTO:
${(enrichment.company_summary as string) || 'Sin resumen disponible'}

DOLORES DETECTADOS: ${((enrichment.detected_problems as string[]) ?? []).join(', ') || 'No detectados'}
NECESIDADES: ${((enrichment.detected_needs as string[]) ?? []).join(', ') || 'No detectadas'}
FIT RAZÓN: ${(enrichment.media_connector_fit as string) || 'Sin análisis'}
PRIORIDAD RAZÓN: ${(enrichment.priority_reason as string) || 'Sin análisis'}

HISTORIAL DE INTERACCIONES:
${sequenceSummary || 'Sin interacciones previas registradas'}

Genera un análisis para la demo en este JSON exacto:
{
  "executive_summary": "string — 2-3 frases explicando por qué este lead es prioritario y cuál es el ángulo de ataque ideal",
  "pain_points_deep": ["Problema concreto que tiene esta empresa en gestión de artes/packaging (SIEMPRE 4 problemas específicos aunque no haya datos explícitos, infiere del sector y actividad)", "problema2", "problema3", "problema4"],
  "talking_points": ["string con punto de conversación específico para la demo", ...],
  "objections_handling": [
    {"objection": "Objeción típica que puede surgir", "response": "Cómo responder con contexto de este lead"}
  ],
  "competitive_context": "string — qué herramientas usa o podría estar usando, contexto competitivo",
  "custom_roi": "string — ROI estimado personalizado al sector/tamaño de esta empresa",
  "demo_agenda": ["string con punto de agenda", ...],
  "next_steps": ["string con próximo paso post-demo", ...]
}`

  try {
    if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) throw new Error('GROQ_API_KEY no configurada')
      const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })
      const resp = await client.chat.completions.create({
        model: model ?? 'llama-3.3-70b-versatile',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
      return JSON.parse(resp.choices[0].message.content ?? '{}') as AIBriefAnalysis
    } else {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
      const client = new GoogleGenAI({ apiKey })
      // Usamos gemini-2.5-flash con thinking desactivado para respuesta rápida (<10s)
      // thinkingBudget: 0 desactiva el modo "thinking" que puede tardar 30-90s
      const response = await client.models.generateContent({
        model: model ?? 'gemini-2.5-flash',
        config: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingBudget: 0 },
        },
        contents: userPrompt,
      })
      return JSON.parse(response.text ?? '{}') as AIBriefAnalysis
    }
  } catch {
    // Fallback si la IA falla — inferir problemas desde todos los campos disponibles
    const fallbackProblems: string[] = [
      ...(enrichment.detected_problems as string[] ?? []),
      ...(enrichment.detected_needs as string[] ?? []),
    ]
    // Si no hay datos explícitos, generar problemas típicos del sector
    if (fallbackProblems.length === 0) {
      const sector = (lead.sector as string) ?? ''
      fallbackProblems.push('Gestión manual de artes y aprobaciones por email o Excel')
      fallbackProblems.push('Dificultad para rastrear versiones de artes y cambios en packaging')
      if (sector.toLowerCase().includes('pharma') || sector.toLowerCase().includes('farm')) {
        fallbackProblems.push('Riesgo de incumplimiento regulatorio en etiquetado y claims')
      } else {
        fallbackProblems.push('Retrasos en time-to-market por ciclos de revisión largos')
      }
      fallbackProblems.push('Falta de visibilidad global del estado de artes en producción')
    }
    return {
      executive_summary: `${lead.company_name} presenta oportunidad de mejora en gestión de artes y procesos de aprobación de packaging.`,
      pain_points_deep: fallbackProblems.slice(0, 4),
      talking_points: [
        'Mostrar cómo MMC reduce tiempo de aprobación de artes',
        'Dashboard de visibilidad de assets en tiempo real',
        'Casos de éxito en sector ' + (lead.sector ?? 'FMCG'),
      ],
      objections_handling: [
        { objection: '¿Cuánto tiempo lleva la implementación?', response: 'Onboarding en 2-4 semanas, sin disrupción operativa.' },
        { objection: '¿Podemos integrarlo con nuestro ERP/DAM actual?', response: 'MMC tiene API abierta e integraciones nativas con los principales sistemas del sector.' },
      ],
      competitive_context: 'Posiblemente gestionando artes con herramientas genéricas (Google Drive, Dropbox, email).',
      custom_roi: 'Reducción estimada del 45% en tiempo de aprobación y -85% en iteraciones de revisión.',
      demo_agenda: ['Presentación (3 min)', 'Pain points identificados (5 min)', 'Demo flujo aprobación (8 min)', 'Q&A + próximos pasos (4 min)'],
      next_steps: ['Enviar propuesta personalizada', 'Agendar reunión técnica con IT', 'Preparar prueba de concepto'],
    }
  }
}

// ─── Handler GET ─────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Obtener lead + enrichment + secuencias
  // No filtramos por user_id — RLS via get_team_user_ids() permite acceso al equipo
  const [leadResult, seqResult, activityResult] = await Promise.all([
    supabase
      .from('leads')
      .select('*, enrichment:lead_enrichments(*)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('sequences')
      .select('*, sequence_steps(*)')
      .eq('lead_id', params.id)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('activity_logs')
      .select('type, title, description, created_at')
      .eq('lead_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const { data: lead, error } = leadResult
  if (error || !lead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  const enrichment = (lead.enrichment as Record<string, unknown>[])?.[0] ?? {}
  const sequences = seqResult.data ?? []
  const activities = activityResult.data ?? []

  // Construir resumen de interacciones para la IA
  const activeSeq = sequences.find(s => s.status === 'active')
  const lastSeq = sequences[0]
  let sequenceSummary = ''
  if (lastSeq) {
    const steps = (lastSeq.sequence_steps ?? []) as Array<{ step_number: number; status: string; sent_at?: string; scheduled_for?: string }>
    const sentSteps = steps.filter(s => s.status === 'sent')
    const pendingSteps = steps.filter(s => s.status === 'pending')
    sequenceSummary = `Secuencia: ${lastSeq.status}. Emails enviados: ${sentSteps.length}/${steps.length}. `
    if (sentSteps.length > 0) {
      const lastSent = sentSteps[sentSteps.length - 1]
      sequenceSummary += `Último email enviado: ${lastSent.sent_at ? new Date(lastSent.sent_at).toLocaleDateString('es-ES') : 'fecha desconocida'}. `
    }
    if (pendingSteps.length > 0 && activeSeq) {
      const next = pendingSteps[0]
      sequenceSummary += `Próximo email programado: ${next.scheduled_for ? new Date(next.scheduled_for).toLocaleDateString('es-ES') : 'pendiente'}.`
    }
  }
  if (activities.length > 0) {
    sequenceSummary += ' Actividad reciente: ' + activities.slice(0, 3).map(a => a.title).join(', ') + '.'
  }

  // Obtener configuración de IA del usuario
  const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)

  // Generar análisis IA
  const aiAnalysis = await generateAIBriefAnalysis(
    lead as Record<string, unknown>,
    enrichment,
    sequenceSummary,
    aiProvider,
    aiModel
  )

  // Scores y módulos recomendados
  const scores = computeArtworkScores(enrichment)
  const recommendedModules = getRecommendedModules(scores)

  const fitScore = (lead.score as number) ?? (enrichment.fit_score as number) ?? 0
  const priority = (lead.priority as string) ?? 'medium'
  const priorityLabel = { high: 'Alta oportunidad', medium: 'Oportunidad media', low: 'Oportunidad baja' }[priority] ?? 'Pendiente análisis'
  const priorityColor = { high: '#6366f1', medium: '#f59e0b', low: '#10b981' }[priority] ?? '#9ca3af'

  const problems = (enrichment.detected_problems as string[] | undefined) ?? []
  const needs = (enrichment.detected_needs as string[] | undefined) ?? []
  const whatTheyDo = (enrichment.what_they_do as string) || (lead.description as string) || ''

  const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  // Secuencia activa y sus pasos
  const seqSteps = activeSeq
    ? ((activeSeq.sequence_steps ?? []) as Array<{ step_number: number; status: string; sent_at?: string; scheduled_for?: string }>)
    : []

  // ─── HTML del one-pager ──────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo Brief — ${lead.company_name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #111827;
      background: #f8fafc;
      font-size: 10.5pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page { size: A4; margin: 12mm 15mm; }

    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .page { max-width: 100%; padding: 0; }
      .section { break-inside: avoid; }
    }

    .page { max-width: 780px; margin: 0 auto; padding: 20px 24px; }

    /* Header */
    .header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding-bottom: 14px; border-bottom: 3px solid #6366f1; margin-bottom: 18px;
    }
    .header-brand { display: flex; align-items: center; gap: 10px; }
    .logo-img { width: 38px; height: 38px; object-fit: contain; }
    .logo-text .brand { font-size: 12pt; font-weight: 700; color: #111; letter-spacing: -0.3px; }
    .logo-text .sub { font-size: 7.5pt; color: #6366f1; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .header-meta { text-align: right; }
    .header-meta .date { font-size: 8pt; color: #9ca3af; }
    .header-meta .doc-type { font-size: 9pt; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.1em; }

    /* Company hero */
    .company-hero {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 14px; gap: 16px;
      background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
      padding: 14px 16px;
    }
    .company-info h1 {
      font-size: 18pt; font-weight: 800; letter-spacing: -0.5px;
      color: #111827; line-height: 1.1; margin-bottom: 3px;
    }
    .company-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 5px; }
    .meta-tag {
      font-size: 8pt; background: #f3f4f6; border-radius: 4px;
      padding: 2px 8px; color: #374151; font-weight: 500;
    }
    .contact-info { margin-top: 7px; font-size: 8.5pt; color: #4b5563; }
    .contact-info a { color: #6366f1; text-decoration: none; }
    .score-badge { text-align: center; min-width: 90px; flex-shrink: 0; }
    .score-number { font-size: 30pt; font-weight: 900; color: ${priorityColor}; line-height: 1; letter-spacing: -1px; }
    .score-label { font-size: 7pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-top: 2px; }
    .priority-badge {
      font-size: 7.5pt; font-weight: 700; color: ${priorityColor};
      background: ${priorityColor}18; border: 1px solid ${priorityColor}40;
      border-radius: 4px; padding: 2px 8px; text-transform: uppercase;
      letter-spacing: 0.06em; margin-top: 4px; display: inline-block;
    }

    /* Executive Summary */
    .exec-summary {
      background: linear-gradient(135deg, #f0f0ff 0%, #fff 100%);
      border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px 14px;
      margin-bottom: 14px; font-size: 9.5pt; color: #1e1b4b; line-height: 1.5;
    }
    .exec-summary strong { color: #6366f1; }

    /* Section title */
    .section-title {
      font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.12em; color: #6366f1; margin-bottom: 8px;
      display: flex; align-items: center; gap: 6px;
    }
    .section-title::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }

    /* Grid layouts */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }

    /* Card */
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; background: #fff; }

    /* Sequence status */
    .seq-step {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 8.5pt;
    }
    .seq-step:last-child { border-bottom: none; }
    .step-dot {
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 8pt; font-weight: 700; flex-shrink: 0;
    }
    .step-dot.sent { background: #dcfce7; color: #166534; }
    .step-dot.pending { background: #fef3c7; color: #92400e; }
    .step-dot.skipped { background: #f3f4f6; color: #9ca3af; }
    .step-info { flex: 1; }
    .step-label { font-weight: 600; color: #374151; }
    .step-date { font-size: 7.5pt; color: #9ca3af; }

    /* Artwork bars */
    .artwork-bar { margin-bottom: 9px; }
    .artwork-bar-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
    .artwork-bar-label { font-size: 9pt; font-weight: 600; color: #374151; }
    .artwork-bar-sub { font-size: 7.5pt; color: #9ca3af; }
    .artwork-bar-pct { font-size: 9pt; font-weight: 700; }
    .bar-track { height: 6px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 99px; }

    /* Pills */
    .pill-list { display: flex; flex-wrap: wrap; gap: 5px; }
    .pill { font-size: 7.5pt; background: #fef3c7; border: 1px solid #fde68a; color: #92400e; border-radius: 4px; padding: 2px 7px; font-weight: 500; }
    .pill.green { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
    .pill.indigo { background: #eef2ff; border-color: #c7d2fe; color: #3730a3; }

    /* Talking points / agenda */
    .bullet-list { list-style: none; }
    .bullet-list li {
      display: flex; gap: 7px; padding: 5px 0;
      border-bottom: 1px solid #f3f4f6; font-size: 8.5pt; color: #374151; line-height: 1.4;
    }
    .bullet-list li:last-child { border-bottom: none; }
    .bullet-list li::before { content: '→'; color: #6366f1; font-weight: 700; flex-shrink: 0; }

    /* Objection cards */
    .objection-item {
      background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px;
      padding: 8px 10px; margin-bottom: 7px;
    }
    .objection-item:last-child { margin-bottom: 0; }
    .obj-q { font-size: 8pt; font-weight: 700; color: #9a3412; margin-bottom: 3px; }
    .obj-a { font-size: 8pt; color: #374151; line-height: 1.4; }
    .obj-a strong { color: #6366f1; }

    /* Module list */
    .module-item { display: flex; align-items: flex-start; gap: 7px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
    .module-item:last-child { border-bottom: none; }
    .module-dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; margin-top: 4px; flex-shrink: 0; }
    .module-name { font-size: 9pt; font-weight: 600; color: #111827; }
    .module-desc { font-size: 7.5pt; color: #6b7280; margin-top: 1px; }

    /* ROI block */
    .roi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 6px; }
    .roi-item { text-align: center; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 7px 5px; }
    .roi-number { font-size: 13pt; font-weight: 900; color: #6366f1; letter-spacing: -0.5px; line-height: 1; }
    .roi-desc { font-size: 6.5pt; color: #6b7280; margin-top: 3px; line-height: 1.3; }

    /* Competitive / custom ROI */
    .insight-box {
      background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;
      padding: 10px 12px; font-size: 8.5pt; color: #0c4a6e; line-height: 1.5;
    }
    .insight-box .label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0284c7; margin-bottom: 3px; }

    /* CTA footer */
    .cta-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: #6366f1; border-radius: 8px; padding: 13px 16px;
      margin-top: 16px; color: #fff;
    }
    .cta-text .cta-headline { font-size: 11pt; font-weight: 700; margin-bottom: 2px; }
    .cta-text .cta-sub { font-size: 8pt; opacity: 0.85; }
    .cta-contact { text-align: right; font-size: 8.5pt; opacity: 0.9; }
    .cta-contact a { color: #c7d2fe; text-decoration: none; }

    /* Print button */
    .print-btn {
      position: fixed; bottom: 24px; right: 24px;
      background: #6366f1; color: #fff; border: none; border-radius: 10px;
      padding: 12px 20px; font-size: 12pt; font-weight: 600; cursor: pointer;
      box-shadow: 0 4px 16px rgba(99,102,241,0.4);
      display: flex; align-items: center; gap: 8px;
    }
    .print-btn:hover { background: #4f46e5; }

    .section { margin-bottom: 14px; }
    .fit-text {
      font-size: 9pt; color: #374151; line-height: 1.5;
      background: #f8fafc; border-left: 3px solid #6366f1;
      padding: 8px 12px; border-radius: 0 6px 6px 0; margin-top: 8px;
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-brand">
      <img src="/logo2.png" alt="MyMediaConnect" class="logo-img" />
      <div class="logo-text">
        <div class="brand">MyMediaConnect</div>
        <div class="sub">Artwork Proofing Platform</div>
      </div>
    </div>
    <div class="header-meta">
      <div class="doc-type">Demo Brief</div>
      <div class="date">${today}</div>
    </div>
  </div>

  <!-- Company hero + contact -->
  <div class="company-hero">
    <div class="company-info" style="flex:1">
      <h1>${lead.company_name}</h1>
      ${whatTheyDo ? `<p style="font-size:9pt;color:#6b7280;margin-top:3px;max-width:420px;line-height:1.4;">${whatTheyDo.slice(0, 200)}${whatTheyDo.length > 200 ? '…' : ''}</p>` : ''}
      <div class="company-meta">
        ${lead.sector ? `<span class="meta-tag">📦 ${lead.sector}</span>` : ''}
        ${lead.country ? `<span class="meta-tag">🌍 ${lead.country}</span>` : ''}
        ${lead.website ? `<span class="meta-tag">🔗 <a href="${lead.website}" style="color:inherit">${lead.website}</a></span>` : ''}
        ${lead.employees ? `<span class="meta-tag">👥 ${lead.employees} empleados</span>` : ''}
      </div>
      <div class="contact-info" style="margin-top:8px;">
        ${(lead.first_name || lead.last_name) ? `<span style="font-weight:600">👤 ${[lead.first_name, lead.last_name].filter(Boolean).join(' ')}</span>` : ''}
        ${lead.department ? `<span style="margin-left:4px;color:#9ca3af">· ${lead.department}</span>` : ''}
        ${lead.email ? `<br/><a href="mailto:${lead.email}">✉️ ${lead.email}</a>` : ''}
        ${lead.phone ? `<span style="margin-left:8px;">📞 ${lead.phone}</span>` : ''}
        ${lead.linkedin_url ? `<br/><a href="${lead.linkedin_url}">🔗 LinkedIn</a>` : ''}
      </div>
    </div>
    <div class="score-badge">
      <div class="score-number">${fitScore}</div>
      <div class="score-label">Fit Score</div>
      <div class="priority-badge">${priorityLabel}</div>
      ${sequences.length > 0 ? `<div style="font-size:7pt;color:#9ca3af;margin-top:6px;">Seq: ${sequences[0].status}</div>` : ''}
    </div>
  </div>

  <!-- Executive Summary (IA) -->
  <div class="exec-summary section">
    <div style="font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6366f1;margin-bottom:5px;">✨ Resumen ejecutivo (generado con IA)</div>
    ${aiAnalysis.executive_summary}
  </div>

  <!-- Fila 1: Estado secuencia + Dolores detectados -->
  <div class="grid-2 section">

    <!-- Estado de la secuencia -->
    <div>
      <div class="section-title">Estado de interacciones</div>
      <div class="card">
        ${sequences.length === 0 ? '<p style="font-size:8.5pt;color:#9ca3af;padding:4px 0;">Sin secuencia iniciada todavía</p>' : ''}
        ${seqSteps.length > 0 ? seqSteps.map(step => {
          const statusClass = step.status === 'sent' ? 'sent' : step.status === 'pending' ? 'pending' : 'skipped'
          const statusLabel = step.status === 'sent' ? '✓' : step.status === 'pending' ? '⏱' : '–'
          const dateStr = step.sent_at
            ? `Enviado ${new Date(step.sent_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
            : step.scheduled_for
              ? `Prog. ${new Date(step.scheduled_for).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
              : ''
          return `<div class="seq-step">
            <div class="step-dot ${statusClass}">${statusLabel}</div>
            <div class="step-info">
              <div class="step-label">Email ${step.step_number}</div>
              <div class="step-date">${dateStr}</div>
            </div>
          </div>`
        }).join('') : sequences.length > 0 ? `<p style="font-size:8.5pt;color:#6b7280;padding:4px 0;">Secuencia ${sequences[0].status} — ${sequences[0].current_step ?? 0} pasos completados</p>` : ''}
        ${activities.length > 0 ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f3f4f6;">
            <div style="font-size:7.5pt;font-weight:600;color:#6b7280;margin-bottom:4px;">Actividad reciente:</div>
            ${activities.slice(0, 3).map(a => `
              <div style="font-size:7.5pt;color:#6b7280;padding:2px 0;">
                ${new Date(a.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${a.title}
              </div>`).join('')}
          </div>` : ''}
      </div>
    </div>

    <!-- Problemas detectados -->
    <div>
      <div class="section-title">Problemas detectados</div>
      <!-- Problemas principales: siempre generados por IA con contexto completo del lead -->
      <ul class="bullet-list">
        ${aiAnalysis.pain_points_deep.map(p => `<li>${p}</li>`).join('')}
      </ul>
      <!-- Tags adicionales de la base de datos (si existen) -->
      ${(problems.length > 0 || needs.length > 0) ? `
        <div style="margin-top:8px;">
          <div class="pill-list">
            ${problems.slice(0, 4).map(p => `<span class="pill">${p}</span>`).join('')}
            ${needs.slice(0, 3).map(n => `<span class="pill green">${n}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>
  </div>

  <!-- Fila 2: Gap Analysis + Talking points -->
  <div class="grid-2 section">

    <!-- Artwork Gap Analysis -->
    <div>
      <div class="section-title">Artwork Gap Analysis</div>
      ${ARTWORK_DIMENSIONS.map((dim, i) => {
        const s = scores[i]
        const color = s >= 65 ? '#6366f1' : s >= 40 ? '#f59e0b' : '#10b981'
        return `<div class="artwork-bar">
          <div class="artwork-bar-header">
            <div>
              <span class="artwork-bar-label">${dim.label}</span>
              <span class="artwork-bar-sub"> · ${dim.sublabel}</span>
            </div>
            <span class="artwork-bar-pct" style="color:${color}">${s}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${s}%;background:${color}"></div>
          </div>
        </div>`
      }).join('')}
    </div>

    <!-- Talking points (IA) -->
    <div>
      <div class="section-title">Talking points para la demo</div>
      <ul class="bullet-list">
        ${aiAnalysis.talking_points.map(tp => `<li>${tp}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- Fila 3: Módulos + Objeciones -->
  <div class="grid-2 section">

    <!-- Módulos recomendados -->
    <div>
      <div class="section-title">Módulos recomendados</div>
      <div class="card">
        ${recommendedModules.map(m => {
          const [name, ...rest] = m.split('—')
          return `<div class="module-item">
            <div class="module-dot"></div>
            <div>
              <div class="module-name">${name.trim()}</div>
              ${rest.length ? `<div class="module-desc">${rest.join('—').trim()}</div>` : ''}
            </div>
          </div>`
        }).join('')}
      </div>
    </div>

    <!-- Manejo de objeciones (IA) -->
    <div>
      <div class="section-title">Manejo de objeciones</div>
      ${aiAnalysis.objections_handling.map(o => `
        <div class="objection-item">
          <div class="obj-q">❓ ${o.objection}</div>
          <div class="obj-a">${o.response}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- Fila 4: Contexto competitivo + ROI personalizado -->
  <div class="grid-2 section">

    <div>
      <div class="section-title">Contexto competitivo</div>
      <div class="insight-box">
        <div class="label">🔍 Análisis</div>
        ${aiAnalysis.competitive_context}
      </div>
    </div>

    <div>
      <div class="section-title">ROI estimado (personalizado)</div>
      <div class="insight-box">
        <div class="label">📈 Impacto esperado</div>
        ${aiAnalysis.custom_roi}
      </div>
      <div class="roi-grid" style="margin-top:8px">
        <div class="roi-item"><div class="roi-number">-45%</div><div class="roi-desc">Time-to-market</div></div>
        <div class="roi-item"><div class="roi-number">-85%</div><div class="roi-desc">Iteraciones</div></div>
        <div class="roi-item"><div class="roi-number">-75%</div><div class="roi-desc">Errores artes</div></div>
        <div class="roi-item"><div class="roi-number">-50%</div><div class="roi-desc">Costes gestión</div></div>
      </div>
    </div>
  </div>

  <!-- Agenda demo + Próximos pasos -->
  <div class="grid-2 section">
    <div>
      <div class="section-title">Agenda demo sugerida (20 min)</div>
      <ul class="bullet-list">
        ${aiAnalysis.demo_agenda.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
    <div>
      <div class="section-title">Próximos pasos post-demo</div>
      <ul class="bullet-list">
        ${aiAnalysis.next_steps.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- CTA -->
  <div class="cta-bar">
    <div class="cta-text">
      <div class="cta-headline">¿Tienes 20 min esta semana?</div>
      <div class="cta-sub">Demo personalizada para ${lead.company_name} · ${today}</div>
    </div>
    <div class="cta-contact">
      <div>mymediaconnect.com</div>
      <a href="mailto:hola@mymediaconnect.com">hola@mymediaconnect.com</a>
    </div>
  </div>

</div>

<button class="print-btn no-print" onclick="window.print()">
  🖨️ Guardar como PDF
</button>

</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
    },
  })
}
