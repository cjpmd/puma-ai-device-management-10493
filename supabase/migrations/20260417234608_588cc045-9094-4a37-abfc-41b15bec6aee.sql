-- Add metrics columns to processing_jobs
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS team_metrics jsonb,
  ADD COLUMN IF NOT EXISTS player_metrics jsonb,
  ADD COLUMN IF NOT EXISTS heatmaps jsonb,
  ADD COLUMN IF NOT EXISTS divergence_metrics jsonb;

-- Match insights table (LLM output)
CREATE TABLE IF NOT EXISTS public.match_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  summary text,
  team_strengths jsonb,
  team_weaknesses jsonb,
  top_performers jsonb,
  coaching_focus jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id)
);

ALTER TABLE public.match_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view match insights"
  ON public.match_insights FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_insights.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Owners can insert match insights"
  ON public.match_insights FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_insights.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Owners can update match insights"
  ON public.match_insights FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_insights.match_id AND m.user_id = auth.uid()));

CREATE TRIGGER update_match_insights_updated_at
  BEFORE UPDATE ON public.match_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track → real player mapping
CREATE TABLE IF NOT EXISTS public.track_player_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  track_id integer NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  team_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, track_id)
);

ALTER TABLE public.track_player_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view track mappings"
  ON public.track_player_mapping FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = track_player_mapping.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Owners can insert track mappings"
  ON public.track_player_mapping FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = track_player_mapping.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Owners can update track mappings"
  ON public.track_player_mapping FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = track_player_mapping.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Owners can delete track mappings"
  ON public.track_player_mapping FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = track_player_mapping.match_id AND m.user_id = auth.uid()));

CREATE TRIGGER update_track_player_mapping_updated_at
  BEFORE UPDATE ON public.track_player_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_track_player_mapping_match ON public.track_player_mapping(match_id);
CREATE INDEX IF NOT EXISTS idx_match_insights_match ON public.match_insights(match_id);