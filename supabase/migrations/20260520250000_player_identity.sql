-- player_identities: maps jersey numbers to named players within a team
-- Populated by JerseyNumberTracker (EasyOCR) via analysis-callback edge function.
-- jersey_number is unique per team — same number on two teams is allowed.
CREATE TABLE IF NOT EXISTS public.player_identities (
  id             UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id        UUID    REFERENCES public.teams(id) ON DELETE CASCADE,
  jersey_number  INTEGER NOT NULL,
  player_name    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, jersey_number)
);

ALTER TABLE public.player_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_identities_owner" ON public.player_identities
  FOR ALL USING (
    team_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = player_identities.team_id
        AND teams.user_id = auth.uid()
    )
  ) WITH CHECK (
    team_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = player_identities.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS player_identities_team_jersey_idx
  ON public.player_identities (team_id, jersey_number);

-- player_match_stats: add pass direction columns and identity FK
-- player_match_stats table was created in 20260520240000_player_match_stats_touches.sql
ALTER TABLE public.player_match_stats
  ADD COLUMN IF NOT EXISTS player_identity_id UUID REFERENCES public.player_identities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jersey_number       INTEGER,
  ADD COLUMN IF NOT EXISTS passes_attempted    INTEGER,
  ADD COLUMN IF NOT EXISTS passes_completed_count INTEGER,
  ADD COLUMN IF NOT EXISTS pass_accuracy       NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS passes_forward      INTEGER,
  ADD COLUMN IF NOT EXISTS passes_sideways     INTEGER,
  ADD COLUMN IF NOT EXISTS passes_back         INTEGER;

CREATE INDEX IF NOT EXISTS player_match_stats_identity_idx
  ON public.player_match_stats (player_identity_id);
