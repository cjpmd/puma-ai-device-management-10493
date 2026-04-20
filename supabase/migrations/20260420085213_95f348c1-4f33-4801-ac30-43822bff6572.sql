-- user_team_access
CREATE TABLE public.user_team_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  external_user_id text,
  external_team_id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);

ALTER TABLE public.user_team_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own team access"
  ON public.user_team_access FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own team access"
  ON public.user_team_access FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own team access"
  ON public.user_team_access FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own team access"
  ON public.user_team_access FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_team_access_user ON public.user_team_access(user_id);
CREATE INDEX idx_user_team_access_team ON public.user_team_access(team_id);

CREATE TRIGGER update_user_team_access_updated_at
  BEFORE UPDATE ON public.user_team_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_club_access
CREATE TABLE public.user_club_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  external_user_id text,
  external_club_id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, club_id)
);

ALTER TABLE public.user_club_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own club access"
  ON public.user_club_access FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own club access"
  ON public.user_club_access FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own club access"
  ON public.user_club_access FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own club access"
  ON public.user_club_access FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_club_access_user ON public.user_club_access(user_id);
CREATE INDEX idx_user_club_access_club ON public.user_club_access(club_id);

CREATE TRIGGER update_user_club_access_updated_at
  BEFORE UPDATE ON public.user_club_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();