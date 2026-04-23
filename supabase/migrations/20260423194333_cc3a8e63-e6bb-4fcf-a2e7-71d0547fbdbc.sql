-- Share links for processed match videos
CREATE TABLE public.match_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  share_token text NOT NULL UNIQUE,
  file_type text NOT NULL CHECK (file_type IN ('video', 'highlights')),
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_shares_match_id ON public.match_shares(match_id);
CREATE INDEX idx_match_shares_token ON public.match_shares(share_token);

ALTER TABLE public.match_shares ENABLE ROW LEVEL SECURITY;

-- Owners (match.user_id = auth.uid()) manage their share links
CREATE POLICY "Match owners can view share links"
  ON public.match_shares
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_shares.match_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Match owners can create share links"
  ON public.match_shares
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_shares.match_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Match owners can update share links"
  ON public.match_shares
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_shares.match_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Match owners can delete share links"
  ON public.match_shares
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_shares.match_id AND m.user_id = auth.uid()
  ));
