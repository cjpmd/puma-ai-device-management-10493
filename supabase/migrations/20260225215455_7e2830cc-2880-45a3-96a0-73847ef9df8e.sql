
-- Create table to store synced events from Football Central
CREATE TABLE public.team_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  team_id UUID REFERENCES public.teams(id),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'match', 'training', 'tournament', etc.
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  meeting_time TIME,
  location TEXT,
  opponent TEXT,
  is_home BOOLEAN DEFAULT true,
  game_format TEXT,
  game_duration INTEGER,
  notes TEXT,
  match_id UUID REFERENCES public.matches(id), -- link to local match when created
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read events
CREATE POLICY "Authenticated users can read team events"
ON public.team_events FOR SELECT
USING (true);

-- Allow authenticated users to update (to link match_id)
CREATE POLICY "Authenticated users can update team events"
ON public.team_events FOR UPDATE
USING (true);

-- Allow service role inserts (via edge function)
CREATE POLICY "Service role can insert team events"
ON public.team_events FOR INSERT
WITH CHECK (true);
