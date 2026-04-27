import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichLead } from '@/services/enrichmentService'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API Key no configurada. Ve a Configuración.' },
      { status: 400 }
    )
  }

  try {
    const result = await enrichLead(id, user.id)
    return NextResponse.json({ data: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error enriqueciendo lead'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
