-- ============================================================
-- SECUENCIAS + ANALÍTICAS — Migración v3
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Cuenta de envío por paso de secuencia (rotación entre cuentas)
ALTER TABLE sequence_steps
  ADD COLUMN IF NOT EXISTS from_email TEXT;

-- 2. Índice para búsqueda por cuenta de envío
CREATE INDEX IF NOT EXISTS idx_sequence_steps_from_email ON sequence_steps(from_email);

-- ============================================================
-- FIN DEL MIGRATION
-- ============================================================
