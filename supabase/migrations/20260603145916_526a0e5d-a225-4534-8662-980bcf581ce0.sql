ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS source_video_path text,
  ADD COLUMN IF NOT EXISTS source_left_path text,
  ADD COLUMN IF NOT EXISTS source_right_path text;