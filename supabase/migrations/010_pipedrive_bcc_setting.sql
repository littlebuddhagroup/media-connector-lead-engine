-- Migration 010: Pipedrive BCC sync setting
-- Añade la columna pipedrive_bcc_enabled a la tabla settings.
-- Activo por defecto (true) para sincronizar emails con Pipedrive vía BCC oculto.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS pipedrive_bcc_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN settings.pipedrive_bcc_enabled IS
  'Si es true, cada email saliente incluye BCC a mymediaconnect@pipedrivemail.com para sincronización automática con Pipedrive.';
