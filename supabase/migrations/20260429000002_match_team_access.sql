-- Adds team-scoped visibility for matches and all tables that chain off them.
--
-- Overview:
--   1. New table: match_team_access — tracks which teams can see a match.
--   2. Trigger: auto-inserts a match_team_access row when a match is created
--      with a team_id (the creating user's team is granted access immediately).
--   3. Updated SELECT policies on matches, match_videos, processing_jobs,
--      match_insights, and match_shares — allow SELECT if the authenticated
--      user is the match owner OR has user_team_access to a team that has been
--      granted access to the match.
--   4. Write policies (INSERT/UPDATE/DELETE) are unchanged — only owners can
--      mutate their matches. Existing matches are NOT backfilled; opt-in via
--      "Share with team" UI which inserts a match_team_access row.

-- 1. match_team_access table ----------------------------------------------

CREATE TABLE public.match_team_access (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid        NOT NULL REFERENCES public.matches(id)  ON DELETE CASCADE,
  team_id    uuid        NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  granted_by uuid        NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, team_id)
);

ALTER TABLE public.match_team_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match owners can view team access grants"
  ON public.match_team_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = match_team_access.match_id
        AND matches.user_id = auth.uid()
    )
  );

CREATE POLICY "Match owners can grant team access"
  ON public.match_team_access FOR INSERT
  WITH CHECK (
    auth.uid() = granted_by
    AND EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = match_team_access.match_id
        AND matches.user_id = auth.uid()
    )
  );

CREATE POLICY "Match owners can revoke team access"
  ON public.match_team_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = match_team_access.match_id
        AND matches.user_id = auth.uid()
    )
  );

CREATE INDEX idx_match_team_access_match ON public.match_team_access(match_id);
CREATE INDEX idx_match_team_access_team  ON public.match_team_access(team_id);

-- 2. Auto-grant trigger ---------------------------------------------------
--
-- When a match is inserted with a team_id, automatically create a
-- match_team_access row so team members can see it immediately (subject
-- to the matches SELECT policy below). This fires for new matches only;
-- existing rows are not backfilled.

CREATE OR REPLACE FUNCTION public.auto_grant_match_team_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    INSERT INTO public.match_team_access (match_id, team_id, granted_by)
    VALUES (NEW.id, NEW.team_id, NEW.user_id)
    ON CONFLICT (match_id, team_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_match_team_access
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_match_team_access();

-- 3. Updated SELECT policies ----------------------------------------------
--
-- Helper macro (used inline below):
--   auth.uid() = matches.user_id                              (owner)
--   OR EXISTS (mta JOIN uta WHERE mta.match_id = ... AND uta.user_id = auth.uid())
--                                                            (team member)

-- matches -----------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own matches" ON public.matches;

CREATE POLICY "Users can view matches they own or have team access to"
  ON public.matches FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.match_team_access mta
      JOIN public.user_team_access  uta ON uta.team_id = mta.team_id
      WHERE mta.match_id = matches.id
        AND uta.user_id  = auth.uid()
    )
  );

-- match_videos ------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their match videos" ON public.match_videos;

CREATE POLICY "Users can view match videos they own or have team access to"
  ON public.match_videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_videos.match_id
        AND (
          m.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.match_team_access mta
            JOIN public.user_team_access  uta ON uta.team_id = mta.team_id
            WHERE mta.match_id = m.id
              AND uta.user_id  = auth.uid()
          )
        )
    )
  );

-- processing_jobs ---------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their processing jobs" ON public.processing_jobs;

CREATE POLICY "Users can view processing jobs they own or have team access to"
  ON public.processing_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = processing_jobs.match_id
        AND (
          m.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.match_team_access mta
            JOIN public.user_team_access  uta ON uta.team_id = mta.team_id
            WHERE mta.match_id = m.id
              AND uta.user_id  = auth.uid()
          )
        )
    )
  );

-- match_insights ----------------------------------------------------------

DROP POLICY IF EXISTS "Owners can view match insights" ON public.match_insights;

CREATE POLICY "Users can view match insights they own or have team access to"
  ON public.match_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_insights.match_id
        AND (
          m.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.match_team_access mta
            JOIN public.user_team_access  uta ON uta.team_id = mta.team_id
            WHERE mta.match_id = m.id
              AND uta.user_id  = auth.uid()
          )
        )
    )
  );

-- match_shares ------------------------------------------------------------

DROP POLICY IF EXISTS "Match owners can view share links" ON public.match_shares;

CREATE POLICY "Users can view share links they own or have team access to"
  ON public.match_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_shares.match_id
        AND (
          m.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.match_team_access mta
            JOIN public.user_team_access  uta ON uta.team_id = mta.team_id
            WHERE mta.match_id = m.id
              AND uta.user_id  = auth.uid()
          )
        )
    )
  );
