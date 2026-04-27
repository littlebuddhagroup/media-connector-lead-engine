-- ============================================================
-- MEDIA CONNECTOR LEAD ENGINE — Schema SQL para Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda de texto

-- ============================================================
-- FUNCIÓN HELPER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- TABLA: profiles (extiende auth.users de Supabase)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  company       TEXT,
  role          TEXT DEFAULT 'user',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: settings (configuración por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Email
  email_provider        TEXT DEFAULT 'resend',
  email_from_address    TEXT,
  email_from_name       TEXT,
  email_signature       TEXT,
  email_daily_limit     INTEGER DEFAULT 50,
  -- IA
  ai_model              TEXT DEFAULT 'gpt-4o-mini',
  ai_temperature        NUMERIC(3,2) DEFAULT 0.7,
  default_language      TEXT DEFAULT 'es',
  default_tone          TEXT DEFAULT 'consultivo',
  -- Scraping
  scraping_provider     TEXT DEFAULT 'serpapi',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: api_integrations (claves API encriptadas por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_integrations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL, -- 'openai', 'resend', 'serpapi', 'hunter', 'apify'
  api_key       TEXT,          -- Idealmente encriptada a nivel app
  is_active     BOOLEAN DEFAULT true,
  last_tested   TIMESTAMPTZ,
  test_status   TEXT,          -- 'ok', 'error', null
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE TRIGGER api_integrations_updated_at
  BEFORE UPDATE ON public.api_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  country           TEXT,
  sector            TEXT,
  language          TEXT DEFAULT 'es',
  keywords          TEXT[],
  target_type       TEXT,  -- 'startup', 'pyme', 'enterprise', etc.
  target_size       TEXT,  -- '1-10', '11-50', '51-200', '200+'
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','finished')),
  -- Stats desnormalizadas para rendimiento
  total_leads       INTEGER DEFAULT 0,
  contacted_leads   INTEGER DEFAULT 0,
  replied_leads     INTEGER DEFAULT 0,
  emails_sent       INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  -- Datos de empresa
  company_name    TEXT NOT NULL,
  website         TEXT,
  domain          TEXT,
  email           TEXT,
  phone           TEXT,
  country         TEXT,
  city            TEXT,
  sector          TEXT,
  description     TEXT,
  linkedin_url    TEXT,
  -- Origen
  source          TEXT DEFAULT 'manual', -- 'manual', 'csv', 'serpapi', 'hunter', 'apify'
  source_url      TEXT,
  -- Estado comercial
  status          TEXT DEFAULT 'new' CHECK (status IN (
                    'new', 'enriched', 'pending_review', 'approved',
                    'contacted', 'replied', 'interested', 'not_interested',
                    'meeting_scheduled', 'closed', 'discarded'
                  )),
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  score           INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  -- Enriquecimiento
  is_enriched     BOOLEAN DEFAULT false,
  enriched_at     TIMESTAMPTZ,
  -- Próximo contacto
  next_contact_at TIMESTAMPTZ,
  -- Tags
  tags            TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_campaign_id ON public.leads(campaign_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_priority ON public.leads(priority);
CREATE INDEX idx_leads_score ON public.leads(score DESC);
CREATE INDEX idx_leads_company_name ON public.leads USING gin(company_name gin_trgm_ops);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_domain ON public.leads(domain);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: lead_enrichments (análisis IA del lead)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_enrichments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id                 UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Análisis
  company_summary         TEXT,
  what_they_do            TEXT,
  detected_needs          TEXT[],
  detected_problems       TEXT[],
  media_connector_fit     TEXT,
  fit_score               INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
  priority_reason         TEXT,
  auto_tags               TEXT[],
  -- Web scraping data
  scraped_title           TEXT,
  scraped_description     TEXT,
  scraped_content         TEXT,
  -- Raw AI response
  raw_ai_response         JSONB,
  model_used              TEXT,
  tokens_used             INTEGER,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_enrichments_lead_id ON public.lead_enrichments(lead_id);

CREATE TRIGGER lead_enrichments_updated_at
  BEFORE UPDATE ON public.lead_enrichments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: messages (mensajes generados por IA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN (
                  'initial_email', 'followup_1', 'followup_2',
                  'linkedin_message', 'internal_summary'
                )),
  tone          TEXT DEFAULT 'consultivo' CHECK (tone IN (
                  'cercano','formal','tecnico','directo','consultivo'
                )),
  subject       TEXT,
  body          TEXT NOT NULL,
  is_edited     BOOLEAN DEFAULT false,
  is_sent       BOOLEAN DEFAULT false,
  sent_at       TIMESTAMPTZ,
  model_used    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_lead_id ON public.messages(lead_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_type ON public.messages(type);

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: emails (emails enviados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emails (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  message_id      UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  -- Datos del email
  to_email        TEXT NOT NULL,
  to_name         TEXT,
  from_email      TEXT NOT NULL,
  from_name       TEXT,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  -- Estado
  status          TEXT DEFAULT 'sent' CHECK (status IN (
                    'draft','sent','delivered','opened','replied','bounced','failed'
                  )),
  provider        TEXT DEFAULT 'resend',
  provider_id     TEXT, -- ID del proveedor externo
  -- Tracking
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  -- Error
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emails_lead_id ON public.emails(lead_id);
CREATE INDEX idx_emails_user_id ON public.emails(user_id);
CREATE INDEX idx_emails_status ON public.emails(status);
CREATE INDEX idx_emails_sent_at ON public.emails(sent_at DESC);

CREATE TRIGGER emails_updated_at
  BEFORE UPDATE ON public.emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: notes (notas manuales sobre un lead)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_lead_id ON public.notes(lead_id);

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: tasks (tareas de seguimiento)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      TIMESTAMPTZ,
  is_completed  BOOLEAN DEFAULT false,
  completed_at  TIMESTAMPTZ,
  priority      TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_is_completed ON public.tasks(is_completed);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: activity_logs (timeline de actividad del lead)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN (
                  'lead_created', 'lead_updated', 'status_changed',
                  'enriched', 'scored', 'message_generated', 'email_sent',
                  'email_replied', 'note_added', 'task_created', 'task_completed',
                  'imported'
                )),
  title         TEXT NOT NULL,
  description   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_lead_id ON public.activity_logs(lead_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_type ON public.activity_logs(type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ============================================================
-- TABLA: imports (historial de importaciones CSV)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.imports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id         UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  filename            TEXT NOT NULL,
  total_rows          INTEGER DEFAULT 0,
  imported_rows       INTEGER DEFAULT 0,
  skipped_rows        INTEGER DEFAULT 0,
  error_rows          INTEGER DEFAULT 0,
  status              TEXT DEFAULT 'pending' CHECK (status IN (
                        'pending','processing','completed','failed'
                      )),
  errors              JSONB,
  column_mapping      JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_imports_user_id ON public.imports(user_id);
CREATE INDEX idx_imports_campaign_id ON public.imports(campaign_id);

CREATE TRIGGER imports_updated_at
  BEFORE UPDATE ON public.imports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

-- Policies: cada usuario sólo ve y modifica sus propios datos
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "settings_own" ON public.settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "api_integrations_own" ON public.api_integrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "campaigns_own" ON public.campaigns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "leads_own" ON public.leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "lead_enrichments_own" ON public.lead_enrichments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "messages_own" ON public.messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "emails_own" ON public.emails FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notes_own" ON public.notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tasks_own" ON public.tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "activity_logs_own" ON public.activity_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "imports_own" ON public.imports FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: Crear profile automáticamente al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista resumen de leads por campaña
CREATE OR REPLACE VIEW public.campaign_stats AS
SELECT
  c.id AS campaign_id,
  c.user_id,
  c.name,
  COUNT(l.id) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'contacted') AS contacted,
  COUNT(l.id) FILTER (WHERE l.status = 'replied') AS replied,
  COUNT(l.id) FILTER (WHERE l.status = 'interested') AS interested,
  COUNT(l.id) FILTER (WHERE l.status = 'meeting_scheduled') AS meetings,
  AVG(l.score) AS avg_score
FROM public.campaigns c
LEFT JOIN public.leads l ON l.campaign_id = c.id
GROUP BY c.id, c.user_id, c.name;
