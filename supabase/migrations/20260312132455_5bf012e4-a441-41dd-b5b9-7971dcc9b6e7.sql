ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS player_tracking_data jsonb,
  ADD COLUMN IF NOT EXISTS ball_tracking_data jsonb,
  ADD COLUMN IF NOT EXISTS event_data jsonb;