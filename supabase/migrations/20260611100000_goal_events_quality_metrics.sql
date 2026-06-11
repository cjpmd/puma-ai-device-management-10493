-- Goal detection + pipeline quality metrics (AI video analysis improvements)
--
-- 1) processing_jobs.tracking_metrics / ocr_metrics: structured per-match
--    quality metrics from the GPU worker (ID-switch/fragmentation proxies,
--    OCR lock rate + confidence distribution) so accuracy improvements can
--    be measured in production.
-- 2) goal_events: every goal candidate the detector evaluated — confirmed,
--    sub-threshold and rejected alike — with confidence and the evidence
--    behind the decision (trajectory, dwell frames, audio spike, cross-view
--    corroboration). Written by analysis-callback.

ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS tracking_metrics JSONB,
  ADD COLUMN IF NOT EXISTS ocr_metrics      JSONB;

CREATE TABLE IF NOT EXISTS public.goal_events (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id          UUID        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  processing_job_id UUID        REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  timestamp_ms      INTEGER     NOT NULL,             -- zone-entry time in the analysed video
  frame             INTEGER,
  side              TEXT,                             -- 'left' | 'right' goal
  status            TEXT        NOT NULL,             -- 'confirmed' | 'candidate' | 'rejected'
  confidence        NUMERIC(4,3),
  camera_view       TEXT,                             -- 'primary' | 'secondary'
  player_track_id   INTEGER,                          -- attributed scorer (nullable)
  detection_via     TEXT,                             -- 'dwell' | 'disappearance' | 'exit'
  corroboration     JSONB,                            -- {audio_spike, frames_in_zone, trajectory_aligned, corroborated_by}
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_events_owner" ON public.goal_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = goal_events.match_id
        AND matches.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = goal_events.match_id
        AND matches.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS goal_events_match_id_idx
  ON public.goal_events (match_id);

CREATE INDEX IF NOT EXISTS goal_events_job_id_idx
  ON public.goal_events (processing_job_id);

-- Re-running analysis on the same job must replace its goal events
CREATE UNIQUE INDEX IF NOT EXISTS goal_events_job_frame_side_idx
  ON public.goal_events (processing_job_id, frame, side, camera_view)
  WHERE processing_job_id IS NOT NULL;
