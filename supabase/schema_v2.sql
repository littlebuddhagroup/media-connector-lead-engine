-- ============================================================
-- SCHEMA V2 — MyMediaConnect Lead Engine
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── EMAIL EVENTS (tracking de aperturas y clicks) ────────────
CREATE TABLE IF NOT EXISTS email_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id    UUID REFERENCES emails(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL, -- 'opened', 'clicked', 'bounced', 'delivered'
  occurred_at TIMESTAMPTZ DEFAULT now(),
  metadata    JSONB DEFAULT '{}'
);
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own email_events" ON email_events FOR ALL USING (auth.uid() = user_id);

-- Añadir columna opened_at a emails si no existe
ALTER TABLE emails ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS open_count INT DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS resend_id TEXT; -- ID de Resend para tracking

-- ── FOLLOW UPS (seguimientos automáticos programados) ────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  lead_id          UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id      UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  scheduled_for    TIMESTAMPTZ NOT NULL,
  sent_at          TIMESTAMPTZ,
  status           TEXT DEFAULT 'pending', -- 'pending', 'sent', 'cancelled', 'failed'
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follow_ups" ON follow_ups FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_for) WHERE status = 'pending';

-- ── SEQUENCES (secuencias de emails de 3 toques) ─────────────
CREATE TABLE IF NOT EXISTS sequences (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Secuencia 3 toques',
  status      TEXT DEFAULT 'active', -- 'active', 'paused', 'completed', 'cancelled'
  current_step INT DEFAULT 0,        -- 0=no iniciada, 1=email1 enviado, 2=email2 enviado, 3=completada
  started_at  TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  paused_reason TEXT,                -- 'replied', 'unsubscribed', 'manual'
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sequences" ON sequences FOR ALL USING (auth.uid() = user_id);

-- ── SEQUENCE STEPS (emails programados de la secuencia) ──────
CREATE TABLE IF NOT EXISTS sequence_steps (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id  UUID REFERENCES sequences(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number  INT NOT NULL,          -- 1, 2, 3
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  delay_days   INT NOT NULL,          -- días desde el paso anterior (1=inmediato, 5=día5, 10=día10)
  scheduled_for TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  email_id     UUID REFERENCES emails(id) ON DELETE SET NULL,
  status       TEXT DEFAULT 'pending', -- 'pending', 'sent', 'skipped'
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sequence_steps" ON sequence_steps FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_scheduled ON sequence_steps(scheduled_for) WHERE status = 'pending';
