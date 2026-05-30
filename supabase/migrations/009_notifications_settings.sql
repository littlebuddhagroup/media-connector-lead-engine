-- ============================================================
-- MIGRACIÓN 009: Columnas de notificaciones e inteligencia
-- Añade las columnas necesarias para briefing diario,
-- alertas de señales y emails de notificación personalizados.
-- ============================================================

-- Emails de notificación (lista separada por comas)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS notification_emails TEXT DEFAULT NULL;

-- Briefing diario activado (por defecto ON)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS briefing_enabled BOOLEAN DEFAULT true;

-- Alertas de señales de compra activadas (por defecto ON)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS signal_alerts_enabled BOOLEAN DEFAULT true;

-- Módulos de inteligencia (JSON con configuración avanzada)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS intelligence_modules JSONB DEFAULT NULL;

-- Actualizar la columna updated_at de todos los registros existentes
-- para que el trigger se dispare y los valores por defecto se apliquen
UPDATE public.settings SET updated_at = NOW()
  WHERE notification_emails IS NULL;

-- Comentario descriptivo
COMMENT ON COLUMN public.settings.notification_emails IS 'Emails adicionales separados por comas para recibir briefings y alertas';
COMMENT ON COLUMN public.settings.briefing_enabled IS 'Activar briefing diario de actividad CRM a las 08:00';
COMMENT ON COLUMN public.settings.signal_alerts_enabled IS 'Activar alertas cuando un lead muestra señales de compra de packaging';
