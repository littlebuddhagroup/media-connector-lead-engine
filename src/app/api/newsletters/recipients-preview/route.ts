import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// GET /api/newsletters/recipients-preview?target_type=all|list&target_list_id=xxx
// Devuelve el número de destinatarios efectivos (total - bajas)
// ============================================================

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetType   = searchParams.get('target_type') ?? 'all'
  const targetListId = searchParams.get('target_list_id') ?? ''

  const admin = createAdminClient()

  // Resolver leads candidatos
  let candidateEmails: string[] = []

  if (targetType === 'list' && targetListId) {
    const { data: members } = await admin
      .from('list_members')
      .select('lead:leads(email)')
      .eq('list_id', targetListId)
    const mapped: (string | null)[] = (members ?? []).map((m: Record<string, unknown>) => {
      const lead = m.lead as { email?: string } | null
      return lead?.email ?? null
    })
    candidateEmails = mapped.filter((e): e is string => typeof e === 'string' && e.trim() !== '')
  } else {
    const { data: leads } = await admin
      .from('leads')
      .select('email')
      .eq('user_id', user.id)
      .not('email', 'is', null)
      .neq('email', '')
    candidateEmails = (leads ?? []).map((l: { email: string }) => l.email)
  }

  const totalCandidates = candidateEmails.length

  // Filtrar bajas
  const { data: unsubscribed } = await admin
    .from('newsletter_unsubscribes')
    .select('email')
    .eq('user_id', user.id)

  const unsubscribedSet = new Set(
    (unsubscribed ?? []).map((u: { email: string }) => u.email.toLowerCase())
  )

  const effectiveEmails = candidateEmails.filter(e => !unsubscribedSet.has(e.toLowerCase()))
  const skipped = totalCandidates - effectiveEmails.length

  return NextResponse.json({
    data: {
      total_candidates: totalCandidates,
      unsubscribed: skipped,
      effective: effectiveEmails.length,
    }
  })
}
