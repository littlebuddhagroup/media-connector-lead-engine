-- ============================================================
-- Migration: Notifications & Intelligence modules
-- MyMediaConnect — run once in Supabase SQL Editor
-- ============================================================

-- Settings: notification preferences
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS notification_emails    TEXT,
  ADD COLUMN IF NOT EXISTS briefing_enabled       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS signal_alerts_enabled  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS intelligence_modules   JSONB DEFAULT '{
    "enrichment":  true,
    "sequences":   true,
    "briefing":    true,
    "prospecting": true,
    "signals":     true
  }'::jsonb;

-- Leads: track when each lead was last checked for signals
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS signal_checked_at TIMESTAMPTZ;

-- Activity logs: ensure signal_detected type is accepted
-- (no change needed — type is free text)

-- Index for efficient signal queries
CREATE INDEX IF NOT EXISTS idx_leads_signal_checked_at
  ON leads (signal_checked_at)
  WHERE status IN ('new', 'contacted', 'interested');
