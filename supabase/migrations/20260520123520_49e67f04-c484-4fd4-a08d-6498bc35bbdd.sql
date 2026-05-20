
-- ============================================================================
-- Player-scoped tables (RLS via user_can_access_player)
-- ============================================================================

CREATE TABLE public.attribute_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}',
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  season text,
  is_final boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attribute_snapshot_player ON public.attribute_snapshot(player_id);

CREATE TABLE public.fitness_test_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  test_date date NOT NULL,
  test_name text NOT NULL,
  value numeric,
  unit text,
  percentile numeric,
  bio_age numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fitness_test_result_player ON public.fitness_test_result(player_id);

CREATE TABLE public.maturation_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  recorded_date date NOT NULL,
  height_cm numeric,
  weight_kg numeric,
  seated_height_cm numeric,
  bio_age_estimate numeric,
  method_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_maturation_record_player ON public.maturation_record(player_id);

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  milestone_date date,
  achieved_date date,
  is_upcoming boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_milestones_player ON public.milestones(player_id);

CREATE TABLE public.injury_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  injury_date date NOT NULL,
  body_part text,
  severity text,
  rtp_phase integer NOT NULL DEFAULT 0,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_injury_record_player ON public.injury_record(player_id);

CREATE TABLE public.training_load (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  session_date date NOT NULL,
  session_type text,
  rpe integer,
  duration integer,
  load_au numeric,
  acwr_at_time numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_load_player ON public.training_load(player_id);

CREATE TABLE public.welfare_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  author_id uuid,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  log_type text,
  status text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  is_restricted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_welfare_log_player ON public.welfare_log(player_id);

CREATE TABLE public.parent_communication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  message text,
  direction text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_parent_communication_player ON public.parent_communication(player_id);

CREATE TABLE public.coach_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  author_id uuid,
  observed_at timestamptz NOT NULL DEFAULT now(),
  category text,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coach_observation_player ON public.coach_observation(player_id);

CREATE TABLE public.school_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  term text,
  academic_year text,
  attendance_pct numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_attendance_player ON public.school_attendance(player_id);

CREATE TABLE public.video_clip (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  source text NOT NULL,
  external_id text,
  url text,
  title text,
  tags text[] NOT NULL DEFAULT '{}',
  clip_date date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_video_clip_dedupe ON public.video_clip(source, external_id, player_id) WHERE external_id IS NOT NULL;

-- Enable RLS + policies for all player-scoped tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attribute_snapshot','fitness_test_result','maturation_record','milestones',
    'injury_record','training_load','welfare_log','parent_communication',
    'coach_observation','school_attendance','video_clip'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "select player-scoped" ON public.%I FOR SELECT TO authenticated USING (public.user_can_access_player(auth.uid(), player_id))$p$, t);
    EXECUTE format($p$CREATE POLICY "insert player-scoped" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_can_access_player(auth.uid(), player_id))$p$, t);
    EXECUTE format($p$CREATE POLICY "update player-scoped" ON public.%I FOR UPDATE TO authenticated USING (public.user_can_access_player(auth.uid(), player_id)) WITH CHECK (public.user_can_access_player(auth.uid(), player_id))$p$, t);
    EXECUTE format($p$CREATE POLICY "delete player-scoped" ON public.%I FOR DELETE TO authenticated USING (public.user_can_access_player(auth.uid(), player_id))$p$, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- Scouting (academy-scoped)
-- ============================================================================

CREATE TABLE public.prospect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  dob date,
  position text,
  current_club text,
  parent_contact text,
  pipeline_stage text NOT NULL DEFAULT 'identified',
  competing_interest text,
  international_eligibility_confirmed boolean NOT NULL DEFAULT false,
  approach_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prospect_academy ON public.prospect(academy_id);
ALTER TABLE public.prospect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select prospects" ON public.prospect FOR SELECT TO authenticated USING (public.user_has_academy_access(auth.uid(), academy_id));
CREATE POLICY "insert prospects" ON public.prospect FOR INSERT TO authenticated WITH CHECK (public.user_has_academy_access(auth.uid(), academy_id));
CREATE POLICY "update prospects" ON public.prospect FOR UPDATE TO authenticated USING (public.user_has_academy_access(auth.uid(), academy_id)) WITH CHECK (public.user_has_academy_access(auth.uid(), academy_id));
CREATE POLICY "delete prospects" ON public.prospect FOR DELETE TO authenticated USING (public.user_has_academy_access(auth.uid(), academy_id));
CREATE TRIGGER trg_prospect_updated_at BEFORE UPDATE ON public.prospect FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.scout_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospect(id) ON DELETE CASCADE,
  scout_id uuid,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  rating integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scout_report_prospect ON public.scout_report(prospect_id);
ALTER TABLE public.scout_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage scout reports" ON public.scout_report FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospect p WHERE p.id = scout_report.prospect_id AND public.user_has_academy_access(auth.uid(), p.academy_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.prospect p WHERE p.id = scout_report.prospect_id AND public.user_has_academy_access(auth.uid(), p.academy_id)));
CREATE TRIGGER trg_scout_report_updated_at BEFORE UPDATE ON public.scout_report FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Coaching curriculum (global, authenticated read/write)
-- ============================================================================

CREATE TABLE public.curriculum_outcome (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group text,
  season text,
  outcome_title text,
  outcome_description text,
  title text,
  description text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.curriculum_outcome ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage curriculum" ON public.curriculum_outcome FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_curriculum_outcome_updated_at BEFORE UPDATE ON public.curriculum_outcome FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.session_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  age_group text,
  curriculum_tags text[] DEFAULT '{}',
  duration_minutes integer,
  drills jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage session plans" ON public.session_plan FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_session_plan_updated_at BEFORE UPDATE ON public.session_plan FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fitness_benchmark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  age_group text,
  sex text,
  percentile integer,
  value numeric,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fitness_benchmark ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage benchmarks" ON public.fitness_benchmark FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fitness_benchmark_updated_at BEFORE UPDATE ON public.fitness_benchmark FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Settings & attribute definitions
-- ============================================================================

CREATE TABLE public.academy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL UNIQUE,
  name text,
  fa_affiliation_number text,
  eppp_category text,
  eppp_tier text,
  founded_year integer,
  head_of_academy_user_id uuid,
  prefs jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_academy_settings_academy ON public.academy_settings(academy_id);
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage academy settings" ON public.academy_settings FOR ALL TO authenticated
  USING (public.user_has_academy_access(auth.uid(), academy_id))
  WITH CHECK (public.user_has_academy_access(auth.uid(), academy_id));
CREATE TRIGGER trg_academy_settings_updated_at BEFORE UPDATE ON public.academy_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.attribute_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  max_value integer NOT NULL DEFAULT 10,
  descriptors jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attribute_definition ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage attribute defs" ON public.attribute_definition FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_attribute_definition_updated_at BEFORE UPDATE ON public.attribute_definition FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Team event player stats (sync target, mirrors team_events pattern)
-- ============================================================================

CREATE TABLE public.team_event_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  event_id uuid NOT NULL,
  player_id uuid,
  period_number integer,
  team_number integer,
  position text,
  minutes_played integer,
  appearances integer,
  goals integer,
  assists integer,
  season_start integer,
  age_group text,
  is_captain boolean DEFAULT false,
  is_substitute boolean DEFAULT false,
  substitution_time text,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_teps_event ON public.team_event_player_stats(event_id);
CREATE INDEX idx_teps_player ON public.team_event_player_stats(player_id);
ALTER TABLE public.team_event_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read team event player stats" ON public.team_event_player_stats FOR SELECT USING (true);
CREATE POLICY "Service role can insert team event player stats" ON public.team_event_player_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update team event player stats" ON public.team_event_player_stats FOR UPDATE USING (true);
CREATE TRIGGER trg_teps_updated_at BEFORE UPDATE ON public.team_event_player_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Audit log
-- ============================================================================

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read audit" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
