
-- matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  match_date TIMESTAMPTZ,
  location TEXT,
  team_id UUID REFERENCES public.teams(id),
  club_id UUID REFERENCES public.clubs(id),
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches" ON public.matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own matches" ON public.matches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own matches" ON public.matches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own matches" ON public.matches FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- match_videos table
CREATE TABLE public.match_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  camera_side TEXT NOT NULL,
  wasabi_path TEXT,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  duration_seconds NUMERIC,
  resolution TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their match videos" ON public.match_videos FOR SELECT USING (EXISTS (SELECT 1 FROM public.matches WHERE matches.id = match_videos.match_id AND matches.user_id = auth.uid()));
CREATE POLICY "Users can create their match videos" ON public.match_videos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.matches WHERE matches.id = match_videos.match_id AND matches.user_id = auth.uid()));
CREATE POLICY "Users can update their match videos" ON public.match_videos FOR UPDATE USING (EXISTS (SELECT 1 FROM public.matches WHERE matches.id = match_videos.match_id AND matches.user_id = auth.uid()));
CREATE POLICY "Users can delete their match videos" ON public.match_videos FOR DELETE USING (EXISTS (SELECT 1 FROM public.matches WHERE matches.id = match_videos.match_id AND matches.user_id = auth.uid()));

-- processing_jobs table
CREATE TABLE public.processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  runpod_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  gpu_type TEXT,
  processing_logs TEXT,
  output_video_path TEXT,
  output_highlights_path TEXT,
  output_metadata_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their processing jobs" ON public.processing_jobs FOR SELECT USING (EXISTS (SELECT 1 FROM public.matches WHERE matches.id = processing_jobs.match_id AND matches.user_id = auth.uid()));
CREATE POLICY "Users can create their processing jobs" ON public.processing_jobs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.matches WHERE matches.id = processing_jobs.match_id AND matches.user_id = auth.uid()));
CREATE POLICY "Users can update their processing jobs" ON public.processing_jobs FOR UPDATE USING (EXISTS (SELECT 1 FROM public.matches WHERE matches.id = processing_jobs.match_id AND matches.user_id = auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_jobs;
