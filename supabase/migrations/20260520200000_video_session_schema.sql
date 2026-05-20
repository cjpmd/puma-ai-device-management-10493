
-- recording_sessions: tracks each multi-device recording session per match
CREATE TABLE IF NOT EXISTS public.recording_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  master_device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recording_sessions_owner" ON public.recording_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.matches WHERE matches.id = recording_sessions.match_id AND matches.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.matches WHERE matches.id = recording_sessions.match_id AND matches.user_id = auth.uid())
  );

-- session_cameras: per-device state within a recording session
CREATE TABLE IF NOT EXISTS public.session_cameras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  role TEXT CHECK (role IN ('master', 'left_donor', 'right_donor')),
  device_name TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  recording_file_path TEXT,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'complete', 'failed'))
);

ALTER TABLE public.session_cameras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_cameras_owner" ON public.session_cameras
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.recording_sessions rs
      JOIN public.matches m ON m.id = rs.match_id
      WHERE rs.id = session_cameras.session_id AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recording_sessions rs
      JOIN public.matches m ON m.id = rs.match_id
      WHERE rs.id = session_cameras.session_id AND m.user_id = auth.uid()
    )
  );

-- match_event_tags: in-match taggable events with recording timestamps
-- timestamp_ms is milliseconds from recording start
CREATE TABLE IF NOT EXISTS public.match_event_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.recording_sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'substitution', 'key_moment', 'foul', 'corner', 'penalty')),
  timestamp_ms INTEGER NOT NULL,
  tagged_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_event_tags_owner" ON public.match_event_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.matches WHERE matches.id = match_event_tags.match_id AND matches.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.matches WHERE matches.id = match_event_tags.match_id AND matches.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_match_event_tags_match_id ON public.match_event_tags(match_id);
CREATE INDEX IF NOT EXISTS idx_match_event_tags_session_id ON public.match_event_tags(session_id);

-- video_footage: normalized footage tracking with panoramic stitching status
CREATE TABLE IF NOT EXISTS public.video_footage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.recording_sessions(id) ON DELETE SET NULL,
  camera_role TEXT CHECK (camera_role IN ('left_donor', 'right_donor')),
  storage_path TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  stitched_path TEXT,
  processing_status TEXT NOT NULL DEFAULT 'raw' CHECK (processing_status IN ('raw', 'processing', 'stitched', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.video_footage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_footage_owner" ON public.video_footage
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.matches WHERE matches.id = video_footage.match_id AND matches.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.matches WHERE matches.id = video_footage.match_id AND matches.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_video_footage_match_id ON public.video_footage(match_id);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_match_id ON public.recording_sessions(match_id);
