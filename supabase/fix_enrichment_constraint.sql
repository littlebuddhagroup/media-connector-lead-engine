-- ============================================================
-- FIX: Añadir UNIQUE constraint a lead_enrichments.lead_id
-- Necesario para que el upsert con onConflict:'lead_id' funcione
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Eliminar el índice regular si existe (el UNIQUE lo reemplaza)
DROP INDEX IF EXISTS idx_lead_enrichments_lead_id;

-- 2. Añadir UNIQUE constraint (crea automáticamente un índice único)
ALTER TABLE lead_enrichments
  ADD CONSTRAINT lead_enrichments_lead_id_key UNIQUE (lead_id);
