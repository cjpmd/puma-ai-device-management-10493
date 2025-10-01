-- Create sessions table for tracking training/match sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage sessions"
  ON public.sessions FOR ALL
  TO authenticated
  USING (true);

-- Create pass_analysis table for storing pass data
CREATE TABLE IF NOT EXISTS public.pass_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id),
  start_x NUMERIC,
  start_y NUMERIC,
  end_x NUMERIC,
  end_y NUMERIC,
  is_successful BOOLEAN,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pass_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage pass analysis"
  ON public.pass_analysis FOR ALL
  TO authenticated
  USING (true);

-- Create shot_analysis table for storing shot data
CREATE TABLE IF NOT EXISTS public.shot_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id),
  location_x NUMERIC,
  location_y NUMERIC,
  is_goal BOOLEAN,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shot_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage shot analysis"
  ON public.shot_analysis FOR ALL
  TO authenticated
  USING (true);

-- Create ml_models table for storing trained models
CREATE TABLE IF NOT EXISTS public.ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  accuracy NUMERIC,
  model_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage ml models"
  ON public.ml_models FOR ALL
  TO authenticated
  USING (true);

-- Create player_physical_data table for storing player physical attributes
CREATE TABLE IF NOT EXISTS public.player_physical_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id),
  height NUMERIC,
  weight NUMERIC,
  body_fat_percentage NUMERIC,
  max_heart_rate NUMERIC,
  resting_heart_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.player_physical_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage physical data"
  ON public.player_physical_data FOR ALL
  TO authenticated
  USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_ml_models_updated_at
  BEFORE UPDATE ON public.ml_models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_physical_data_updated_at
  BEFORE UPDATE ON public.player_physical_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();