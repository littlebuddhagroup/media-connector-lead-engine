import { GoogleGenAI } from '@google/genai'
import type { Lead, LeadEnrichment, MessageType, MessageTone } from '@/types'

// ============================================================
// AI SERVICE — Google Gemini
// ============================================================

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
  return new GoogleGenAI({ apiKey })
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

// Helper: llama a Gemini y devuelve JSON parseado
async function callGemini<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3
): Promise<T> {
  const client = getClient()

  let response
  try {
    response = await client.models.generateContent({
      model: DEFAULT_MODEL,
      config: {
        temperature,
        responseMimeType: 'application/json',
        systemInstruction: systemPrompt,
      },
      contents: userPrompt,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        'Cuota de Gemini agotada. Activa el billing en console.cloud.google.com o espera unos minutos.'
      )
    }
    if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
      throw new Error('API key de Gemini inválida. Revisa GEMINI_API_KEY en .env.local.')
    }
    throw new Error(`Error de Gemini: ${msg}`)
  }

  const text = response.text  // En @google/genai v1 es una propiedad, no función
  if (!text) throw new Error('Gemini no devolvió respuesta')

  return JSON.parse(text) as T
}

// ============================================================
// ENRIQUECIMIENTO DE LEADS CON IA
// ============================================================
export interface EnrichmentResult {
  company_summary: string
  what_they_do: string
  detected_needs: string[]
  detected_problems: string[]
  media_connector_fit: string
  fit_score: number
  priority_reason: string
  auto_tags: string[]
}

export async function enrichLeadWithAI(
  lead: Lead,
  scrapedContent?: string
): Promise<EnrichmentResult> {
  const systemPrompt = `Eres un analista comercial B2B especializado en software de gestión de procesos de marca y cadena gráfica.
Tu tarea es analizar empresas potenciales para venderles "MyMediaConnect", un software BPM (Business Process Management) SaaS que digitaliza y automatiza la cadena gráfica de marca.

MyMediaConnect resuelve estos problemas:
- Caos en la gestión de versiones de diseño ("¿Cuál es el archivo final?")
- Cadenas de emails interminables para aprobar materiales de marca
- Retrasos en lanzamientos por procesos de aprobación lentos (jurídico, marketing, dirección)
- Errores de impresión por usar versiones incorrectas
- Falta de trazabilidad en cambios de diseño
- Trabajo descoordinado con agencias externas de diseño

MyMediaConnect es ideal para:
- Empresas con departamento de marketing que gestiona muchos materiales gráficos (packaging, PLV, catálogos, campañas)
- Marcas con muchas referencias o SKUs que requieren actualización frecuente de packaging
- Empresas que trabajan con agencias de diseño externas y necesitan aprobar creatividades
- Sectores: alimentación y bebidas, cosmética, farmacia, retail, moda, distribución, industria con marca propia
- Empresas donde el director jurídico, marketing y dirección deben aprobar materiales antes de imprimir
- Marcas que lanzan productos nuevos frecuentemente y necesitan agilizar el time-to-market

NO es ideal para:
- Empresas de servicios sin producto físico ni materiales de marca
- Startups pequeñas sin equipo de marketing
- Empresas puramente digitales sin necesidad de materiales impresos o packaging

El score debe reflejar cuánto encaja la empresa con este perfil. 90-100 = empresa con muchas SKUs, sector FMCG/cosmética/farma, equipo marketing grande. 0-30 = empresa de servicios o sin marca propia relevante.

Responde SIEMPRE en JSON válido con exactamente esta estructura.`

  const userPrompt = `Analiza esta empresa para evaluar si es un buen prospecto para MyMediaConnect:

Empresa: ${lead.company_name}
Web: ${lead.website ?? 'No disponible'}
Sector: ${lead.sector ?? 'Desconocido'}
País: ${lead.country ?? 'Desconocido'}
Descripción conocida: ${lead.description ?? 'No disponible'}
${scrapedContent ? `\nContenido extraído de su web:\n${scrapedContent.slice(0, 3000)}` : ''}

Responde con este JSON:
{
  "company_summary": "Resumen de 2-3 frases de qué hace la empresa y su relevancia para MyMediaConnect",
  "what_they_do": "Descripción breve de su actividad principal y volumen de marca estimado",
  "detected_needs": ["necesidad específica 1 relacionada con gestión de marca/diseño", "necesidad2", "necesidad3"],
  "detected_problems": ["problema concreto que MyMediaConnect resolvería", "problema2"],
  "media_connector_fit": "Explicación concreta de por qué MyMediaConnect les encajaría o no, mencionando casos de uso específicos",
  "fit_score": 75,
  "priority_reason": "Razón principal del score: volumen de materiales, sector, tamaño equipo marketing",
  "auto_tags": ["sector-tag", "tamaño-tag", "caso-uso-tag"]
}`

  return callGemini<EnrichmentResult>(systemPrompt, userPrompt, 0.3)
}

