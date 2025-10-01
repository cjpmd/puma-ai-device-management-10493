-- Create clubs table
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Update players table to add team and club relationships
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT now();

-- Enable RLS on new tables
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for clubs
CREATE POLICY "Allow authenticated users to read clubs"
ON public.clubs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert clubs"
ON public.clubs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update clubs"
ON public.clubs FOR UPDATE
TO authenticated
USING (true);

-- RLS policies for teams
CREATE POLICY "Allow authenticated users to read teams"
ON public.teams FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert teams"
ON public.teams FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update teams"
ON public.teams FOR UPDATE
TO authenticated
USING (true);

-- Add trigger for clubs updated_at
CREATE TRIGGER update_clubs_updated_at
BEFORE UPDATE ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for teams updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();