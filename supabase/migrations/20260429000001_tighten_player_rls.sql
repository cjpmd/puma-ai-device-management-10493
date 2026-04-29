-- Tighten SELECT policies on players and player_attributes.
--
-- Previously both tables allowed any authenticated user to read any row.
-- This replaces those policies with user_team_access-scoped checks,
-- matching the pattern already used on team_events.
--
-- INSERT / UPDATE policies are intentionally left open — the three sync
-- edge functions write to these tables using the service role key which
-- bypasses RLS, so no client-facing write policy is needed.

-- players ----------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated users to read players" ON public.players;

CREATE POLICY "Team members can read players"
  ON public.players
  FOR SELECT
  TO authenticated
  USING (
    -- Allow rows where team_id is NULL (unassigned / not yet synced).
    team_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_team_access uta
      WHERE uta.team_id = players.team_id
        AND uta.user_id = auth.uid()
    )
  );

-- player_attributes -------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated can read player attributes" ON public.player_attributes;

CREATE POLICY "Team members can read player attributes"
  ON public.player_attributes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.players p
      JOIN public.user_team_access uta ON uta.team_id = p.team_id
      WHERE p.id = player_attributes.player_id
        AND uta.user_id = auth.uid()
    )
  );
