-- Foundation tables for academy vertical (Prompt 3)
-- Coexists with existing player_attributes table (43 smallint columns)

-- Local mirror of Football Central user_academies, populated by sync-external-academy
CREATE TABLE IF NOT EXISTS user_academies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id  uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'academy_admin',
  external_id uuid,
  synced_at   timestamptz,
  UNIQUE (user_id, academy_id)
);

-- Attribute definitions for academy development workflow
CREATE TABLE IF NOT EXISTS attribute_definition (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN ('technical','physical','tactical','mental')),
  max_value   int NOT NULL DEFAULT 10,
  descriptors jsonb,
  is_active   bool NOT NULL DEFAULT true,
  academy_id  uuid REFERENCES academies(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Attribute snapshots (separate from player_attributes — academy development workflow)
CREATE TABLE IF NOT EXISTS attribute_snapshot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  scorer_id     uuid NOT NULL REFERENCES auth.users(id),
  snapshot_date date NOT NULL,
  season        text,
  scores        jsonb NOT NULL DEFAULT '{}',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Bio-maturation records
CREATE TABLE IF NOT EXISTS maturation_record (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  recorded_date    date NOT NULL,
  height_cm        numeric,
  weight_kg        numeric,
  seated_height_cm numeric,
  bio_age_estimate numeric,
  method_used      text NOT NULL DEFAULT 'Mirwald_2002',
  recorded_by      uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Injury records
CREATE TABLE IF NOT EXISTS injury_record (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id            uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  injury_type          text,
  body_part            text,
  severity             int CHECK (severity BETWEEN 1 AND 3),
  injury_date          date NOT NULL,
  expected_return_date date,
  actual_return_date   date,
  mechanism            text,
  rtp_phase            int NOT NULL DEFAULT 1 CHECK (rtp_phase BETWEEN 1 AND 5),
  notes                text,
  recorded_by          uuid REFERENCES auth.users(id),
  is_resolved          bool NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Training load and GPS session data
CREATE TABLE IF NOT EXISTS training_load (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id               uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_date            date NOT NULL,
  session_type            text,
  duration_minutes        int,
  rpe                     int,
  load_au                 int GENERATED ALWAYS AS (COALESCE(duration_minutes, 0) * COALESCE(rpe, 0)) STORED,
  acwr_at_time            numeric,
  gps_total_distance      numeric,
  gps_high_speed_distance numeric,
  gps_sprint_count        int,
  gps_max_speed           numeric,
  recorded_by             uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Fitness test results
CREATE TABLE IF NOT EXISTS fitness_test (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  test_date          date NOT NULL,
  test_type          text NOT NULL,
  value              numeric,
  unit               text,
  percentile_for_age numeric,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Reference percentile benchmarks by age
CREATE TABLE IF NOT EXISTS fitness_benchmark (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type     text NOT NULL,
  age_years     int NOT NULL,
  percentile_25 numeric,
  percentile_50 numeric,
  percentile_75 numeric,
  UNIQUE (test_type, age_years)
);

-- Welfare / safeguarding logs
CREATE TABLE IF NOT EXISTS welfare_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES auth.users(id),
  log_date      date NOT NULL,
  log_type      text,
  status        text NOT NULL DEFAULT 'open',
  notes         text,
  tags          text[],
  is_restricted bool NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- School attendance tracking
CREATE TABLE IF NOT EXISTS school_attendance (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  term           text,
  academic_year  text,
  attendance_pct numeric,
  source         text NOT NULL DEFAULT 'manual',
  notes          text,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

-- Scouting pipeline prospects
CREATE TABLE IF NOT EXISTS prospect (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id                          uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  first_name                          text NOT NULL,
  last_name                           text NOT NULL,
  dob                                 date,
  position                            text,
  current_club                        text,
  pipeline_stage                      text NOT NULL DEFAULT 'identified',
  competing_interest                  bool NOT NULL DEFAULT false,
  international_eligibility_confirmed bool NOT NULL DEFAULT true,
  approach_date                       date,
  parent_contact                      text,
  player_id                           uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at                          timestamptz NOT NULL DEFAULT now()
);

-- Scout reports on prospects
CREATE TABLE IF NOT EXISTS scout_report (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id    uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  scout_id       uuid NOT NULL REFERENCES auth.users(id),
  report_date    date NOT NULL,
  scores         jsonb,
  narrative      text,
  recommendation text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Trial sessions for prospects
CREATE TABLE IF NOT EXISTS trial_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id       uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  session_date      date NOT NULL,
  session_type      text,
  observer_id       uuid REFERENCES auth.users(id),
  completed         bool NOT NULL DEFAULT false,
  notes             text,
  decision_deadline date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Coaching session plans
CREATE TABLE IF NOT EXISTS session_plan (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id       uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  author_id        uuid NOT NULL REFERENCES auth.users(id),
  title            text NOT NULL,
  age_group        text,
  curriculum_tags  text[],
  duration_minutes int,
  drills           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Curriculum outcomes per academy / age group / season
CREATE TABLE IF NOT EXISTS curriculum_outcome (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id          uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  age_group           text,
  season              text,
  outcome_title       text NOT NULL,
  outcome_description text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Coach observations tied to session plans
CREATE TABLE IF NOT EXISTS coach_observation (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_plan_id  uuid REFERENCES session_plan(id) ON DELETE SET NULL,
  observer_id      uuid NOT NULL REFERENCES auth.users(id),
  player_id        uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  observation_date date NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Player milestones
CREATE TABLE IF NOT EXISTS milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  milestone_date date NOT NULL,
  category       text,
  title          text NOT NULL,
  is_upcoming    bool NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Video clips (supplementary metadata; does not touch existing video pipeline tables)
CREATE TABLE IF NOT EXISTS video_clip (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid REFERENCES players(id) ON DELETE SET NULL,
  match_id      uuid REFERENCES matches(id) ON DELETE SET NULL,
  source        text,
  external_url  text,
  wasabi_path   text,
  thumbnail_url text,
  tags          text[],
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Parent / guardian communications log
CREATE TABLE IF NOT EXISTS parent_communication (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  welfare_officer_id uuid NOT NULL REFERENCES auth.users(id),
  parent_user_id     text,
  message            text,
  direction          text CHECK (direction IN ('inbound','outbound')),
  sent_at            timestamptz NOT NULL DEFAULT now()
);

-- Immutable audit log — INSERT only via RLS; reads via service role for compliance export
CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id),
  action     text NOT NULL,
  table_name text,
  record_id  text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE user_academies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_snapshot   ENABLE ROW LEVEL SECURITY;
ALTER TABLE maturation_record    ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_record        ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_load        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_test         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_benchmark    ENABLE ROW LEVEL SECURITY;
ALTER TABLE welfare_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_attendance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_report         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_session        ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_plan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_outcome   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_observation    ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_clip           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_communication ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- ─── Helper function ─────────────────────────────────────────────────────────
-- Returns true if the calling user has access to the player via team membership
-- OR via an academy that owns a club that owns the team.
CREATE OR REPLACE FUNCTION can_access_player(p_player_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    -- Direct team membership
    EXISTS (
      SELECT 1 FROM user_team_access uta
      JOIN players pl ON pl.team_id = uta.team_id
      WHERE pl.id = p_player_id AND uta.user_id = auth.uid()
    )
    OR
    -- Academy membership (academy → clubs → teams → players)
    EXISTS (
      SELECT 1 FROM user_academies ua
      JOIN academies a  ON a.id  = ua.academy_id
      JOIN clubs c      ON c.academy_id = a.id
      JOIN teams t      ON t.club_id    = c.id
      JOIN players pl   ON pl.team_id   = t.id
      WHERE pl.id = p_player_id AND ua.user_id = auth.uid()
    );
$$;

-- ─── user_academies ───────────────────────────────────────────────────────────

-- Users see only their own rows; only the sync Edge Function (service role) writes
CREATE POLICY "ua_select_own" ON user_academies
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "ua_insert_service" ON user_academies
  FOR INSERT TO authenticated WITH CHECK (false);

-- ─── attribute_definition ────────────────────────────────────────────────────

CREATE POLICY "attrdef_select" ON attribute_definition
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = attribute_definition.academy_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "attrdef_write" ON attribute_definition
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = attribute_definition.academy_id AND ua.user_id = auth.uid()
  ));

-- ─── Player-scoped tables (standard pattern) ─────────────────────────────────

CREATE POLICY "attrsnap_select" ON attribute_snapshot
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "attrsnap_insert" ON attribute_snapshot
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));
CREATE POLICY "attrsnap_update" ON attribute_snapshot
  FOR UPDATE TO authenticated USING (can_access_player(player_id));

CREATE POLICY "mat_select" ON maturation_record
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "mat_insert" ON maturation_record
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));
CREATE POLICY "mat_update" ON maturation_record
  FOR UPDATE TO authenticated USING (can_access_player(player_id));

CREATE POLICY "inj_select" ON injury_record
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "inj_insert" ON injury_record
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));
CREATE POLICY "inj_update" ON injury_record
  FOR UPDATE TO authenticated USING (can_access_player(player_id));

CREATE POLICY "tl_select" ON training_load
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "tl_insert" ON training_load
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));
CREATE POLICY "tl_update" ON training_load
  FOR UPDATE TO authenticated USING (can_access_player(player_id));

CREATE POLICY "ft_select" ON fitness_test
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "ft_insert" ON fitness_test
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));

