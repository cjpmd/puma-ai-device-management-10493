
-- Helper functions (SECURITY DEFINER) to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.user_has_club_access(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_club_access
    WHERE user_id = _user_id AND club_id = _club_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_team_access(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_team_access
    WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_player(_user_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = _player_id
      AND (
        (p.club_id IS NOT NULL AND public.user_has_club_access(_user_id, p.club_id))
        OR (p.team_id IS NOT NULL AND public.user_has_team_access(_user_id, p.team_id))
      )
  );
$$;

-- PLAYERS: replace permissive policies with org-scoped ones
DROP POLICY IF EXISTS "Allow authenticated users to read players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated users to insert players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated users to update players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated users to delete players" ON public.players;

CREATE POLICY "Users can view players in their org"
ON public.players FOR SELECT TO authenticated
USING (
  (club_id IS NOT NULL AND public.user_has_club_access(auth.uid(), club_id))
  OR (team_id IS NOT NULL AND public.user_has_team_access(auth.uid(), team_id))
);

CREATE POLICY "Users can insert players in their org"
ON public.players FOR INSERT TO authenticated
WITH CHECK (
  (club_id IS NOT NULL AND public.user_has_club_access(auth.uid(), club_id))
  OR (team_id IS NOT NULL AND public.user_has_team_access(auth.uid(), team_id))
);

CREATE POLICY "Users can update players in their org"
ON public.players FOR UPDATE TO authenticated
USING (
  (club_id IS NOT NULL AND public.user_has_club_access(auth.uid(), club_id))
  OR (team_id IS NOT NULL AND public.user_has_team_access(auth.uid(), team_id))
)
WITH CHECK (
  (club_id IS NOT NULL AND public.user_has_club_access(auth.uid(), club_id))
  OR (team_id IS NOT NULL AND public.user_has_team_access(auth.uid(), team_id))
);

CREATE POLICY "Users can delete players in their org"
ON public.players FOR DELETE TO authenticated
USING (
  (club_id IS NOT NULL AND public.user_has_club_access(auth.uid(), club_id))
  OR (team_id IS NOT NULL AND public.user_has_team_access(auth.uid(), team_id))
);

-- BIOMETRIC_READINGS: restrict to users with access to the player
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='biometric_readings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.biometric_readings', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.biometric_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view biometrics for accessible players"
ON public.biometric_readings FOR SELECT TO authenticated
USING (player_id IS NOT NULL AND public.user_can_access_player(auth.uid(), player_id));

CREATE POLICY "Users can insert biometrics for accessible players"
ON public.biometric_readings FOR INSERT TO authenticated
WITH CHECK (player_id IS NOT NULL AND public.user_can_access_player(auth.uid(), player_id));

CREATE POLICY "Users can update biometrics for accessible players"
ON public.biometric_readings FOR UPDATE TO authenticated
USING (player_id IS NOT NULL AND public.user_can_access_player(auth.uid(), player_id))
WITH CHECK (player_id IS NOT NULL AND public.user_can_access_player(auth.uid(), player_id));

CREATE POLICY "Users can delete biometrics for accessible players"
ON public.biometric_readings FOR DELETE TO authenticated
USING (player_id IS NOT NULL AND public.user_can_access_player(auth.uid(), player_id));
