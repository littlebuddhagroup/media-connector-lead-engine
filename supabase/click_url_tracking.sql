-- ============================================================
-- click_url_tracking.sql
-- Guarda la última URL clicada por el destinatario en emails
-- y newsletter_recipients para saber qué contenido interesa.
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Columna en emails (campañas / secuencias)
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS last_clicked_url TEXT;

-- 2. Columna en newsletter_recipients (newsletters)
ALTER TABLE public.newsletter_recipients
  ADD COLUMN IF NOT EXISTS last_clicked_url TEXT;

-- 3. Índice para filtrar solo los que han clicado una URL
CREATE INDEX IF NOT EXISTS idx_emails_last_clicked_url
  ON public.emails(last_clicked_url)
  WHERE last_clicked_url IS NOT NULL;

-- 4. BACKFILL: rellenar last_clicked_url con datos históricos ya guardados
--    en activity_logs.metadata->>'clicked_url' (el webhook ya los tenía)
UPDATE public.emails e
SET last_clicked_url = (
  SELECT al.metadata->>'clicked_url'
  FROM   public.activity_logs al
  WHERE  (al.metadata->>'email_id')::uuid = e.id
    AND  al.type = 'email_clicked'
    AND  al.metadata->>'clicked_url' IS NOT NULL
  ORDER  BY al.created_at DESC
  LIMIT  1
)
WHERE e.clicked_at IS NOT NULL
  AND e.last_clicked_url IS NULL;

-- Verificar cuántos emails se actualizaron (resultado informativo)
SELECT COUNT(*) AS emails_con_url_backfilled
FROM   public.emails
WHERE  last_clicked_url IS NOT NULL;