// ============================================================
// GENERADOR DE MENSAJES COMERCIALES
// ============================================================
export interface GeneratedMessage {
  subject?: string
  body: string
  tokens_used: number
}

export async function generateMessage(
  lead: Lead,
  enrichment: Partial<LeadEnrichment> | null,
  type: MessageType,
  tone: MessageTone = 'consultivo',
  additionalContext?: string
): Promise<GeneratedMessage> {
  const toneDescriptions: Record<MessageTone, string> = {
    cercano: 'Tono cercano, informal pero profesional. Usa tú. Evita la rigidez.',
    formal: 'Tono formal y profesional. Usa usted. Lenguaje corporativo pero claro.',
    tecnico: 'Tono técnico orientado a IT. Menciona integraciones, APIs, automatización.',
    directo: 'Tono muy directo y conciso. Ve al grano. Sin rodeos.',
    consultivo: 'Tono consultivo. Haz preguntas, sugiere soluciones. Muéstrate como experto.',
  }

  const typeDescriptions: Record<MessageType, string> = {
    initial_email: 'Email inicial de prospección comercial. Primera toma de contacto.',
    followup_1: 'Primer follow-up. Han pasado 4-5 días sin respuesta. Recordatorio suave.',
    followup_2: 'Segundo follow-up. Han pasado 8-10 días. Último intento. Cierre o apertura.',
    linkedin_message: 'Mensaje corto para LinkedIn (máx 300 caracteres). Muy personal y directo.',
    internal_summary: 'Resumen comercial interno del lead para el equipo de ventas.',
  }

  const systemPrompt = `Eres un experto en ventas B2B SaaS para MyMediaConnect, software de gestión de cadena gráfica de marca.
Escribes mensajes comerciales personalizados, cortos, naturales y efectivos dirigidos a directores de marketing y brand managers.
El mensaje debe resonar con sus problemas reales: versiones de diseño perdidas, aprobaciones eternas, errores en imprenta, caos con agencias.
Nunca suenas a spam. Siempre aportas valor concreto y hablas su lenguaje (marketing, branding, packaging, time-to-market).
Responde SIEMPRE en JSON con "subject" (solo para emails) y "body".`

  const needsSummary = enrichment?.detected_needs?.join(', ') || 'no especificadas'
  const problemsSummary = enrichment?.detected_problems?.join(', ') || 'no identificados'
  const fitReason = enrichment?.media_connector_fit || 'encaje potencial detectado'

  const userPrompt = `Genera un ${typeDescriptions[type]} para:

Empresa: ${lead.company_name}
Web: ${lead.website ?? 'no disponible'}
Sector: ${lead.sector ?? 'desconocido'}
País: ${lead.country ?? 'desconocido'}
Qué hacen: ${enrichment?.what_they_do ?? lead.description ?? 'no disponible'}
Necesidades detectadas: ${needsSummary}
Problemas detectados: ${problemsSummary}
Encaje con Media Connector: ${fitReason}
${additionalContext ? `Contexto adicional: ${additionalContext}` : ''}

Tono: ${toneDescriptions[tone]}

${type === 'linkedin_message' ? 'IMPORTANTE: Máximo 300 caracteres. Sin asunto.' : 'El email debe ser corto (máx 150 palabras), con asunto atractivo.'}
${type === 'internal_summary' ? 'Sin asunto. Formato de ficha interna con bullets clave.' : ''}

Responde solo con JSON: { "subject": "...", "body": "..." }
Para LinkedIn y summary el subject puede ser null.`

  const result = await callGemini<{ subject?: string; body: string }>(
    systemPrompt,
    userPrompt,
    0.7
  )

  return {
    subject: result.subject ?? undefined,
    body: result.body,
    tokens_used: 0, // Gemini no expone token count en la respuesta estándar
  }
}
