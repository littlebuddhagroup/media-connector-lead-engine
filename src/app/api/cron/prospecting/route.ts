import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// CRON JOB — Autonomous Weekly Prospecting — MyMediaConnect
// Schedule: 0 7 * * 1  (07:00 every Monday)
//
// Reads active campaigns and searches for new leads via Apollo
// matching MyMediaConnect's ICP: FMCG, Pharma, Cosmetics and
// Retail/MDD companies with complex multi-SKU packaging workflows.
// ============================================================

const APOLLO_KEY = process.env.APOLLO_API_KEY ?? ''

// ICP sector → Apollo industry tags
// Target: companies with high-volume, multi-market packaging needs
const SECTOR_TO_APOLLO: Record<string, string[]> = {
  'FMCG / Alimentación y bebidas': ['food and beverages', 'food production', 'beverages', 'consumer goods'],
  'Cosmética y cuidado personal':  ['cosmetics', 'personal care', 'beauty', 'health beauty and fitness'],
  'Pharma y OTC':                  ['pharmaceuticals', 'health care', 'biotechnology', 'medical devices'],
  'Retail / MDD':                  ['retail', 'consumer goods', 'supermarkets'],
  'Electrónica / Tecnología':      ['consumer electronics', 'electrical electronic manufacturing'],
  'Suplementos y nutrición':       ['health wellness and fitness', 'food production'],
  'Frescos y refrigerados':        ['food and beverages', 'food production'],
  'Industrial con marca propia':   ['industrial automation', 'manufacturing', 'consumer goods'],
  // Fallback for campaigns without sector
  'default':                       ['consumer goods', 'food and beverages', 'pharmaceuticals'],
}

// Decision-makers with packaging / artwork / marketing responsibility
const ICP_TITLES = [
  // Packaging & Artwork
  'Packaging Manager', 'Artwork Manager', 'Packaging Director',
  'Head of Packaging', 'Packaging Development Manager',
  // Marketing & Brand
  'Marketing Director', 'Brand Manager', 'CMO', 'Head of Marketing',
  'Marketing Manager', 'Brand Director',
  // Quality & Regulatory
  'Quality Manager', 'Regulatory Affairs Manager',
  'Head of Quality', 'Compliance Manager',
  // General
  'CEO', 'COO', 'Innovation Director',
]

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!APOLLO_KEY) return NextResponse.json({ error: 'APOLLO_API_KEY not configured' }, { status: 400 })

  const admin = createAdminClient()

  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, name, sector, country, user_id, keywords')
    .eq('status', 'active')

  if (!campaigns?.length) return NextResponse.json({ message: 'No active campaigns', added: 0 })

  let totalAdded = 0
  const results: { campaign: string; added: number }[] = []

  for (const campaign of campaigns) {
    try {
      const industryTags = SECTOR_TO_APOLLO[campaign.sector ?? ''] ?? SECTOR_TO_APOLLO['default']
      const country = campaign.country ?? 'Spain'

      const payload = {
        page: 1,
        per_page: 10,
        // ICP: director/manager level, not just C-suite — packaging decisions happen mid-level
        person_seniorities: ['director', 'c_suite', 'vp', 'head', 'manager', 'senior'],
        person_titles: ICP_TITLES,
        q_organization_keyword_tags: industryTags,
        person_locations: [country],
        // Filter for companies with actual products — exclude pure services
        q_organization_num_employees_ranges: ['11,200', '201,1000', '1001,10000'],
      }

      const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_KEY,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) continue

      const data = await res.json()
      const people = data.people ?? []

      const { data: existing } = await admin
        .from('leads')
        .select('domain, email')
        .eq('user_id', campaign.user_id)

      const existingDomains = new Set((existing ?? []).map((l: { domain: string | null }) => l.domain?.toLowerCase()).filter(Boolean))
      const existingEmails = new Set((existing ?? []).map((l: { email: string | null }) => l.email?.toLowerCase()).filter(Boolean))

      const toInsert = []
      for (const p of people) {
        const org = p.organization
        const domain = org?.primary_domain?.toLowerCase() ?? ''
        const email = p.email?.toLowerCase() ?? ''

        if (existingDomains.has(domain) || (email && existingEmails.has(email))) continue

        toInsert.push({
          company_name: org?.name ?? 'Unknown company',
          domain: org?.primary_domain ?? null,
          website: org?.website_url ?? null,
          sector: org?.industry ?? campaign.sector ?? null,
          country: org?.country ?? campaign.country ?? null,
          email: p.email ?? null,
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          linkedin_url: p.linkedin_url ?? null,
          description: p.title ? `${p.name ?? ''} — ${p.title}` : null,
          campaign_id: campaign.id,
          user_id: campaign.user_id,
          source: 'apollo',
          status: 'new',
        })

        if (domain) existingDomains.add(domain)
        if (email) existingEmails.add(email)
      }

      if (toInsert.length > 0) {
        const { data: inserted, error } = await admin.from('leads').insert(toInsert).select('id, company_name')
        if (!error && inserted?.length) {
          await admin.from('activity_logs').insert(
            inserted.map((l: { id: string; company_name: string }) => ({
              lead_id: l.id,
              user_id: campaign.user_id,
              campaign_id: campaign.id,
              type: 'auto_prospected',
              title: `Auto-prospected: ${l.company_name}`,
              description: `Automatically added to campaign "${campaign.name}"`,
            }))
          )
          totalAdded += inserted.length
          results.push({ campaign: campaign.name, added: inserted.length })
        }
      }
    } catch {
      // Continue with next campaign
    }
  }

  return NextResponse.json({
    message: 'Weekly prospecting complete',
    totalAdded,
    results,
    timestamp: new Date().toISOString(),
  })
}
