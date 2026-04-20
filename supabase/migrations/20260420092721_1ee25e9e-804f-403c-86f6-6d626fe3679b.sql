CREATE TABLE public.player_attributes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL UNIQUE REFERENCES public.players(id) ON DELETE CASCADE,
  external_id text UNIQUE,

  -- Technical
  corners smallint,
  crossing smallint,
  dribbling smallint,
  finishing smallint,
  first_touch smallint,
  free_kicks smallint,
  heading smallint,
  long_shots smallint,
  long_throws smallint,
  marking smallint,
  passing smallint,
  penalties smallint,
  tackling smallint,
  technique smallint,

  -- Mental
  aggression smallint,
  anticipation smallint,
  bravery smallint,
  composure smallint,
  concentration smallint,
  decisions smallint,
  determination smallint,
  flair smallint,
  leadership smallint,
  off_the_ball smallint,
  positioning smallint,
  teamwork smallint,
  vision smallint,
  work_rate smallint,

  -- Physical
  acceleration smallint,
  agility smallint,
  balance smallint,
  jumping_reach smallint,
  natural_fitness smallint,
  pace smallint,
  stamina smallint,
  strength smallint,

  -- Goalkeeping
  aerial_reach smallint,
  command_of_area smallint,
  communication smallint,
  eccentricity smallint,
  gk_first_touch smallint,
  handling smallint,
  kicking smallint,
  one_on_ones smallint,
  gk_passing smallint,
  punching smallint,
  reflexes smallint,
  rushing_out smallint,
  throwing smallint,

  synced_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read player attributes"
  ON public.player_attributes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert player attributes"
  ON public.player_attributes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update player attributes"
  ON public.player_attributes FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_player_attributes_updated_at
  BEFORE UPDATE ON public.player_attributes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_player_attributes_player_id ON public.player_attributes(player_id);