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

  // ── Datos de distribución por sector y país (para el Mapa de Penetración) ──
  const { data: leadDistribution } = await admin
    .from('leads')
    .select('sector, country, priority')
    .eq('user_id', user.id)
    .not('sector', 'is', null)

  // Agrupar por sector y país en memoria (Supabase no tiene GROUP BY en el client)
  type PenetrationEntry = { sector: string; country: string; count: number; highCount: number }
  const penetrationMap: Record<string, PenetrationEntry> = {}
  for (const lead of leadDistribution ?? []) {
    if (!lead.sector) continue
    const key = `${lead.sector}|${lead.country ?? 'Desconocido'}`
    if (!penetrationMap[key]) {
      penetrationMap[key] = { sector: lead.sector, country: lead.country ?? 'Desconocido', count: 0, highCount: 0 }
    }
    penetrationMap[key].count++
    if (lead.priority === 'high') penetrationMap[key].highCount++
  }
  const penetrationData = Object.values(penetrationMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20) // top 20 combinaciones sector/país

  // ── Todas las señales recientes (para filtrar por tipo en siguiente paso) ──
  // Los títulos siguen el patrón: "🎯 Signal at {company}: {signal.label}"
  // donde signal.label puede ser:
  //   "Regulatory or labelling compliance issue" → recall/compliance
  //   "New product or SKU expansion"             → lanzamiento
  const [
    { count: totalLeads },
    { count: enrichedLeads },
    { count: activeSequences },
    { count: emailsSent30d },
    { count: autoProspected },
    { data: recentActivity },
    { data: allSignalEvents },
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
    // Todas las señales de los últimos 60 días para clasificarlas por tipo
    admin.from('activity_logs').select('id, title, description, created_at, lead_id')
      .eq('user_id', user.id)
      .eq('type', 'signal_detected')
      .order('created_at', { ascending: false })
      .limit(30),
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

  // ── Clasificar señales por tipo según el contenido del título ──────────────
  // Los keywords coinciden con signal.label del cron de señales
  const recallKeywords    = ['compliance', 'recall', 'labelling error', 'regulatory', 'retirada', 'etiquetado']
  const launchKeywords    = ['product', 'sku', 'launch', 'lanzamiento', 'nueva gama', 'new product']

  type SignalRow = { id: string; title: string | null; description: string | null; created_at: string; lead_id?: string | null }
  const allSignals: SignalRow[] = (allSignalEvents ?? []) as SignalRow[]

  const recallSignals = allSignals
    .filter((e: SignalRow) => recallKeywords.some(k => (e.title ?? '').toLowerCase().includes(k) || (e.description ?? '').toLowerCase().includes(k)))
    .slice(0, 5)

  const productLaunchSignals = allSignals
    .filter((e: SignalRow) => launchKeywords.some(k => (e.title ?? '').toLowerCase().includes(k)) && !recallKeywords.some(k => (e.title ?? '').toLowerCase().includes(k)))
    .slice(0, 5)

  // Señales generales (excluyendo las clasificadas arriba para el panel principal)
  const classifiedIds = new Set([...recallSignals, ...productLaunchSignals].map((e: SignalRow) => e.id))
  const signalEvents = allSignals.filter((e: SignalRow) => !classifiedIds.has(e.id)).slice(0, 5)

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
    signalEvents,
    // Señales clasificadas para los monitores dedicados
    recallSignals,
    productLaunchSignals,
    // Distribución de leads por sector y país
    penetrationData,
  })
}
