-- ============================================================
-- CAMPAÑAS v2 — Mejoras: objetivos, fechas y plantillas
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Añadir columnas de objetivos y fechas a campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS goal_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_meetings INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_replies INTEGER DEFAULT 0;

-- Tabla de plantillas de secuencia (reutilizables por campaña)
CREATE TABLE IF NOT EXISTS sequence_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- steps: array de {step_number, subject, body, delay_days, tone}
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_templates_user_id ON sequence_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_templates_campaign_id ON sequence_templates(campaign_id);

-- RLS
ALTER TABLE sequence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their templates" ON sequence_templates
  FOR ALL USING (user_id = auth.uid());
