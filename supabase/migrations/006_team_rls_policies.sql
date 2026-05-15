-- ============================================================
-- MIGRACIÓN 006 — RLS compartido entre miembros del mismo equipo
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Problema: todas las policies eran "auth.uid() = user_id",
-- lo que impedía a los miembros del equipo ver o editar datos
-- de otros compañeros (campaña no encontrada, leads vacíos, etc.)
--
-- Solución:
--   1. Función helper get_team_user_ids() → devuelve los user_ids
--      de todos los compañeros de equipo activos del usuario actual
--   2. Se actualizan las policies de todas las tablas compartidas
--      para incluir: user_id = auth.uid() OR user_id IN (team)
--
-- Tablas NO modificadas (datos personales):
--   - profiles, settings, api_integrations
-- ============================================================

-- ============================================================
-- 1. FUNCIÓN HELPER: IDs de usuarios en el mismo equipo
--    SECURITY DEFINER para acceder a team_members sin exponer la tabla
--    Incluye al propio usuario para simplificar las policies
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_team_user_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- El propio usuario siempre está incluido
  SELECT auth.uid()
  UNION
  -- Todos los compañeros en equipos activos compartidos
  SELECT DISTINCT tm2.user_id
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
  WHERE tm1.user_id = auth.uid()
    AND tm1.status = 'active'
    AND tm2.status = 'active'
$$;

-- ============================================================
-- 2. CAMPAIGNS
-- ============================================================
DROP POLICY IF EXISTS "campaigns_own" ON public.campaigns;
CREATE POLICY "campaigns_team" ON public.campaigns FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 3. LEADS
-- ============================================================
DROP POLICY IF EXISTS "leads_own" ON public.leads;
CREATE POLICY "leads_team" ON public.leads FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 4. LEAD ENRICHMENTS
-- ============================================================
DROP POLICY IF EXISTS "lead_enrichments_own" ON public.lead_enrichments;
CREATE POLICY "lead_enrichments_team" ON public.lead_enrichments FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 5. MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "messages_own" ON public.messages;
CREATE POLICY "messages_team" ON public.messages FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 6. EMAILS
-- ============================================================
DROP POLICY IF EXISTS "emails_own" ON public.emails;
CREATE POLICY "emails_team" ON public.emails FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 7. NOTES
-- ============================================================
DROP POLICY IF EXISTS "notes_own" ON public.notes;
CREATE POLICY "notes_team" ON public.notes FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 8. TASKS
-- ============================================================
DROP POLICY IF EXISTS "tasks_own" ON public.tasks;
CREATE POLICY "tasks_team" ON public.tasks FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 9. ACTIVITY LOGS
-- ============================================================
DROP POLICY IF EXISTS "activity_logs_own" ON public.activity_logs;
CREATE POLICY "activity_logs_team" ON public.activity_logs FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 10. IMPORTS
-- ============================================================
DROP POLICY IF EXISTS "imports_own" ON public.imports;
CREATE POLICY "imports_team" ON public.imports FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 11. CAMPAIGN LEADS (junction table)
-- ============================================================
DROP POLICY IF EXISTS "campaign_leads_own" ON public.campaign_leads;
CREATE POLICY "campaign_leads_team" ON public.campaign_leads FOR ALL
  USING (user_id IN (SELECT public.get_team_user_ids()))
  WITH CHECK (user_id IN (SELECT public.get_team_user_ids()));

-- ============================================================
-- 12. Tablas condicionales (pueden no existir aún)
-- ============================================================

-- email_events
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_events') THEN
    DROP POLICY IF EXISTS "Users see own email_events" ON public.email_events;
    EXECUTE $p$
      CREATE POLICY "email_events_team" ON public.email_events FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- follow_ups
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follow_ups') THEN
    DROP POLICY IF EXISTS "Users manage own follow_ups" ON public.follow_ups;
    EXECUTE $p$
      CREATE POLICY "follow_ups_team" ON public.follow_ups FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- sequences
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sequences') THEN
    DROP POLICY IF EXISTS "Users manage own sequences" ON public.sequences;
    EXECUTE $p$
      CREATE POLICY "sequences_team" ON public.sequences FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- sequence_steps
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sequence_steps') THEN
    DROP POLICY IF EXISTS "Users manage own sequence_steps" ON public.sequence_steps;
    EXECUTE $p$
      CREATE POLICY "sequence_steps_team" ON public.sequence_steps FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- newsletters
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletters') THEN
    DROP POLICY IF EXISTS "newsletters_own" ON public.newsletters;
    EXECUTE $p$
      CREATE POLICY "newsletters_team" ON public.newsletters FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- newsletter_recipients
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_recipients') THEN
    DROP POLICY IF EXISTS "newsletter_recipients_own" ON public.newsletter_recipients;
    EXECUTE $p$
      CREATE POLICY "newsletter_recipients_team" ON public.newsletter_recipients FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- newsletter_templates
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_templates') THEN
    DROP POLICY IF EXISTS "newsletter_templates_own" ON public.newsletter_templates;
    EXECUTE $p$
      CREATE POLICY "newsletter_templates_team" ON public.newsletter_templates FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- newsletter_unsubscribes
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_unsubscribes') THEN
    DROP POLICY IF EXISTS "Users manage own unsubscribes" ON public.newsletter_unsubscribes;
    EXECUTE $p$
      CREATE POLICY "newsletter_unsubscribes_team" ON public.newsletter_unsubscribes FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- lead_lists
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lead_lists') THEN
    DROP POLICY IF EXISTS "user_own_lists" ON public.lead_lists;
    EXECUTE $p$
      CREATE POLICY "lead_lists_team" ON public.lead_lists FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- lead_list_members (no tiene user_id directo, se filtra por la lista)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lead_list_members') THEN
    DROP POLICY IF EXISTS "user_own_list_members" ON public.lead_list_members;
    EXECUTE $p$
      CREATE POLICY "lead_list_members_team" ON public.lead_list_members FOR ALL
        USING (list_id IN (
          SELECT id FROM public.lead_lists
          WHERE user_id IN (SELECT public.get_team_user_ids())
        ))
    $p$;
  END IF;
END $$;

-- saved_views
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'saved_views') THEN
    DROP POLICY IF EXISTS "user_own_views" ON public.saved_views;
    EXECUTE $p$
      CREATE POLICY "saved_views_team" ON public.saved_views FOR ALL
        USING (user_id IN (SELECT public.get_team_user_ids()))
        WITH CHECK (user_id IN (SELECT public.get_team_user_ids()))
    $p$;
  END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN — descomenta para confirmar las nuevas policies
-- ============================================================
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE '%team%'
-- ORDER BY tablename;
