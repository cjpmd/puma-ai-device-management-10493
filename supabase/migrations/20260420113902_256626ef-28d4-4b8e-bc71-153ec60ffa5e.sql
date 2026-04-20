ALTER TABLE public.team_events
ADD COLUMN IF NOT EXISTS home_score integer,
ADD COLUMN IF NOT EXISTS away_score integer;