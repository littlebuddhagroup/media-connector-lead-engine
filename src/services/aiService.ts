import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import type { Lead, LeadEnrichment, MessageType, MessageTone } from '@/types'
import { textToHtml } from '@/lib/utils'

// ============================================================
// AI SERVICE — Gemini o Groq (seleccionable por env)
// AI_PROVIDER=gemini | groq
// ============================================================

type AIProvider = 'gemini' | 'groq'

// override: viene de los settings del usuario (db). Env var solo como fallback.
// Gemini es siempre el default — nunca auto-detectar Groq.
function getProvider(override?: string | null): AIProvider {
  const chosen = override ?? process.env.AI_PROVIDER
  if (chosen === 'groq') return 'groq'
  return 'gemini'
}

// ─── Gemini ───────────────────────────────────────────────────
// Fallback si el usuario no tiene modelo guardado en DB
const GEMINI_MODEL_DEFAULT = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

async function callGemini<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3,
  modelOverride?: string | null
): Promise<T> {
  const GEMINI_MODEL = modelOverride ?? GEMINI_MODEL_DEFAULT
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
  const client = new GoogleGenAI({ apiKey })

  let response
  try {
    response = await client.models.generateContent({
      model: GEMINI_MODEL,
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
      throw new Error('Cuota de Gemini agotada. Activa el billing en console.cloud.google.com o cambia a Groq en Configuración.')
    }
    if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
      throw new Error('API key de Gemini inválida. Revisa GEMINI_API_KEY en .env.local.')
    }
    throw new Error(`Error de Gemini: ${msg}`)
  }

  const text = response.text
  if (!text) throw new Error('Gemini no devolvió respuesta')
  return JSON.parse(text) as T
}

// ─── Groq (compatible con OpenAI SDK) ────────────────────────
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

async function callGroq<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3
): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada. Añádela en .env.local')

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  })

  let completion
  try {
    completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429')) throw new Error('Límite de Groq alcanzado. Espera unos segundos.')
    if (msg.includes('401') || msg.includes('invalid_api_key')) throw new Error('GROQ_API_KEY inválida. Revísala en .env.local')
    throw new Error(`Error de Groq: ${msg}`)
  }

  const text = completion.choices[0]?.message?.content
  if (!text) throw new Error('Groq no devolvió respuesta')
  return JSON.parse(text) as T
}