CREATE POLICY "fb_select" ON fitness_benchmark
  FOR SELECT TO authenticated USING (true);

-- ─── welfare_log (restricted rows need elevated role) ─────────────────────────

CREATE POLICY "wl_select_normal" ON welfare_log
  FOR SELECT TO authenticated
  USING (
    is_restricted = false
    AND can_access_player(player_id)
  );

CREATE POLICY "wl_select_restricted" ON welfare_log
  FOR SELECT TO authenticated
  USING (
    is_restricted = true
    AND EXISTS (
      SELECT 1 FROM user_academies ua
      JOIN academies a ON a.id  = ua.academy_id
      JOIN clubs c     ON c.academy_id = a.id
      JOIN teams t     ON t.club_id    = c.id
      JOIN players pl  ON pl.team_id   = t.id
      WHERE pl.id = welfare_log.player_id
        AND ua.user_id = auth.uid()
        AND ua.role IN ('welfare_officer','head_of_academy')
    )
  );

CREATE POLICY "wl_insert" ON welfare_log
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));

CREATE POLICY "wl_update" ON welfare_log
  FOR UPDATE TO authenticated USING (can_access_player(player_id));

-- Trigger: write audit_log entry whenever a restricted welfare_log row is accessed.
-- Postgres does not support AFTER SELECT triggers; the application must call the
-- write_welfare_audit(log_id) RPC when fetching restricted rows. TODO: implement RPC.

