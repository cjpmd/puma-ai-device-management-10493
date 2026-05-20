ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS background_check_jurisdiction text NOT NULL DEFAULT 'england';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS background_check_type text,
  ADD COLUMN IF NOT EXISTS pvg_expiry date,
  ADD COLUMN IF NOT EXISTS accessni_expiry date;