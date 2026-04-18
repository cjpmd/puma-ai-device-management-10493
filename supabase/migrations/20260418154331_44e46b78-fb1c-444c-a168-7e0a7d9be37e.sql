ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_team text,
  ADD COLUMN IF NOT EXISTS away_team text,
  ADD COLUMN IF NOT EXISTS home_score integer,
  ADD COLUMN IF NOT EXISTS away_score integer,
  ADD COLUMN IF NOT EXISTS home_color text DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS away_color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'Friendly',
  ADD COLUMN IF NOT EXISTS is_home boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS age_group text;