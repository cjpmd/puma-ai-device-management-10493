CREATE TABLE public.match_rosters (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id        UUID NOT NULL,
  side            TEXT NOT NULL CHECK (side IN ('home','away')),
  jersey_number   INTEGER NOT NULL CHECK (jersey_number >= 0 AND jersey_number <= 99),
  player_id       UUID NULL,
  player_name     TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, side, jersey_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_rosters TO authenticated;
GRANT ALL ON public.match_rosters TO service_role;

ALTER TABLE public.match_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match owners view roster" ON public.match_rosters FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_rosters.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Match owners insert roster" ON public.match_rosters FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_rosters.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Match owners update roster" ON public.match_rosters FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_rosters.match_id AND m.user_id = auth.uid()));

CREATE POLICY "Match owners delete roster" ON public.match_rosters FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_rosters.match_id AND m.user_id = auth.uid()));

CREATE INDEX match_rosters_match_idx ON public.match_rosters (match_id);

CREATE TRIGGER update_match_rosters_updated_at
BEFORE UPDATE ON public.match_rosters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();