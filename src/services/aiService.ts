import OpenAI from 'openai'
import type { Lead, LeadEnrichment, MessageType, MessageTone } from '@/types'

const getClient = () =>
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

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
  const client = getClient()

  const systemPrompt = `Eres un analista comercial B2B especializado en soluciones de media, automatización y conectividad de datos para empresas.
Tu tarea es analizar empresas potenciales para venderles "Media Connector", un producto SaaS que ayuda a empresas a conectar, automatizar y distribuir sus contenidos de media, datos y flujos internos entre sistemas.

Media Connector es ideal para:
- Empresas que trabajan con mucho contenido digital (vídeo, imagen, documentos)
- Empresas con múltiples sistemas desconectados (CMS, DAM, ERP, CRM)
- Agencias de medios, productoras, broadcasters
- Empresas con procesos manuales de distribución de contenidos
- Empresas con necesidades de integración entre plataformas

Debes responder SIEMPRE en JSON válido con exactamente esta estructura.`

  const userPrompt = `Analiza esta empresa para evaluar si es un buen prospecto para Media Connector:

Empresa: ${lead.company_name}
Web: ${lead.website ?? 'No disponible'}
Sector: ${lead.sector ?? 'Desconocido'}
País: ${lead.country ?? 'Desconocido'}
Descripción conocida: ${lead.description ?? 'No disponible'}
${scrapedContent ? `\nContenido extraído de su web:\n${scrapedContent.slice(0, 3000)}` : ''}

Responde con este JSON:
{
  "company_summary": "Resumen de 2-3 frases de qué hace la empresa",
  "what_they_do": "Descripción breve de su actividad principal",
  "detected_needs": ["necesidad1", "necesidad2", "necesidad3"],
  "detected_problems": ["problema potencial 1", "problema potencial 2"],
  "media_connector_fit": "Explicación de por qué Media Connector les encajaría (o no)",
  "fit_score": 75,
  "priority_reason": "Razón principal del score asignado",
  "auto_tags": ["tag1", "tag2", "tag3"]
}`

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from AI')

  const result = JSON.parse(content) as EnrichmentResult
  return result
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
  const client = getClient()

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

  const systemPrompt = `Eres un experto en ventas B2B SaaS para Media Connector.
Escribes mensajes comerciales personalizados, cortos, naturales y efectivos.
Nunca suenas a spam. Siempre aportas valor concreto.
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

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No response from AI')

  const result = JSON.parse(content)
  return {
    subject: result.subject,
    body: result.body,
    tokens_used: response.usage?.total_tokens ?? 0,
  }
}
