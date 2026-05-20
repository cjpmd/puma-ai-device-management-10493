-- player_match_stats: per-player per-match statistics written by analysis-callback
-- This table is populated by the RunPod analysis worker via analysis-callback edge function.
-- Track IDs are RunPod-session-scoped; cross-session identity requires jersey OCR (future work).
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id          UUID        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  processing_job_id UUID        REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  track_id          INTEGER     NOT NULL,            -- ByteTrack ID for this session
  team              TEXT,                            -- 'A' | 'B' | null
  -- Physical metrics
  distance_m        NUMERIC(8,1),
  top_speed_kmh     NUMERIC(5,1),
  sprints           INTEGER,
  minutes_played    NUMERIC(5,1),
  -- Event-derived stats
  passes            INTEGER,
  passes_completed  INTEGER,
  pass_success_pct  NUMERIC(5,1),
  shots             INTEGER,
  tackles           INTEGER,
  goals             INTEGER,
  xg                NUMERIC(5,3),
  contribution_score NUMERIC(8,2),
  -- Touch breakdown (from TouchTracker)
  touches_total     INTEGER,
  touches_receive   INTEGER,
  touches_control   INTEGER,
  touches_pass      INTEGER,
  touches_shot      INTEGER,
  touches_dribble   INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, processing_job_id, track_id)
);

ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_match_stats_owner" ON public.player_match_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = player_match_stats.match_id
        AND matches.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = player_match_stats.match_id
        AND matches.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS player_match_stats_match_id_idx
  ON public.player_match_stats (match_id);

CREATE INDEX IF NOT EXISTS player_match_stats_job_id_idx
  ON public.player_match_stats (processing_job_id);