// ─── Router unificado ─────────────────────────────────────────
async function callAI<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3,
  providerOverride?: string | null,
  modelOverride?: string | null
): Promise<T> {
  const provider = getProvider(providerOverride)
  if (provider === 'groq') {
    return callGroq<T>(systemPrompt, userPrompt, temperature)
  }
  return callGemini<T>(systemPrompt, userPrompt, temperature, modelOverride)
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
  scrapedContent?: string,
  providerOverride?: string | null,
  modelOverride?: string | null
): Promise<EnrichmentResult> {
  const systemPrompt = `Eres un analista comercial B2B especializado en Artwork Management y gestión de packaging para empresas de gran consumo y entornos regulados.
Tu tarea es analizar empresas potenciales para venderles "MyMediaConnect", una Artwork Proofing Platform SaaS que centraliza el proofing, las aprobaciones y los activos de packaging en una sola plataforma.

POSICIONAMIENTO: "La capa especializada que transforma el packaging en una ventaja competitiva."
Lema de producto: "Lanza más rápido. Sin errores."

RESULTADOS PROBADOS en clientes actuales:
- -45% time-to-market en lanzamientos de packaging
- -85% iteraciones en el proceso de aprobación
- -75% errores en artes finales
- -50% costes de gestión del proceso

MyMediaConnect resuelve estos 4 problemas críticos:
1. TIME-TO-MARKET LENTO: el packaging es cuello de botella. Se pierden campañas, estacionalidad y ventanas comerciales.
2. VERSIONES PARALELAS: marketing, diseño y calidad trabajan sobre archivos distintos. Producción imprime el equivocado.
3. RE-TRABAJO COSTOSO: horas perdidas con agencias rehaciendo artes. Tiradas repetidas por errores detectados tarde.
4. SIN TRAZABILIDAD: nadie puede demostrar quién aprobó qué. Auditorías y compliance imposibles de defender.

PERFIL IDEAL DE CLIENTE (ICP):
- Gestiona +100 SKUs activos
- Lanza o actualiza >100 referencias al año
- Maneja packaging multi-nivel y multi-mercado
- Coordina varios equipos internos y externos (marketing, calidad, regulatory, agencias, supply chain)
- Sectores: FMCG · Pharma & OTC · Cosmética · Retail/MDD · Electrónica · Frescos · Suplementos · Industrial

NO es ideal para:
- Empresas de servicios sin producto físico ni packaging
- Empresas con pocas referencias o sin procesos de aprobación multi-departamento
- Startups sin equipo de marketing o procesos regulatorios

SCORING:
- 85-100: FMCG/cosmética/farma con muchos SKUs, packaging multi-mercado, equipo marketing+calidad+regulatory
- 60-84: sector adecuado pero volumen medio o procesos de aprobación menos complejos
- 30-59: packaging presente pero pocos SKUs o sector no prioritario
- 0-29: empresa de servicios, sin marca propia relevante o sin packaging

Responde SIEMPRE en JSON válido con exactamente esta estructura.`

  const userPrompt = `Analiza esta empresa para evaluar si es un buen prospecto para MyMediaConnect:

Empresa: ${lead.company_name}
Web: ${lead.website ?? 'No disponible'}
Sector: ${lead.sector ?? 'Desconocido'}
País: ${lead.country ?? 'Desconocido'}
Descripción conocida: ${lead.description ?? 'No disponible'}
${scrapedContent ? `\nContenido extraído de su web:\n${scrapedContent.slice(0, 3000)}` : ''}

Evalúa especialmente:
- Volumen estimado de SKUs y frecuencia de lanzamientos/actualizaciones de packaging
- Complejidad regulatoria (pharma, cosmética, alimentación con claims, exportación multi-mercado)
- Número de equipos que intervienen en la aprobación (marketing, calidad, regulatory, jurídico, agencias)
- Indicios de packaging complejo: múltiples idiomas, mercados, formatos, variantes

Responde con este JSON:
{
  "company_summary": "Resumen de 2-3 frases: qué hace, estimación de volumen de packaging y por qué es relevante para MyMediaConnect",
  "what_they_do": "Actividad principal, estimación de SKUs activos y complejidad del proceso de packaging",
  "detected_needs": ["necesidad específica relacionada con proofing/aprobaciones/packaging", "necesidad2", "necesidad3"],
  "detected_problems": ["cuál de los 4 problemas clave de MMC sufren más (time-to-market/versiones/retrabajo/trazabilidad)", "problema2"],
  "media_connector_fit": "Explicación concreta del encaje: qué módulo les ayuda más, qué ahorro/mejora obtendrían, referencia a algún resultado (-45% TTM, -85% iteraciones, etc.)",
  "fit_score": 75,
  "priority_reason": "Razón principal del score: volumen SKUs, complejidad regulatoria, número de aprobadores, sector",
  "auto_tags": ["sector-fmcg/pharma/cosmetica/retail", "sku-alto/medio/bajo", "regulado/no-regulado", "multi-mercado"]
}`

  return callAI<EnrichmentResult>(systemPrompt, userPrompt, 0.3, providerOverride, modelOverride)
}

// ============================================================
// GENERADOR DE MENSAJES COMERCIALES
// ============================================================
export interface GeneratedMessage {
  subject?: string
  body: string
  tokens_used: number
}

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'español de España',
  en: 'English (British)',
  fr: 'français',
  de: 'Deutsch',
  it: 'italiano',
  pt: 'português europeo',
  nl: 'Nederlands',
  ca: 'català',
}

