-- ============================================================
-- MIGRACIÓN 003: Tabla campaign_leads (many-to-many)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Crear la tabla junction
CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  added_by    UUID,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

-- 2. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id    ON public.campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_user_id    ON public.campaign_leads(user_id);

-- 3. Row Level Security
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_leads_own" ON public.campaign_leads;
CREATE POLICY "campaign_leads_own" ON public.campaign_leads
  FOR ALL USING (auth.uid() = user_id);

-- 4. Migrar datos existentes desde leads.campaign_id
--    (cada lead que ya tiene campaign_id pasa a la junction table)
INSERT INTO public.campaign_leads (campaign_id, lead_id, user_id)
SELECT l.campaign_id, l.id, l.user_id
FROM public.leads l
WHERE l.campaign_id IS NOT NULL
ON CONFLICT (campaign_id, lead_id) DO NOTHING;

-- Verificar cuántos registros se migraron
SELECT COUNT(*) AS leads_migrados FROM public.campaign_leads;
