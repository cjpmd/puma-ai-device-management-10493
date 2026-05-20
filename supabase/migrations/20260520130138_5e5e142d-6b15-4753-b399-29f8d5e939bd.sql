ALTER TABLE public.user_academies ADD COLUMN IF NOT EXISTS external_role text;
ALTER TABLE public.user_academies ADD COLUMN IF NOT EXISTS external_role_synced_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_user_academies_academy_id ON public.user_academies(academy_id);