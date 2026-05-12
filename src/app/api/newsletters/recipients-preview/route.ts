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
  // Soporte para múltiples list IDs: ?list_ids=id1,id2,id3
  const listIdsParam = searchParams.get('list_ids') ?? ''
  const listIds = listIdsParam ? listIdsParam.split(',').filter(Boolean) : []

  const admin = createAdminClient()

  // Resolver leads candidatos — solo desde listas seleccionadas
  let candidateEmails: string[] = []

  if (listIds.length > 0) {
    const { data: members } = await admin
      .from('lead_list_members')
      .select('lead:leads(email)')
      .in('list_id', listIds)
    const seen = new Set<string>()
    for (const m of members ?? []) {
      const email = (m.lead as { email?: string } | null)?.email
      if (email && !seen.has(email.toLowerCase())) {
        seen.add(email.toLowerCase())
        candidateEmails.push(email)
      }
    }
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
