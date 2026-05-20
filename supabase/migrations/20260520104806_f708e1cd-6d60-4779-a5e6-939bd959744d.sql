-- ── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  user_group_tier TEXT NOT NULL DEFAULT 'amateur_professional'
    CHECK (user_group_tier IN ('grassroots_junior','amateur_professional')),
  fa_safeguarding_expiry DATE,
  dbs_expiry DATE,
  first_aid_expiry DATE,
  uefa_licence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── clubs.academy_id ────────────────────────────────────────────────────────
ALTER TABLE public.clubs ADD COLUMN academy_id UUID;

-- ── academies ───────────────────────────────────────────────────────────────
CREATE TABLE public.academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id UUID UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  fa_registration_number TEXT,
  eppp_category TEXT,
  founded_year INTEGER,
  head_of_academy_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_academy_id_fkey FOREIGN KEY (academy_id)
  REFERENCES public.academies(id) ON DELETE SET NULL;

ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view academies for their clubs"
  ON public.academies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.academy_id = academies.id
        AND public.user_has_club_access(auth.uid(), c.id)
    )
  );

-- Service role (sync function) bypasses RLS, so no INSERT/UPDATE policies needed
-- for the edge function. Keep table locked down for regular users.

CREATE TRIGGER academies_updated_at
  BEFORE UPDATE ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── user_academies ──────────────────────────────────────────────────────────
CREATE TABLE public.user_academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, academy_id)
);

ALTER TABLE public.user_academies ENABLE ROW LEVEL SECURITY;

-- Helper
CREATE OR REPLACE FUNCTION public.user_has_academy_access(_user_id UUID, _academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_academies
    WHERE user_id = _user_id AND academy_id = _academy_id
  )
  OR EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.academy_id = _academy_id
      AND public.user_has_club_access(_user_id, c.id)
  );
$$;

CREATE POLICY "Users can view their own academy memberships"
  ON public.user_academies FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.academy_id = user_academies.academy_id
        AND public.user_has_club_access(auth.uid(), c.id)
    )
  );

CREATE POLICY "Users can insert their own academy memberships"
  ON public.user_academies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_academies_updated_at
  BEFORE UPDATE ON public.user_academies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();