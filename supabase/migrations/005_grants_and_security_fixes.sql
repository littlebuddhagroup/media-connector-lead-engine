-- ============================================================
-- MIGRACIÓN 005 — GRANTs explícitos + fix Security Definer View
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Qué hace esta migración:
--   1. Corrige la vista campaign_stats (SECURITY DEFINER → SECURITY INVOKER)
--   2. Añade GRANTs explícitos a todas las tablas del proyecto
--      (necesario a partir del 30-oct-2026 para Supabase existentes,
--       y ya requerido para proyectos nuevos desde el 30-may-2026)
--
-- Roles:
--   authenticated  → CRUD completo (RLS restringe las filas)
--   service_role   → acceso total sin RLS (rutas de servidor, webhooks)
--   anon           → sin acceso (app 100% autenticada)
-- ============================================================

-- ============================================================
-- 1. FIX CRÍTICO: Security Definer View → Security Invoker
--    Supabase Security Advisor lo marca como CRITICAL.
--    Con security_invoker la vista usa los permisos del usuario
--    que la consulta, no los del propietario. RLS sigue activo.
-- ============================================================
ALTER VIEW public.campaign_stats SET (security_invoker = true);

-- Dar acceso explícito a la vista
GRANT SELECT ON public.campaign_stats TO authenticated;
GRANT SELECT ON public.campaign_stats TO service_role;

-- ============================================================
-- 2. GRANTs — Tablas del schema principal (schema.sql)
-- ============================================================

-- profiles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- settings
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

-- api_integrations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_integrations TO authenticated;
GRANT ALL ON public.api_integrations TO service_role;

-- campaigns
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;

-- leads
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

-- lead_enrichments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_enrichments TO authenticated;
GRANT ALL ON public.lead_enrichments TO service_role;

-- messages
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- emails
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails TO authenticated;
GRANT ALL ON public.emails TO service_role;

-- notes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

-- tasks
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

-- activity_logs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

-- imports
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO authenticated;
GRANT ALL ON public.imports TO service_role;

-- ============================================================
-- 3. GRANTs — Tablas de schema_v2.sql
-- ============================================================

-- email_events
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;

-- follow_ups
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;

-- sequences
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sequences TO authenticated;
GRANT ALL ON public.sequences TO service_role;

-- sequence_steps
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sequence_steps TO authenticated;
GRANT ALL ON public.sequence_steps TO service_role;

-- ============================================================
-- 4. GRANTs — Tablas de migration 002
-- ============================================================

-- campaign_leads
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_leads TO authenticated;
GRANT ALL ON public.campaign_leads TO service_role;

-- inbound_emails (solo si ya existe — se crea en migración 002)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inbound_emails') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_emails TO authenticated';
    EXECUTE 'GRANT ALL ON public.inbound_emails TO service_role';
  END IF;
END $$;

-- newsletters
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletters TO authenticated;
GRANT ALL ON public.newsletters TO service_role;

-- newsletter_recipients (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_recipients') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_recipients TO authenticated';
    EXECUTE 'GRANT ALL ON public.newsletter_recipients TO service_role';
  END IF;
END $$;

-- newsletter_templates (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_templates') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_templates TO authenticated';
    EXECUTE 'GRANT ALL ON public.newsletter_templates TO service_role';
  END IF;
END $$;

-- ============================================================
-- 5. GRANTs — Tablas de migration 004
-- ============================================================

-- newsletter_unsubscribes (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_unsubscribes') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_unsubscribes TO authenticated';
    EXECUTE 'GRANT ALL ON public.newsletter_unsubscribes TO service_role';
  END IF;
END $$;

-- ============================================================
-- 6. GRANTs — Tablas de teams.sql
-- ============================================================

-- teams (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teams') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated';
    EXECUTE 'GRANT ALL ON public.teams TO service_role';
  END IF;
END $$;

-- team_members (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_members') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated';
    EXECUTE 'GRANT ALL ON public.team_members TO service_role';
  END IF;
END $$;

-- team_invitations (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_invitations') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated';
    EXECUTE 'GRANT ALL ON public.team_invitations TO service_role';
  END IF;
END $$;

-- ============================================================
-- 7. GRANTs — Tablas de lists_views_tags.sql
-- ============================================================

-- lead_lists (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lead_lists') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_lists TO authenticated';
    EXECUTE 'GRANT ALL ON public.lead_lists TO service_role';
  END IF;
END $$;

-- lead_list_members (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lead_list_members') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_list_members TO authenticated';
    EXECUTE 'GRANT ALL ON public.lead_list_members TO service_role';
  END IF;
END $$;

-- saved_views (solo si existe)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_views') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated';
    EXECUTE 'GRANT ALL ON public.saved_views TO service_role';
  END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN — Ejecuta esto para confirmar que todo se aplicó
-- ============================================================
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee IN ('authenticated', 'service_role')
-- ORDER BY table_name, grantee, privilege_type;
