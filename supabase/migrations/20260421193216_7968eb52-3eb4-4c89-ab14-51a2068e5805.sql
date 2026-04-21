-- Create team_match_events table to store goal/card/sub events from external sync
CREATE TABLE IF NOT EXISTS public.team_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  event_id uuid NOT NULL REFERENCES public.team_events(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  minute integer,
  period_number integer,
  team_side text,
  notes text,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_match_events_event_id ON public.team_match_events(event_id);
CREATE INDEX IF NOT EXISTS idx_team_match_events_external_id ON public.team_match_events(external_id);

ALTER TABLE public.team_match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read team match events"
  ON public.team_match_events FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert team match events"
  ON public.team_match_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update team match events"
  ON public.team_match_events FOR UPDATE
  USING (true);

CREATE TRIGGER update_team_match_events_updated_at
  BEFORE UPDATE ON public.team_match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();