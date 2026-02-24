
-- Add additional columns to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS date_of_birth text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS availability text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS photo_url text;

-- Add additional columns to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS age_group text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS game_format text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS logo_url text;

-- Add additional columns to clubs table
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS logo_url text;