export async function generateMessage(
  lead: Lead,
  enrichment: Partial<LeadEnrichment> | null,
  type: MessageType,
  tone: MessageTone = 'consultivo',
  additionalContext?: string,
  useEmojis = false,
  language = 'es',
  providerOverride?: string | null,
  modelOverride?: string | null
): Promise<GeneratedMessage> {
  const toneDescriptions: Record<MessageTone, string> = {
    cercano: 'Tono cercano, informal pero profesional. Usa tú. Evita la rigidez.',
    formal: 'Tono formal y profesional. Usa usted. Lenguaje corporativo pero claro.',
    tecnico: 'Tono técnico orientado a IT. Menciona integraciones, APIs, automatización.',
    directo: 'Tono muy directo y conciso. Ve al grano. Sin rodeos.',
    consultivo: 'Tono consultivo. Haz preguntas, sugiere soluciones. Muéstrate como experto.',
  }

  const typeDescriptions: Record<MessageType, string> = {
    initial_email: 'Email inicial de prospección. Primera toma de contacto. Abre con un dolor específico que reconocerán (time-to-market, versiones paralelas, retrabajo o falta de trazabilidad según su sector/rol). Una sola frase sobre cómo MyMediaConnect lo resuelve — sin enumerar features. CTA: propón una llamada de 20 min esta semana. Máx 130 palabras.',
    followup_1: 'Primer follow-up. Han pasado 4-5 días sin respuesta. Muy corto (50-70 palabras). Referencia el email anterior en una frase. Añade un dato concreto y creíble: un resultado real ("-85% menos iteraciones de aprobación en empresas similares de tu sector") o un coste que reconocerán (una tirada repetida por error de versión puede costar más de lo que cuesta el software al año). Termina con pregunta directa y sencilla.',
    followup_2: 'Segundo follow-up. Han pasado 8-10 días. Último intento, tono humano y sin presión. Muy corto (40-60 palabras). Reconoce que quizás no es el momento. Deja la puerta abierta con naturalidad. Opcional: menciona que empresas líderes de su sector ya trabajan con MMC si encaja con el tono.',
    linkedin_message: 'Mensaje corto para LinkedIn (máx 280 caracteres). Muy directo y personal. Alude a algo concreto de su sector o empresa. Sin pitch — genera curiosidad sobre el problema del packaging/aprobaciones. Nada de "me gustaría presentarte".',
    internal_summary: 'Resumen comercial interno del lead. Sin asunto. Incluye: potencial (alto/medio/bajo) con justificación, cuál de los 4 problemas de MMC sufren más, módulo que más les aportaría (Proofing / Workflows / DAM / Dashboards), ángulo de venta recomendado por rol, próximos pasos sugeridos. Formato de ficha concisa.',
  }

  const systemPrompt = `Eres un consultor comercial especializado en la venta de MyMediaConnect, una Artwork Proofing Platform SaaS para empresas de gran consumo y entornos regulados.

POSICIONAMIENTO: "La capa especializada que transforma el packaging en una ventaja competitiva. Lanza más rápido. Sin errores."

MyMediaConnect centraliza el proofing, las aprobaciones y los activos de packaging en una sola plataforma. Elimina los 4 problemas que sufren empresas con muchos SKUs:
1. TIME-TO-MARKET LENTO — el packaging es cuello de botella, se pierden ventanas comerciales y estacionalidad
2. VERSIONES PARALELAS — marketing, diseño y calidad trabajan sobre archivos distintos, producción imprime el equivocado
3. RE-TRABAJO COSTOSO — horas perdidas con agencias rehaciendo artes, tiradas repetidas por errores detectados tarde
4. SIN TRAZABILIDAD — nadie puede demostrar quién aprobó qué, auditorías y compliance imposibles de defender

RESULTADOS REALES que puedes citar:
- -45% time-to-market en lanzamientos
- -85% iteraciones en el proceso de aprobación
- -75% errores en artes finales
- -50% costes de gestión

FUNCIONALIDADES que puedes mencionar si son relevantes al interlocutor:
- Artwork Proofing: anotaciones en tiempo real, comparación pixel-perfect, verificación de colores Pantone/CMYK, códigos de barras y QR, lectura de braille, medición de dielines
- Workflows de aprobación: flujos personalizados (secuenciales o paralelos), checklists, deadlines, recordatorios automáticos, audit trail completo
- Digital Asset Management: repositorio único con control de versiones, permisos por rol, filtros por marca/mercado, guardado automático tras aprobación
- Dashboards: visibilidad ejecutiva en KPIs, proyectos en riesgo, cuellos de botella por departamento, reporting de compliance

SECTORES OBJETIVO:
- FMCG / Alimentación y bebidas (muchos SKUs, packaging frecuente, multi-mercado)
- Pharma & OTC / Parafarmacia (aprobación regulatoria obligatoria, serialización, trazabilidad legal)
- Cosmética y cuidado personal (cumplimiento INCI, claims, normativa europea)
- Retail / Marca del distribuidor (MDD) (catálogos, colecciones, PLV)
- Electrónica / Suplementos / Frescos / Industrial con marca propia

INTERLOCUTORES Y SU DOLOR:
- Marketing / Brand Manager: pierde semanas en rondas de revisión con la agencia, no tiene certeza de qué versión es la final
- Calidad / Regulatory Affairs: no puede demostrar la cadena de aprobaciones, auditorías son un caos, riesgo legal real
- Packaging / Artwork Manager: gestiona versiones por email y carpetas compartidas, errores detectados en producción
- Supply Chain / COO: los retrasos de packaging afectan directamente al lanzamiento y a la cadena de distribución
- C-Level / Director General: visibilidad ejecutiva nula sobre el estado de los proyectos, costes de reproceso ocultos

PRUEBA SOCIAL (citar solo el sector, no empresas concretas):
- Referenciado por líderes del sector FMCG, lácteos, cerveza, chucherías y distribución gran consumo en España

TONO Y ESTILO:
- Corto: máximo 130 palabras en emails de prospección, 60 en follow-ups
- Natural: no corporativo, no spam, sin listas de bullets ni enumeraciones de features
- Empático: abre con el dolor que ellos ya sienten, luego conecta con la solución
- CTA siempre: propón una llamada de 20 min adaptada al idioma — nunca "demo de 30 min"
- Personalizado al sector y al rol del destinatario
- NOMBRE: usa SOLO el nombre de pila del contacto — NUNCA el apellido, en ningún lugar del email
- IDIOMA OBLIGATORIO: escribe el email ÍNTEGRAMENTE en ${LANGUAGE_NAMES[language] ?? language}. Adapta el tono, expresiones y cierres al idioma seleccionado. Si el idioma no es español, traduce también el CTA y el cierre.
${useEmojis
  ? '- OBLIGATORIO: DEBES incluir entre 1 y 3 emojis en el cuerpo del email. Intégralos de forma natural dentro del texto (no los pongas todos juntos al final). Por ejemplo al inicio de un párrafo clave, en la propuesta de valor, o en la llamada a la acción. NO pongas emojis en el asunto (subject). Ejemplos de uso natural: "📦 Gestionar 40 referencias de packaging...", "¿Tienes 20 min esta semana? 📅", "La buena noticia es que hay una solución 💡".'
  : '- PROHIBIDO: NO uses emojis en ningún caso. El texto debe estar completamente limpio de emojis, tanto en el asunto como en el cuerpo.'}

FORMATO OBLIGATORIO DEL CUERPO:
- Cada párrafo separado por una línea en blanco (\\n\\n entre párrafos)
- NUNCA todo seguido: después de cada punto y aparte, salto de línea doble
- Estructura: saludo → observación/dolor → propuesta → CTA → cierre
- El SALUDO debe estar en el idioma seleccionado (${LANGUAGE_NAMES[language] ?? language}): "Hi [Name]," en inglés, "Hola [Nombre]," en español, "Bonjour [Prénom]," en francés, "Hallo [Name]," en alemán, etc.
- SIEMPRE termina con una línea de cierre natural y conversacional en su propia línea (separada por \\n\\n), en el idioma seleccionado.
- El cierre debe sonar natural, no forzado. Elige el que mejor encaje con el tono y el tipo de email.
- Ejemplo de estructura del body (en el idioma correcto): "[Saludo idioma] [Nombre],\\n\\nFrase de apertura sobre su empresa o sector.\\n\\nDolor concreto que reconocerán.\\n\\nCómo MyMediaConnect lo resuelve en una frase.\\n\\nCTA en el idioma seleccionado.\\n\\nCierre natural en el idioma seleccionado."

Responde SIEMPRE en JSON con "subject" (solo para emails) y "body".`

  // Pain points específicos por departamento/cargo (alineados con OnePager MMC v1)
  const departmentContext: Record<string, string> = {
    marketing: `El contacto es de Marketing o Brand Management. Su dolor más inmediato: pierde semanas en rondas de revisión de packaging con la agencia, no tiene certeza de qué versión es la final y los lanzamientos se retrasan por esperar aprobaciones internas. Resultado tangible para ellos: -45% time-to-market y -85% iteraciones de aprobación. Ángulo: cuántas horas a la semana pierde el equipo gestionando un solo arte entre emails, carpetas y comentarios dispersos.`,
    communication: `El contacto es de Comunicación o Brand. Gestiona la coherencia visual de marca. Le duele que la agencia trabaje con versiones desactualizadas, que sea imposible saber qué material está aprobado para usar y que no haya un repositorio único. Resultado clave: DAM centralizado con control de versiones, permisos por rol y guardado automático tras cada aprobación.`,
    executive: `El contacto es C-Level, Director General o Director de Digitalización. Le importa el ROI y la visibilidad ejecutiva: cuánto cuestan los reprocesos por errores de versión, cuánto retrasan los lanzamientos los cuellos de botella de aprobación y cómo justificar la inversión. Resultado clave: -50% costes de gestión, dashboards ejecutivos con KPIs en tiempo real y proyectos en riesgo identificados antes de que se conviertan en problemas.`,
    management: `El contacto es Management u Operaciones. Busca eficiencia operativa y coordinación entre departamentos. Le preocupan los cuellos de botella entre marketing, calidad, regulatory y agencias, y la falta de estándares en los procesos de aprobación. Resultado clave: workflows personalizados (secuenciales o paralelos), dashboards globales de lanzamientos y -45% en time-to-market.`,
    sales: `El contacto es de Ventas. Necesita materiales de punto de venta (PLV) y catálogos siempre actualizados. Le frustra recibir materiales erróneos del equipo de marketing que le afectan directamente en el punto de venta. Ángulo: impacto directo en ventas de tener materiales incorrectos o desactualizados en el lineal.`,
    finance: `El contacto es de Finanzas o Control de Gestión. Le interesa el ROI y la reducción de costes ocultos: tiradas repetidas por errores de versión, horas de retrabajo con agencias, costes de no-conformidades en auditorías. Resultado cuantificado: -50% costes de gestión del proceso y -75% errores en artes finales que generan reimpresiones costosas.`,
    it: `El contacto es IT o Sistemas. Le importan las integraciones con ERP, DAM o PIM existentes, la seguridad, el modelo SaaS sin infraestructura y la facilidad de implantación. Ángulo técnico: plataforma cloud, API disponible, modelo de permisos por rol, sin necesidad de infraestructura propia.`,
    hr: `El contacto es de RRHH. Gestiona materiales de employer branding y comunicación interna. Ángulo: control de versiones de materiales corporativos y coherencia de la marca empleadora en todos los materiales.`,
    quality: `El contacto es de Calidad, Regulatory Affairs o Asuntos Regulatorios. Su dolor más crítico: no puede demostrar la cadena de aprobaciones, las auditorías son un caos documental y existe riesgo legal real por falta de trazabilidad. Resultado clave: audit trail completo e inmutable de quién aprobó qué y cuándo, checklists de compliance integrados en el workflow, evidencia de aprobación lista para inspecciones regulatorias (-75% errores en artes finales).`,
  }

  const deptKey = (lead.department ?? '').toLowerCase()
  const deptPainPoints = departmentContext[deptKey] || ''

  // Solo nombre de pila — nunca apellido en emails comerciales
  const firstName = lead.first_name?.trim() || null

  const needsSummary = enrichment?.detected_needs?.join(', ') || 'no especificadas'
  const problemsSummary = enrichment?.detected_problems?.join(', ') || 'no identificados'
  const fitReason = enrichment?.media_connector_fit || 'encaje potencial detectado'

  const langName = LANGUAGE_NAMES[language] ?? language

  const userPrompt = `Genera el siguiente mensaje para este prospecto de MyMediaConnect:

⚠️ IDIOMA: Escribe TODO el email ÍNTEGRAMENTE en ${langName}. Absolutamente todo: saludo, cuerpo, CTA y cierre. CERO palabras en otro idioma.

TIPO: ${typeDescriptions[type]}
TONO: ${toneDescriptions[tone]}

DATOS DEL DESTINATARIO:
${firstName ? `- Nombre de pila (SOLO este, nunca el apellido): ${firstName}` : '- Nombre: desconocido (usa saludo genérico, nunca inventes un nombre)'}
- Cargo/Departamento: ${lead.department ?? lead.description ?? 'desconocido'}
- Empresa: ${lead.company_name}
- Web: ${lead.website ?? 'no disponible'}
- Sector: ${lead.sector ?? 'desconocido'}
- País: ${lead.country ?? 'desconocido'}
- Actividad: ${enrichment?.what_they_do ?? lead.description ?? 'no disponible'}
- Necesidades detectadas por IA: ${needsSummary}
- Problemas que MyMediaConnect podría resolver: ${problemsSummary}
- Por qué MyMediaConnect encaja: ${fitReason}
${deptPainPoints ? `\nÁNGULO ESPECÍFICO POR SU DEPARTAMENTO:\n${deptPainPoints}` : ''}
${additionalContext ? `- Contexto adicional: ${additionalContext}` : ''}

INSTRUCCIONES ESPECÍFICAS:
${firstName
  ? `- NOMBRE REGLA GLOBAL: usa ÚNICAMENTE el nombre de pila "${firstName}" en el saludo y en todo el cuerpo. JAMÁS uses el apellido ni ningún apellido.`
  : `- NOMBRE REGLA GLOBAL: este lead NO tiene nombre registrado. ABSOLUTAMENTE PROHIBIDO usar cualquier placeholder o variable de nombre como {{contactname}}, {{nombre}}, {{name}}, [Name], [Nombre], [Contact], {{firstName}}, [NOMBRE] o cualquier corchete/llave con nombre. El saludo y el cuerpo completo deben ir SIN nombre de contacto, usando un saludo genérico directo en ${langName}.`
}
${type === 'initial_email' ? `- SALUDO OBLIGATORIO: ${firstName
    ? `La PRIMERA línea del email DEBE ser el saludo apropiado en ${langName} seguido de "${firstName}," (ej: "Hi ${firstName}," en inglés, "Hola ${firstName}," en español, "Bonjour ${firstName}," en francés) — solo el nombre de pila, sin apellido`
    : `No tienes nombre de contacto, usa un saludo genérico apropiado en ${langName} (nunca inventes un nombre)`}
- Tras el saludo, abre con una observación concreta sobre su sector (no sobre la empresa concreta, no inventes datos)
- Elige UNO de los 4 dolores de MMC que más encaje con su sector/rol: time-to-market lento, versiones paralelas, retrabajo costoso o falta de trazabilidad
- Conecta ese dolor con MyMediaConnect en UNA sola frase, sin enumerar funcionalidades
- Si tienes datos de enriquecimiento, úsalos para personalizar el dolor (sector, volumen de SKUs, proceso regulatorio)
- CTA: "¿tienes 20 min esta semana?" o equivalente natural — nunca "demo"` : ''}
${type === 'followup_1' ? `- Referencia el email anterior en una frase muy breve
- El ángulo nuevo DEBE ser un dato cuantificado y creíble de MMC: "-85% menos rondas de aprobación", "-45% en time-to-market", "una tirada repetida por error de versión puede costar más que el software anual"
- O bien: una pregunta que genere reflexión sobre su proceso actual ("¿cuántas versiones de ese mismo arte habéis llegado a manejar en paralelo?")
- CTA directo y corto` : ''}
${type === 'followup_2' ? `- Tono humano, sin presión, sin vendedor
- Reconoce con naturalidad que quizás no es el momento o no es la persona adecuada
- Deja la puerta abierta: "si en algún momento lanzáis algo nuevo o el proceso de packaging se complica, aquí estamos"
- Opcional: mencionar que empresas líderes de su sector ya trabajan con MMC solo si encaja con el tono` : ''}
${type === 'linkedin_message' ? `- MÁXIMO 280 caracteres total, cuenta bien
- Alude a algo del sector o proceso de packaging — no a la empresa en concreto
- Genera curiosidad sobre el problema, no hagas pitch directo del producto` : ''}
${type === 'internal_summary' ? `- Formato de ficha interna, sin asunto
- Incluye: potencial (alto/medio/bajo) con justificación basada en SKUs/sector/regulación, cuál de los 4 dolores MMC sufren más, módulo más relevante (Proofing/Workflows/DAM/Dashboards), ángulo de venta recomendado por rol, próximos pasos concretos` : ''}

Responde SOLO con JSON: { "subject": "...", "body": "..." }
El subject puede ser null para LinkedIn y resumen interno.`

  const result = await callAI<{ subject?: string; body: string }>(
    systemPrompt,
    userPrompt,
    0.7,
    providerOverride,
    modelOverride
  )

  return {
    subject: result.subject ?? undefined,
    body: textToHtml(result.body),
    tokens_used: 0,
  }
}

