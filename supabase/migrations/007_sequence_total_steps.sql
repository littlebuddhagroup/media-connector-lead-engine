-- ============================================================
-- Migración 007: Añadir total_steps a sequences
-- Permite secuencias de 3 o 5 toques (configurable)
-- ============================================================

-- Añadir columna total_steps a sequences (default 3 para retrocompatibilidad)
ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS total_steps INT NOT NULL DEFAULT 3;

-- Comentario descriptivo
COMMENT ON COLUMN public.sequences.total_steps IS
  'Número total de toques en la secuencia. 3 = secuencia corta, 5 = secuencia extendida.';

-- Índice para filtrar por total_steps si hace falta en reporting
CREATE INDEX IF NOT EXISTS idx_sequences_total_steps ON public.sequences(total_steps);
