-- Add error_message column for human-readable errors (processing_logs stores raw JSON)
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- analysis_job_id tracks the RunPod job on the analysis endpoint separately
-- from runpod_job_id which tracks the follow-cam job
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS analysis_job_id TEXT;

-- Index for analysis-callback lookups by analysis_job_id
CREATE INDEX IF NOT EXISTS processing_jobs_analysis_job_id_idx
  ON public.processing_jobs (analysis_job_id)
  WHERE analysis_job_id IS NOT NULL;
