-- Academy vertical: local mirror of FC academies + club linkage

CREATE TABLE IF NOT EXISTS academies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id           uuid UNIQUE NOT NULL,
  name                  text NOT NULL,
  logo_url              text,
  fa_registration_number text,
  eppp_category         int,
  founded_year          int,
  performance_app_url   text,
  synced_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id) ON DELETE SET NULL;

ALTER TABLE academies ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read academy metadata
CREATE POLICY "academies_select_authenticated"
  ON academies FOR SELECT
  TO authenticated
  USING (true);
