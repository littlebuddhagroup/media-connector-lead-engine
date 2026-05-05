-- ============================================================
-- MIGRACIÓN 002 — Feature Updates
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ============================================================
-- 1. FIX CRÍTICO: UNIQUE constraint en lead_enrichments
--    Sin esto el upsert falla y los enriquecimientos no se guardan
-- ============================================================
ALTER TABLE public.lead_enrichments
  DROP CONSTRAINT IF EXISTS lead_enrichments_lead_id_unique;

ALTER TABLE public.lead_enrichments
  ADD CONSTRAINT lead_enrichments_lead_id_unique UNIQUE (lead_id);

-- ============================================================
-- 2. MULTI-CAMPAÑA: tabla junction campaign_leads
--    Permite que un lead esté en múltiples campañas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON public.campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_user_id ON public.campaign_leads(user_id);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_leads_own" ON public.campaign_leads FOR ALL USING (auth.uid() = user_id);

-- Migrar datos existentes (leads con campaign_id ya asignado)
INSERT INTO public.campaign_leads (campaign_id, lead_id, user_id)
SELECT l.campaign_id, l.id, l.user_id
FROM public.leads l
WHERE l.campaign_id IS NOT NULL
ON CONFLICT (campaign_id, lead_id) DO NOTHING;

-- ============================================================
-- 3. DETECCIÓN DE RESPUESTAS: columnas en emails y sequences
-- ============================================================

-- Añadir open_count y click_count a emails si no existen
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS open_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_manually BOOLEAN DEFAULT false;

-- Añadir campo replied_at a sequence_steps si no existe
ALTER TABLE public.sequence_steps
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Tabla de emails entrantes (reply detection via inbound webhook)
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_email      TEXT NOT NULL,
  to_email        TEXT NOT NULL,
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  in_reply_to     TEXT,  -- Message-ID del email original
  references_ids  TEXT,  -- Thread references
  resend_email_id TEXT,  -- ID del email en Resend que generó esta respuesta
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sequence_id     UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed       BOOLEAN DEFAULT false,
  raw_payload     JSONB,
  received_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_from_email ON public.inbound_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_lead_id ON public.inbound_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_received_at ON public.inbound_emails(received_at DESC);

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbound_emails_own" ON public.inbound_emails FOR ALL USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Añadir tipo de log para respuesta manual
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_type_check;

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_type_check CHECK (type IN (
    'lead_created', 'lead_updated', 'status_changed',
    'enriched', 'scored', 'message_generated', 'email_sent',
    'email_replied', 'email_opened', 'email_clicked',
    'email_bounced', 'email_delivered', 'email_spam',
    'note_added', 'task_created', 'task_completed',
    'imported', 'sequence_replied', 'reply_detected'
  ));

-- ============================================================
-- 4. NEWSLETTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  body_text       TEXT,
  from_email      TEXT,
  from_name       TEXT,
  reply_to        TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN (
                    'draft', 'scheduled', 'sending', 'sent', 'cancelled'
                  )),
  -- Programación
  scheduled_for   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  -- Stats
  total_recipients  INTEGER DEFAULT 0,
  total_sent        INTEGER DEFAULT 0,
  total_delivered   INTEGER DEFAULT 0,
  total_opened      INTEGER DEFAULT 0,
  total_clicked     INTEGER DEFAULT 0,
  total_bounced     INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  -- Targeting
  target_type     TEXT DEFAULT 'leads',  -- 'leads', 'list', 'all'
  target_list_id  UUID REFERENCES public.lead_lists(id) ON DELETE SET NULL,
  target_filters  JSONB,  -- {status, priority, tags, campaign_id}
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_user_id ON public.newsletters(user_id);
CREATE INDEX IF NOT EXISTS idx_newsletters_status ON public.newsletters(status);

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletters_own" ON public.newsletters FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER newsletters_updated_at
  BEFORE UPDATE ON public.newsletters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Destinatarios de newsletter (tracking individual)
CREATE TABLE IF NOT EXISTS public.newsletter_recipients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id   UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT,
  from_email      TEXT,  -- La cuenta de rotación usada para este envío
  provider_id     TEXT,  -- ID del envío en Resend
  status          TEXT DEFAULT 'pending' CHECK (status IN (
                    'pending', 'sent', 'delivered', 'opened',
                    'clicked', 'bounced', 'failed', 'unsubscribed'
                  )),
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  open_count      INTEGER DEFAULT 0,
  click_count     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_recipients_newsletter_id ON public.newsletter_recipients(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_recipients_lead_id ON public.newsletter_recipients(lead_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_recipients_email ON public.newsletter_recipients(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_recipients_status ON public.newsletter_recipients(status);

ALTER TABLE public.newsletter_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter_recipients_own" ON public.newsletter_recipients FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER newsletter_recipients_updated_at
  BEFORE UPDATE ON public.newsletter_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Plantillas de newsletter
CREATE TABLE IF NOT EXISTS public.newsletter_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  body_text   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_templates_user_id ON public.newsletter_templates(user_id);

ALTER TABLE public.newsletter_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter_templates_own" ON public.newsletter_templates FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER newsletter_templates_updated_at
  BEFORE UPDATE ON public.newsletter_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. SECUENCIAS: añadir email del destinatario para tracking
-- ============================================================
ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS lead_email TEXT;

-- Rellenar emails de leads existentes
UPDATE public.sequences s
SET lead_email = l.email
FROM public.leads l
WHERE s.lead_id = l.id AND s.lead_email IS NULL AND l.email IS NOT NULL;

-- ============================================================
-- 6. ACTIVIDAD: añadir tipos para newsletter
-- ============================================================
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_type_check;

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_type_check CHECK (type IN (
    'lead_created', 'lead_updated', 'status_changed',
    'enriched', 'scored', 'message_generated', 'email_sent',
    'email_replied', 'email_opened', 'email_clicked',
    'email_bounced', 'email_delivered', 'email_spam',
    'note_added', 'task_created', 'task_completed',
    'imported', 'sequence_replied', 'reply_detected',
    'newsletter_sent'
  ));
