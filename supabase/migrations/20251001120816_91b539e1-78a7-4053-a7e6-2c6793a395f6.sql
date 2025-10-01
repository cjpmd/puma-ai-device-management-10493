-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  player_type TEXT,
  position TEXT,
  squad_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read players"
  ON public.players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert players"
  ON public.players FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update players"
  ON public.players FOR UPDATE
  TO authenticated
  USING (true);

-- Create devices table
CREATE TABLE IF NOT EXISTS public.devices (
  id SERIAL PRIMARY KEY,
  device_name TEXT NOT NULL,
  device_id TEXT UNIQUE,
  bluetooth_id TEXT,
  status TEXT DEFAULT 'disconnected',
  connection_type TEXT,
  last_connected TIMESTAMPTZ,
  device_type TEXT,
  assigned_player_id UUID REFERENCES public.players(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage devices"
  ON public.devices FOR ALL
  TO authenticated
  USING (true);

-- Create ml_training_sessions table
CREATE TABLE IF NOT EXISTS public.ml_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  device_id INTEGER REFERENCES public.devices(id),
  video_timestamp NUMERIC,
  player_id UUID REFERENCES public.players(id),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration NUMERIC,
  parameters JSONB,
  video_id TEXT
);

ALTER TABLE public.ml_training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage training sessions"
  ON public.ml_training_sessions FOR ALL
  TO authenticated
  USING (true);

-- Create model_versions table
CREATE TABLE IF NOT EXISTS public.model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  accuracy NUMERIC,
  parameters JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  training_date TIMESTAMPTZ,
  model_file_path TEXT
);

ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage model versions"
  ON public.model_versions FOR ALL
  TO authenticated
  USING (true);

-- Create sensor_recordings table
CREATE TABLE IF NOT EXISTS public.sensor_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id UUID REFERENCES public.ml_training_sessions(id),
  device_id INTEGER REFERENCES public.devices(id),
  player_id UUID REFERENCES public.players(id),
  sensor_type TEXT,
  x NUMERIC,
  y NUMERIC,
  z NUMERIC,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sensor_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage sensor recordings"
  ON public.sensor_recordings FOR ALL
  TO authenticated
  USING (true);

-- Create player_tracking table
CREATE TABLE IF NOT EXISTS public.player_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT,
  player_id UUID REFERENCES public.players(id),
  frame_number INTEGER,
  x_coord NUMERIC,
  y_coord NUMERIC,
  confidence NUMERIC,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.player_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage player tracking"
  ON public.player_tracking FOR ALL
  TO authenticated
  USING (true);

-- Create biometric_readings table
CREATE TABLE IF NOT EXISTS public.biometric_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id INTEGER REFERENCES public.devices(id),
  player_id UUID REFERENCES public.players(id),
  heart_rate NUMERIC,
  temperature NUMERIC,
  hydration NUMERIC,
  lactic_acid NUMERIC,
  vo2_max NUMERIC,
  steps INTEGER,
  distance NUMERIC,
  speed NUMERIC,
  muscle_fatigue NUMERIC,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.biometric_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage biometric readings"
  ON public.biometric_readings FOR ALL
  TO authenticated
  USING (true);

-- Create object_detections table
CREATE TABLE IF NOT EXISTS public.object_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT,
  frame_time NUMERIC,
  object_class TEXT,
  confidence NUMERIC,
  x_coord NUMERIC,
  y_coord NUMERIC,
  width NUMERIC,
  height NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.object_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage object detections"
  ON public.object_detections FOR ALL
  TO authenticated
  USING (true);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_training_sessions_updated_at
  BEFORE UPDATE ON public.ml_training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_versions_updated_at
  BEFORE UPDATE ON public.model_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();