// ============================================================
// MEJORAR MENSAJE ESCRITO POR EL USUARIO CON IA
// ============================================================
export async function improveMessage(
  userDraft: string,
  lead: Lead,
  enrichment: Partial<LeadEnrichment> | null,
  tone: MessageTone = 'consultivo',
  instructions?: string,
  providerOverride?: string | null,
  modelOverride?: string | null
): Promise<GeneratedMessage> {
  const toneDescriptions: Record<MessageTone, string> = {
    cercano: 'cercano e informal pero profesional, usando "tú"',
    formal: 'formal y profesional, usando "usted"',
    tecnico: 'técnico, orientado a IT, mencionando integraciones y automatización',
    directo: 'muy directo y conciso, sin rodeos',
    consultivo: 'consultivo, con preguntas y posicionándote como experto',
  }

  const systemPrompt = `Eres un experto en ventas B2B SaaS para MyMediaConnect, software de gestión de cadena gráfica de marca.
Tu tarea es mejorar y reescribir mensajes comerciales manteniendo la voz, intención y estructura del autor.
- Conserva la esencia y puntos clave del borrador original
- Mejora la claridad, fluidez y persuasión
- Elimina redundancias y lenguaje genérico
- Personaliza con datos concretos de la empresa si los tienes
- Mantén el tono solicitado
- Nunca suenas a spam corporativo
Responde SIEMPRE en JSON con "subject" (si aplica) y "body".`

  const userPrompt = `Mejora este borrador de mensaje comercial:

---BORRADOR---
${userDraft}
---FIN BORRADOR---

Contexto del destinatario:
Empresa: ${lead.company_name}
Sector: ${lead.sector ?? 'desconocido'}
País: ${lead.country ?? 'desconocido'}
${enrichment?.what_they_do ? `Qué hacen: ${enrichment.what_they_do}` : ''}
${enrichment?.detected_needs?.length ? `Necesidades: ${enrichment.detected_needs.join(', ')}` : ''}
${enrichment?.media_connector_fit ? `Encaje con el producto: ${enrichment.media_connector_fit}` : ''}

Tono deseado: ${toneDescriptions[tone]}
${instructions ? `\nInstrucciones adicionales del autor: ${instructions}` : ''}

Responde con JSON: { "subject": "..." (si el borrador tiene asunto o lo infiere del contexto, si no null), "body": "..." }
Mantén una longitud similar al borrador original.`

  const result = await callAI<{ subject?: string; body: string }>(
    systemPrompt,
    userPrompt,
    0.5,
    providerOverride,
    modelOverride
  )

  return {
    subject: result.subject ?? undefined,
    body: result.body,
    tokens_used: 0,
  }
}
