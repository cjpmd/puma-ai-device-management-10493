ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS club_website_url TEXT;
ALTER TABLE public.attribute_definition ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local';