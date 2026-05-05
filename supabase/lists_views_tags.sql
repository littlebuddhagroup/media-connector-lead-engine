-- ============================================================
-- MIGRACIÓN: Tags en leads + Listas estáticas + Vistas guardadas
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Tags en leads (array de texto libre)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);

-- 2. Listas estáticas de leads
CREATE TABLE IF NOT EXISTS lead_lists (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  description text,
  color       text DEFAULT '#6366f1',
  icon        text DEFAULT '📋',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_list_members (
  list_id    uuid REFERENCES lead_lists(id) ON DELETE CASCADE NOT NULL,
  lead_id    uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  added_at   timestamptz DEFAULT now(),
  PRIMARY KEY (list_id, lead_id)
);

-- 3. Vistas guardadas (filtros nombrados)
CREATE TABLE IF NOT EXISTS saved_views (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  filters    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 4. RLS
ALTER TABLE lead_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_lists" ON lead_lists;
CREATE POLICY "user_own_lists" ON lead_lists FOR ALL USING (user_id = auth.uid());

ALTER TABLE lead_list_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_list_members" ON lead_list_members;
CREATE POLICY "user_own_list_members" ON lead_list_members FOR ALL
  USING (list_id IN (SELECT id FROM lead_lists WHERE user_id = auth.uid()));

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_views" ON saved_views;
CREATE POLICY "user_own_views" ON saved_views FOR ALL USING (user_id = auth.uid());

-- 5. Índices para las nuevas tablas
CREATE INDEX IF NOT EXISTS idx_list_members_list   ON lead_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_lead   ON lead_list_members(lead_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_user    ON saved_views(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_lists_user     ON lead_lists(user_id);

-- 6. Índices de rendimiento en leads (queries frecuentes)
-- Permite filtrar y ordenar sin full-table scan con 10.000+ filas
CREATE INDEX IF NOT EXISTS idx_leads_user_id        ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status         ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority       ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id    ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_score_desc     ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at     ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_sector         ON leads(sector);
CREATE INDEX IF NOT EXISTS idx_leads_country        ON leads(country);

-- Índice compuesto para la query más frecuente: filtrar por usuario + ordenar por score
CREATE INDEX IF NOT EXISTS idx_leads_user_score
  ON leads(user_id, score DESC);

-- Búsqueda de texto en empresa, email y dominio (trigram para ilike eficiente)
-- Requiere extensión pg_trgm (disponible en Supabase por defecto)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_leads_company_trgm
  ON leads USING GIN(company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm
  ON leads USING GIN(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_domain_trgm
  ON leads USING GIN(domain gin_trgm_ops);
