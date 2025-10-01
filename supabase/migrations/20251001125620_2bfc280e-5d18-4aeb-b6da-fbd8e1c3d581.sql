-- Create GPS tracking table for real-time location data
CREATE TABLE public.gps_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  device_id INTEGER REFERENCES public.devices(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  altitude NUMERIC,
  speed NUMERIC,
  heading NUMERIC,
  accuracy NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gps_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for gps_tracking
CREATE POLICY "Allow authenticated users to manage GPS tracking"
ON public.gps_tracking
FOR ALL
USING (true);

-- Create index for faster queries
CREATE INDEX idx_gps_tracking_player_session ON public.gps_tracking(player_id, session_id, timestamp);

-- Create pitch calibration table
CREATE TABLE public.pitch_calibration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  corner_nw_lat NUMERIC NOT NULL,
  corner_nw_lon NUMERIC NOT NULL,
  corner_ne_lat NUMERIC NOT NULL,
  corner_ne_lon NUMERIC NOT NULL,
  corner_sw_lat NUMERIC NOT NULL,
  corner_sw_lon NUMERIC NOT NULL,
  corner_se_lat NUMERIC NOT NULL,
  corner_se_lon NUMERIC NOT NULL,
  pitch_length NUMERIC NOT NULL,
  pitch_width NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pitch_calibration ENABLE ROW LEVEL SECURITY;

-- RLS policies for pitch_calibration
CREATE POLICY "Allow authenticated users to manage pitch calibration"
ON public.pitch_calibration
FOR ALL
USING (true);

-- Create movement analytics table
CREATE TABLE public.movement_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  total_distance NUMERIC DEFAULT 0,
  sprint_count INTEGER DEFAULT 0,
  top_speed NUMERIC DEFAULT 0,
  avg_speed NUMERIC DEFAULT 0,
  time_in_defensive_third NUMERIC DEFAULT 0,
  time_in_middle_third NUMERIC DEFAULT 0,
  time_in_attacking_third NUMERIC DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.movement_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for movement_analytics
CREATE POLICY "Allow authenticated users to manage movement analytics"
ON public.movement_analytics
FOR ALL
USING (true);

-- Create index for faster queries
CREATE INDEX idx_movement_analytics_player_session ON public.movement_analytics(player_id, session_id);

-- Add trigger for pitch_calibration updated_at
CREATE TRIGGER update_pitch_calibration_updated_at
BEFORE UPDATE ON public.pitch_calibration
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for GPS tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movement_analytics;