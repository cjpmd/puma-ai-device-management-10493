
-- Create upload_tokens table for guest camera phone access
CREATE TABLE public.upload_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  camera_side text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add a validation trigger for camera_side
CREATE OR REPLACE FUNCTION public.validate_upload_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.camera_side NOT IN ('left', 'right') THEN
    RAISE EXCEPTION 'camera_side must be left or right';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_upload_token_trigger
BEFORE INSERT OR UPDATE ON public.upload_tokens
FOR EACH ROW
EXECUTE FUNCTION public.validate_upload_token();

-- Enable RLS
ALTER TABLE public.upload_tokens ENABLE ROW LEVEL SECURITY;

-- Match owner can SELECT their tokens
CREATE POLICY "Match owners can view their upload tokens"
ON public.upload_tokens
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.matches
  WHERE matches.id = upload_tokens.match_id
  AND matches.user_id = auth.uid()
));

-- Match owner can INSERT tokens
CREATE POLICY "Match owners can create upload tokens"
ON public.upload_tokens
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.matches
  WHERE matches.id = upload_tokens.match_id
  AND matches.user_id = auth.uid()
));

-- Match owner can DELETE tokens
CREATE POLICY "Match owners can delete upload tokens"
ON public.upload_tokens
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.matches
  WHERE matches.id = upload_tokens.match_id
  AND matches.user_id = auth.uid()
));

-- Index for fast token lookups
CREATE INDEX idx_upload_tokens_token ON public.upload_tokens(token);
CREATE INDEX idx_upload_tokens_match_id ON public.upload_tokens(match_id);
