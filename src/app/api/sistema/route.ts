import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/sistema — Estado del sistema de automatización MyMediaConnect
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const since30d = new Date()
  since30d.setDate(since30d.getDate() - 30)

  const [
    { count: totalLeads },
    { count: enrichedLeads },
    { count: activeSequences },
    { count: emailsSent30d },
    { count: autoProspected },
    { data: recentActivity },
    { data: signalEvents },
  ] = await Promise.all([
    admin.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('lead_enrichments').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('sequences').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active'),
    admin.from('activity_logs').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'email_sent')
      .gte('created_at', since30d.toISOString()),
    admin.from('activity_logs').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'auto_prospected')
      .gte('created_at', since30d.toISOString()),
    admin.from('activity_logs').select('id, type, title, description, created_at, lead_id')
      .eq('user_id', user.id)
      .in('type', [
        'auto_enriched', 'auto_prospected', 'signal_detected',
        'sequence_paused_reply', 'briefing_sent', 'email_sent',
        'lead_created', 'sequence_launched',
      ])
      .order('created_at', { ascending: false })
      .limit(25),
    admin.from('activity_logs').select('id, title, description, created_at')
      .eq('user_id', user.id)
      .eq('type', 'signal_detected')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Última ejecución de cada módulo
  const moduleTypes = [
    { key: 'enrichment',  types: ['auto_enriched']          },
    { key: 'briefing',    types: ['briefing_sent']          },
    { key: 'sequences',   types: ['sequence_paused_reply']  },
    { key: 'prospecting', types: ['auto_prospected']        },
    { key: 'signals',     types: ['signal_detected']        },
  ]

  const lastRunResults = await Promise.all(
    moduleTypes.map(({ key, types }) =>
      admin.from('activity_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .in('type', types)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }: { data: { created_at: string }[] | null }) => ({ key, lastRun: data?.[0]?.created_at ?? null }))
    )
  )

  const lastRunMap: Record<string, string | null> = {}
  lastRunResults.forEach(({ key, lastRun }) => { lastRunMap[key] = lastRun })

  return NextResponse.json({
    stats: {
      totalLeads: totalLeads ?? 0,
      enrichedLeads: enrichedLeads ?? 0,
      activeSequences: activeSequences ?? 0,
      emailsSent30d: emailsSent30d ?? 0,
      autoProspected: autoProspected ?? 0,
    },
    lastRun: lastRunMap,
    recentActivity: recentActivity ?? [],
    signalEvents: signalEvents ?? [],
  })
}
