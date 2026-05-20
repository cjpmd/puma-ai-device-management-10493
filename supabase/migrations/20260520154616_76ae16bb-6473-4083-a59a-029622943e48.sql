ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pvg_approved boolean,
  ADD COLUMN IF NOT EXISTS pvg_approved_at date;