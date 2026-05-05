-- ============================================================
-- ÍNDICES FALTANTES — Performance para escala
-- Ejecutar en Supabase > SQL Editor
-- ============================================================
-- Estos índices NO están en ningún migration anterior.
-- Algunos queries críticos hacen full-scan de tabla sin ellos.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. SEQUENCES — Tabla sin ningún índice (¡crítico!)
-- ══════════════════════════════════════════════════════════════

-- Buscar secuencias de un lead (lead detail page)
CREATE INDEX IF NOT EXISTS idx_sequences_lead_id
  ON sequences(lead_id);

-- Filtrar secuencias activas de una campaña (launch-sequences)
CREATE INDEX IF NOT EXISTS idx_sequences_campaign_status
  ON sequences(campaign_id, status);

-- Buscar todas las secuencias del usuario
CREATE INDEX IF NOT EXISTS idx_sequences_user_id
  ON sequences(user_id);

-- Buscar secuencias de usuario + campaña (queries frecuentes)
CREATE INDEX IF NOT EXISTS idx_sequences_user_campaign
  ON sequences(user_id, campaign_id);


-- ══════════════════════════════════════════════════════════════
-- 2. SEQUENCE_STEPS — Falta índice en sequence_id
-- ══════════════════════════════════════════════════════════════

-- Cargar pasos de una secuencia (ya existe scheduled partial pero no sequence_id)
CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id
  ON sequence_steps(sequence_id);


-- ══════════════════════════════════════════════════════════════
-- 3. LEADS — Índices compuestos para campaign stats
--    Las COUNT queries filtran por (campaign_id + columna_estado)
--    Sin estos, PostgreSQL escanea todos los leads de la campaña
--    para cada COUNT en vez de hacer index-only scans
-- ══════════════════════════════════════════════════════════════

-- COUNT leads por estado dentro de campaña
CREATE INDEX IF NOT EXISTS idx_leads_campaign_status
  ON leads(campaign_id, status);

-- COUNT leads enriquecidos por campaña
CREATE INDEX IF NOT EXISTS idx_leads_campaign_enriched
  ON leads(campaign_id, is_enriched);

-- COUNT leads por prioridad dentro de campaña
CREATE INDEX IF NOT EXISTS idx_leads_campaign_priority
  ON leads(campaign_id, priority);

-- Scores por campaña (para calcular media)
CREATE INDEX IF NOT EXISTS idx_leads_campaign_score
  ON leads(campaign_id, score DESC NULLS LAST)
  WHERE score IS NOT NULL AND score > 0;


-- ══════════════════════════════════════════════════════════════
-- 4. EMAILS — Falta índice en campaign_id
--    Campaign stats carga todos los emails de una campaña.
--    Sin esto usa idx_emails_user_id → escanea TODOS los emails
--    del usuario y filtra por campaign_id en memoria
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_emails_campaign_id
  ON emails(campaign_id);

-- Compuesto para las métricas de apertura/click de campaña
CREATE INDEX IF NOT EXISTS idx_emails_campaign_status
  ON emails(campaign_id, status);


-- ══════════════════════════════════════════════════════════════
-- 5. ACTIVITY_LOGS — Falta índice en campaign_id
--    Campaign stats + feed de actividad por campaña
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_activity_logs_campaign_id
  ON activity_logs(campaign_id, created_at DESC);


-- ══════════════════════════════════════════════════════════════
-- 6. FOLLOW_UPS — Índice en lead_id para cancelación masiva
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id
  ON follow_ups(lead_id);


-- ══════════════════════════════════════════════════════════════
-- FIN — Verificar con:
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
-- ══════════════════════════════════════════════════════════════
