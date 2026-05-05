-- ============================================================
-- LEADS v2 + SETTINGS mejoras
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Nuevos campos en leads: nombre, apellidos, departamento
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Índices para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_leads_first_name ON leads(first_name);
CREATE INDEX IF NOT EXISTS idx_leads_last_name ON leads(last_name);
CREATE INDEX IF NOT EXISTS idx_leads_department ON leads(department);

-- 2. Campo ai_provider en settings (para elegir Gemini o Groq)
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini';

-- 3. Campo sender_email en settings (cuenta de envío por defecto)
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- 4. Campo from_email en emails (cuenta con la que se envió)
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- ============================================================
-- FIN DEL MIGRATION
-- ============================================================
