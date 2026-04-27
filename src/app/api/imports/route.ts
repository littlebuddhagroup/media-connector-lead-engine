import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractDomain } from '@/lib/utils'

const REQUIRED_FIELDS = ['company_name']
const ALLOWED_FIELDS = [
  'company_name', 'website', 'domain', 'email', 'phone',
  'country', 'city', 'sector', 'description', 'linkedin_url',
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { rows, column_mapping, campaign_id, filename } = body

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
  const existingDomains = new Set<string>()
  const existingEmails = new Set<string>()

  // Obtener emails y dominios existentes para detectar duplicados
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('domain, email')
    .eq('user_id', user.id)

  existingLeads?.forEach(l => {
    if (l.domain) existingDomains.add(l.domain.toLowerCase())
    if (l.email) existingEmails.add(l.email.toLowerCase())
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
    const email = (lead.email as string)?.toLowerCase()

    if (domain && existingDomains.has(domain)) {
      errors.push({ row: index + 1, message: `Duplicado: dominio ${domain} ya existe` })
      return
    }
    if (email && existingEmails.has(email)) {
      errors.push({ row: index + 1, message: `Duplicado: email ${email} ya existe` })
      return
    }

    if (domain) existingDomains.add(domain)
    if (email) existingEmails.add(email)

    leadsToInsert.push(lead)
  })

  // Insertar leads en lotes
  let imported = 0
  const batchSize = 50
  for (let i = 0; i < leadsToInsert.length; i += batchSize) {
    const batch = leadsToInsert.slice(i, i + batchSize)
    const { error } = await supabase.from('leads').insert(batch)
    if (!error) imported += batch.length
  }

  // Actualizar registro de importación
  await supabase
    .from('imports')
    .update({
      imported_rows: imported,
      skipped_rows: errors.length,
      error_rows: errors.length,
      status: 'completed',
      errors: errors.slice(0, 100), // Guardar máx 100 errores
    })
    .eq('id', importRecord?.id)

  // Actualizar contador de campaña
  if (campaign_id && imported > 0) {
    await supabase
      .from('campaigns')
      .update({ total_leads: supabase.rpc('increment', { x: imported }) as unknown as number })
      .eq('id', campaign_id)
  }

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
