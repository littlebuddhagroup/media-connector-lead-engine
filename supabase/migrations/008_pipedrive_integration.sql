-- ============================================================
-- Migración 008: Soporte para integración con Pipedrive
-- Añade columnas de referencia y fuente a leads
-- ============================================================

-- Columna source para saber de dónde viene el lead
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;

COMMENT ON COLUMN public.leads.source IS
  'Origen del lead: null=manual, pipedrive, csv, apollo, hunter...';

-- IDs de referencia en Pipedrive (para sync bidireccional)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pipedrive_deal_id BIGINT DEFAULT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pipedrive_person_id BIGINT DEFAULT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pipedrive_org_id BIGINT DEFAULT NULL;

COMMENT ON COLUMN public.leads.pipedrive_deal_id IS 'ID del deal en Pipedrive (para sync bidireccional)';
COMMENT ON COLUMN public.leads.pipedrive_person_id IS 'ID de la persona en Pipedrive';
COMMENT ON COLUMN public.leads.pipedrive_org_id IS 'ID de la organización en Pipedrive';

-- Índices para búsqueda por ID de Pipedrive
CREATE INDEX IF NOT EXISTS idx_leads_pipedrive_deal ON public.leads(pipedrive_deal_id) WHERE pipedrive_deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_pipedrive_org ON public.leads(pipedrive_org_id) WHERE pipedrive_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source) WHERE source IS NOT NULL;
