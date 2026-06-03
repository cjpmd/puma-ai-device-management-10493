CREATE TABLE public.match_event_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  team TEXT,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  track_id INTEGER,
  notes TEXT,
  tagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_ground_truth BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_event_tags_match ON public.match_event_tags(match_id, timestamp_ms);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_event_tags TO authenticated;
GRANT ALL ON public.match_event_tags TO service_role;

ALTER TABLE public.match_event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match owners view tags" ON public.match_event_tags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_event_tags.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Match owners insert tags" ON public.match_event_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_event_tags.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Match owners update tags" ON public.match_event_tags FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_event_tags.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Match owners delete tags" ON public.match_event_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_event_tags.match_id AND m.user_id = auth.uid()));