CREATE POLICY "sa_select" ON school_attendance
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "sa_insert" ON school_attendance
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));

-- ─── Academy-scoped tables ───────────────────────────────────────────────────

CREATE POLICY "pros_select" ON prospect
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = prospect.academy_id AND ua.user_id = auth.uid()
  ));
CREATE POLICY "pros_insert" ON prospect
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = prospect.academy_id AND ua.user_id = auth.uid()
  ));
CREATE POLICY "pros_update" ON prospect
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = prospect.academy_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "sr_select" ON scout_report
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM prospect p
    JOIN user_academies ua ON ua.academy_id = p.academy_id
    WHERE p.id = scout_report.prospect_id AND ua.user_id = auth.uid()
  ));
CREATE POLICY "sr_insert" ON scout_report
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM prospect p
    JOIN user_academies ua ON ua.academy_id = p.academy_id
    WHERE p.id = scout_report.prospect_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "ts_select" ON trial_session
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM prospect p
    JOIN user_academies ua ON ua.academy_id = p.academy_id
    WHERE p.id = trial_session.prospect_id AND ua.user_id = auth.uid()
  ));
CREATE POLICY "ts_insert" ON trial_session
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM prospect p
    JOIN user_academies ua ON ua.academy_id = p.academy_id
    WHERE p.id = trial_session.prospect_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "sp_select" ON session_plan
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = session_plan.academy_id AND ua.user_id = auth.uid()
  ));
CREATE POLICY "sp_insert" ON session_plan
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = session_plan.academy_id AND ua.user_id = auth.uid()
  ));
CREATE POLICY "sp_update" ON session_plan
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = session_plan.academy_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "co_select" ON curriculum_outcome
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = curriculum_outcome.academy_id AND ua.user_id = auth.uid()
  ));
CREATE POLICY "co_insert" ON curriculum_outcome
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_academies ua
    WHERE ua.academy_id = curriculum_outcome.academy_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "cobs_select" ON coach_observation
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "cobs_insert" ON coach_observation
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));

CREATE POLICY "mil_select" ON milestones
  FOR SELECT TO authenticated USING (can_access_player(player_id));
CREATE POLICY "mil_insert" ON milestones
  FOR INSERT TO authenticated WITH CHECK (can_access_player(player_id));

-- video_clip: player or match access
CREATE POLICY "vc_select" ON video_clip
  FOR SELECT TO authenticated
  USING (
    (player_id IS NULL OR can_access_player(player_id))
    AND (
      match_id IS NULL
      OR EXISTS (
        SELECT 1 FROM user_team_access uta
        JOIN matches m ON m.team_id = uta.team_id
        WHERE m.id = video_clip.match_id AND uta.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "vc_insert" ON video_clip
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "pc_select" ON parent_communication
  FOR SELECT TO authenticated
  USING (welfare_officer_id = auth.uid() OR can_access_player(player_id));
CREATE POLICY "pc_insert" ON parent_communication
  FOR INSERT TO authenticated
  WITH CHECK (welfare_officer_id = auth.uid());

-- audit_log: INSERT only for authenticated users; no SELECT/UPDATE/DELETE via RLS
CREATE POLICY "al_insert" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
