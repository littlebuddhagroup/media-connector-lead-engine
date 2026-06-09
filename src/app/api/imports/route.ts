import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { extractDomain } from '@/lib/utils'

const REQUIRED_FIELDS = ['company_name']
const ALLOWED_FIELDS = [
  'company_name', 'first_name', 'last_name', 'job_title', 'department',
  'website', 'domain', 'email', 'phone',
  'country', 'city', 'sector', 'description', 'linkedin_url',
  'priority', 'status',
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { rows, column_mapping, campaign_id, filename, list_id } = body

  if (!rows?.length) return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
  if (!column_mapping) return NextResponse.json({ error: 'column_mapping requerido' }, { status: 400 })

  // Crear registro de importación
  const { data: importRecord } = await supabase
    .from('imports')
    .insert({
      user_id: user.id,
      campaign_id,
      filename: filename ?? 'import.csv',
      total_rows: rows.length,
      status: 'processing',
      column_mapping,
    })
    .select()
    .single()

  const errors: Array<{ row: number; message: string }> = []
  const leadsToInsert: Record<string, unknown>[] = []
  const existingDomains = new Map<string, string>() // domain → lead_id
  const existingEmails = new Map<string, string>()  // email  → lead_id
  const duplicateLeadIds = new Set<string>()        // leads ya existentes a vincular a la campaña

  // Obtener emails y dominios existentes para detectar duplicados
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('id, domain, email')
    .eq('user_id', user.id)

  existingLeads?.forEach(l => {
    if (l.domain) existingDomains.set(l.domain.toLowerCase(), l.id)
    if (l.email)  existingEmails.set(l.email.toLowerCase(), l.id)
  })

  // Procesar filas
  rows.forEach((row: Record<string, string>, index: number) => {
    const lead: Record<string, unknown> = { user_id: user.id, source: 'csv' }
    if (campaign_id) lead.campaign_id = campaign_id

    // Mapear columnas
    for (const [field, csvCol] of Object.entries(column_mapping as Record<string, string>)) {
      if (!csvCol || !ALLOWED_FIELDS.includes(field)) continue
      const value = row[csvCol]?.trim()
      if (value) lead[field] = value
    }

    // Validar campos requeridos
    for (const req of REQUIRED_FIELDS) {
      if (!lead[req]) {
        errors.push({ row: index + 1, message: `Falta campo requerido: ${req}` })
        return
      }
    }

    // Extraer dominio
    if (!lead.domain && lead.website) {
      lead.domain = extractDomain(lead.website as string)
    }

    // Detectar duplicados (dentro del mismo import también)
    const domain = (lead.domain as string)?.toLowerCase()
    const email  = (lead.email  as string)?.toLowerCase()

    const dupId = (domain && existingDomains.get(domain)) || (email && existingEmails.get(email))
    if (dupId) {
      errors.push({ row: index + 1, message: `Duplicado: ya existe (${domain || email})` })
      // Si hay campaña, marcarlo para vincularlo igualmente
      if (campaign_id) duplicateLeadIds.add(dupId)
      return
    }

    if (domain) existingDomains.set(domain, 'pending')
    if (email)  existingEmails.set(email, 'pending')

    leadsToInsert.push(lead)
  })

  // Insertar leads en lotes
  let imported = 0
  const insertedLeadIds: string[] = []
  const batchSize = 50
  for (let i = 0; i < leadsToInsert.length; i += batchSize) {
    const batch = leadsToInsert.slice(i, i + batchSize)
    const { data: insertedBatch, error } = await supabase.from('leads').insert(batch).select('id')
    if (!error && insertedBatch) {
      imported += insertedBatch.length
      insertedLeadIds.push(...insertedBatch.map((l: { id: string }) => l.id))
    }
  }

  // Asignar a lista si se especificó list_id
  if (list_id && insertedLeadIds.length > 0) {
    await supabase
      .from('lead_list_members')
      .upsert(
        insertedLeadIds.map(lid => ({ list_id, lead_id: lid })),
        { onConflict: 'list_id,lead_id', ignoreDuplicates: true }
      )
  }

  // Asignar a campaign_leads todos los leads relacionados con esta campaña:
  // 1. Los recién insertados  2. Los duplicados que ya existían
  if (campaign_id) {
    const adminClient = createAdminClient()
    const allCampLeadIds = [
      ...insertedLeadIds,
      ...Array.from(duplicateLeadIds),
    ]
    if (allCampLeadIds.length > 0) {
      await adminClient
        .from('campaign_leads')
        .upsert(
          allCampLeadIds.map(lid => ({ campaign_id, lead_id: lid, user_id: user.id })),
          { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true }
        )
    }
  }

  // Actualizar registro de importación
  await supabase
    .from('imports')
    .update({
      imported_rows: imported,
      skipped_rows: errors.length,
      error_rows: errors.length,
      status: 'completed',
      errors: errors.slice(0, 100),
    })
    .eq('id', importRecord?.id)

  return NextResponse.json({
    data: {
      import_id: importRecord?.id,
      total: rows.length,
      imported,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    },
  })
}
