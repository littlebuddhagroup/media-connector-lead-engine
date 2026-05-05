-- ============================================================
-- Migration 004: Newsletter unsubscribes + tracking columns
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla global de bajas (un email dado de baja no vuelve a recibir newsletters)
CREATE TABLE IF NOT EXISTS public.newsletter_unsubscribes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  newsletter_id UUID REFERENCES public.newsletters(id) ON DELETE SET NULL,
  recipient_id  UUID,  -- newsletter_recipients.id al momento de la baja
  reason        TEXT DEFAULT 'user_request',
  unsubscribed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, user_id)
);

ALTER TABLE public.newsletter_unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own unsubscribes" ON public.newsletter_unsubscribes
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Columnas de tracking en newsletter_recipients
ALTER TABLE public.newsletter_recipients
  ADD COLUMN IF NOT EXISTS open_count      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- 3. Columna total_unsubscribed en newsletters
ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS total_unsubscribed INTEGER DEFAULT 0;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_newsletter_unsubscribes_email   ON public.newsletter_unsubscribes(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_unsubscribes_user_id ON public.newsletter_unsubscribes(user_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_recipients_provider  ON public.newsletter_recipients(provider_id) WHERE provider_id IS NOT NULL;
