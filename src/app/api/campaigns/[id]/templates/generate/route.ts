import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateMessage } from '@/services/aiService'
import { getUserAISettings } from '@/lib/getUserAIProvider'
import type { Lead, MessageTone } from '@/types'

type Params = { params: Promise<{ id: string }> }

// ============================================================
// CAMPAIGN TEMPLATE GENERATOR
// Usa exactamente generateMessage() de aiService — mismo sistema
// que la secuencia individual de lead. Las variables de plantilla
// ({{company_name}}, {{contact_name}}, {{sector}}) se pasan como
// datos del lead ficticio para que queden literalmente en el output.
// ============================================================

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: campaign } = await admin
    .from('campaigns')
    .select('name, description, sector, country, language')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const useEmojis: boolean = body.useEmojis ?? false
  const language: string = body.language ?? campaign.language ?? 'es'
  const totalSteps: 3 | 5 = body.total_steps === 5 ? 5 : 3

  const defaultTones3: MessageTone[] = ['consultivo', 'directo', 'cercano']
  const defaultTones5: MessageTone[] = ['consultivo', 'directo', 'cercano', 'formal', 'directo']
  const tones: MessageTone[] = body.tones?.length >= totalSteps
    ? body.tones.slice(0, totalSteps)
    : (totalSteps === 5 ? defaultTones5 : defaultTones3)

  const stepTypes = totalSteps === 5
    ? ['initial_email', 'followup_1', 'followup_2', 'followup_1', 'followup_2'] as const
    : ['initial_email', 'followup_1', 'followup_2'] as const

  const stepDelays = totalSteps === 5 ? [0, 4, 8, 13, 18] : [0, 5, 10]

  // Lead ficticio: los campos de nombre y empresa son las propias variables
  // de plantilla — la IA las usará literalmente en el texto generado.
  const mockLead: Lead = {
    id: 'template',
    user_id: user.id,
    company_name: '{{company_name}}',
    first_name: '{{contact_name}}',
    last_name: undefined,
    email: undefined,
    phone: undefined,
    website: undefined,
    sector: campaign.sector ?? 'gran consumo',
    country: campaign.country ?? 'España',
    department: 'marketing',
    job_title: undefined,
    description: campaign.description ?? undefined,
    source: 'manual',
    status: 'new',
    priority: 'medium',
    score: 75,
    is_enriched: false,
    linkedin_url: undefined,
    city: undefined,
    campaign_id: id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Enriquecimiento ficticio orientado al sector de la campaña
  const mockEnrichment = {
    what_they_do: `Empresa del sector ${campaign.sector ?? 'gran consumo'} con gestión activa de materiales gráficos y packaging`,
    detected_needs: [
      'Gestión de versiones de artes gráficas y packaging',
      'Flujos de aprobación internos más ágiles',
      'Control de cambios entre marketing, jurídico y agencia',
    ],
    detected_problems: [
      'Pérdida de tiempo buscando la versión correcta del artwork entre emails',
      'Retrasos en lanzamientos por cuellos de botella en aprobaciones internas',
    ],
    media_connector_fit: `Empresa con claras necesidades de gestión de cadena gráfica en el sector ${campaign.sector ?? 'gran consumo'}`,
  }

  try {
    const { provider: aiProvider, model: aiModel } = await getUserAISettings(supabase, user.id)

    // Generar todos los emails en paralelo (3 o 5 según total_steps)
    const emails = await Promise.all(
      Array.from({ length: totalSteps }, (_, i) =>
        generateMessage(mockLead, mockEnrichment, stepTypes[i] as Parameters<typeof generateMessage>[2], tones[i], undefined, useEmojis, language, aiProvider, aiModel)
      )
    )

    const fallbackSubjects = [
      `{{company_name}} — Gestión de materiales gráficos`,
      `Re: ¿Has tenido ocasión de revisar mi email?`,
      `Último apunte antes de cerrar mi agenda`,
      `Una idea concreta para {{company_name}}`,
      `Cerramos el hilo — ¿te interesa?`,
    ]

    const steps = emails.map((email, i) => ({
      step_number: i + 1,
      subject: email.subject ?? fallbackSubjects[i],
      body: email.body,
      delay_days: stepDelays[i],
      tone: tones[i],
    }))

    return NextResponse.json({ data: steps })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generando plantilla'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
