-- ============================================================
-- email_tracking_v2.sql
-- Columnas de tracking + estados para webhook de Resend
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Añadir columnas de tracking si no existen
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS open_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at   TIMESTAMPTZ;

-- 2. Ampliar el CHECK de status para incluir los nuevos estados de Resend
--    (PostgreSQL requiere DROP + ADD del constraint)
ALTER TABLE public.emails
  DROP CONSTRAINT IF EXISTS emails_status_check;

ALTER TABLE public.emails
  ADD CONSTRAINT emails_status_check CHECK (
    status IN (
      'draft', 'sent', 'delivered', 'opened', 'clicked',
      'replied', 'bounced', 'failed', 'spam', 'delayed'
    )
  );

-- 3. Índice para búsquedas por provider_id (Resend email ID)
CREATE INDEX IF NOT EXISTS idx_emails_provider_id ON public.emails(provider_id);

-- 4. Índice para ordenar por aperturas
CREATE INDEX IF NOT EXISTS idx_emails_opened_at ON public.emails(opened_at DESC);
