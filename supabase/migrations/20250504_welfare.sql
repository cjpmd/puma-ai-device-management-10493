-- ═══════════════════════════════════════════════════════════════════════════
-- Welfare module: tables, RLS, auto-restrict trigger, isolation test function
-- ═══════════════════════════════════════════════════════════════════════════

-- ── welfare_log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.welfare_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  academy_id    uuid        NOT NULL,
  type          text        NOT NULL CHECK (type IN ('pastoral','safeguarding','attendance','communication','general')),
  is_restricted boolean     NOT NULL DEFAULT false,
  content       text,
  status        text        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','in_progress','resolved','closed')),
  tags          text[],
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welfare_log_player   ON public.welfare_log(player_id);
CREATE INDEX IF NOT EXISTS idx_welfare_log_academy  ON public.welfare_log(academy_id);
CREATE INDEX IF NOT EXISTS idx_welfare_log_type     ON public.welfare_log(type);
CREATE INDEX IF NOT EXISTS idx_welfare_log_restrict ON public.welfare_log(is_restricted);

-- ── school_attendance ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_attendance (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         uuid    NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  academic_year     text    NOT NULL,   -- e.g. '2025-26'
  term              integer NOT NULL CHECK (term BETWEEN 1 AND 3),
  school_name       text,
  sessions_possible integer NOT NULL DEFAULT 0 CHECK (sessions_possible >= 0),
  sessions_attended integer NOT NULL DEFAULT 0 CHECK (sessions_attended >= 0),
  attendance_pct    numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN sessions_possible > 0
         THEN ROUND((sessions_attended::numeric / sessions_possible) * 100, 2)
         ELSE NULL END
  ) STORED,
  flagged           boolean GENERATED ALWAYS AS (
    CASE WHEN sessions_possible > 0
         THEN (sessions_attended::numeric / sessions_possible) < 0.8
         ELSE false END
  ) STORED,
  notes             text,
  logged_by         uuid REFERENCES auth.users(id),
  logged_at         timestamptz DEFAULT now(),
  UNIQUE (player_id, academic_year, term)
);

-- ── safeguarding_checklist ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safeguarding_checklist (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id         uuid NOT NULL,
  category           text NOT NULL DEFAULT 'general',
  item_name          text NOT NULL,
  responsible_person text,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('compliant','due_soon','overdue','pending','not_applicable')),
  expiry_date        date,
  notes              text,
  updated_by         uuid REFERENCES auth.users(id),
  updated_at         timestamptz DEFAULT now()
);

-- ── education_plan ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.education_plan (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           uuid NOT NULL UNIQUE REFERENCES public.players(id) ON DELETE CASCADE,
  school_name         text,
  year_group          text,
  qualifications      text[],
  -- exam_periods: [{"start":"YYYY-MM-DD","end":"YYYY-MM-DD","level":"GCSE","load_reduction_pct":40}]
  exam_periods        jsonb   NOT NULL DEFAULT '[]',
  career_aspirations  text,
  support_notes       text,
  last_review_date    date,
  next_review_date    date,
  updated_by          uuid REFERENCES auth.users(id),
  updated_at          timestamptz DEFAULT now()
);

-- ── parent_message ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_message (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  sender_id   uuid REFERENCES auth.users(id),
  sender_name text NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('staff','parent')),
  subject     text,
  body        text NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_msg_thread ON public.parent_message(thread_id);
CREATE INDEX IF NOT EXISTS idx_parent_msg_player ON public.parent_message(player_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — enable on all welfare tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.welfare_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safeguarding_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_plan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_message         ENABLE ROW LEVEL SECURITY;

-- ── welfare_log: the critical table ─────────────────────────────────────────

DROP POLICY IF EXISTS "welfare_unrestricted_select" ON public.welfare_log;
DROP POLICY IF EXISTS "welfare_restricted_select"   ON public.welfare_log;
DROP POLICY IF EXISTS "welfare_insert"              ON public.welfare_log;
DROP POLICY IF EXISTS "welfare_update"              ON public.welfare_log;
DROP POLICY IF EXISTS "welfare_delete"              ON public.welfare_log;

-- Any academy member can read non-restricted rows
CREATE POLICY "welfare_unrestricted_select" ON public.welfare_log
  FOR SELECT USING (
    is_restricted = false
    AND EXISTS (
      SELECT 1 FROM public.user_academies
      WHERE user_id = auth.uid() AND academy_id = welfare_log.academy_id
    )
  );

-- Only welfare/safeguarding/HoA roles can read restricted (safeguarding) rows
CREATE POLICY "welfare_restricted_select" ON public.welfare_log
  FOR SELECT USING (
    is_restricted = true
    AND EXISTS (
      SELECT 1 FROM public.user_academies
      WHERE user_id    = auth.uid()
        AND academy_id = welfare_log.academy_id
        AND role IN ('welfare_officer','safeguarding_lead','head_of_academy')
    )
  );

CREATE POLICY "welfare_insert" ON public.welfare_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_academies
      WHERE user_id = auth.uid() AND academy_id = welfare_log.academy_id
    )
  );

CREATE POLICY "welfare_update" ON public.welfare_log
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_academies
      WHERE user_id = auth.uid() AND academy_id = welfare_log.academy_id
        AND role IN ('welfare_officer','safeguarding_lead','head_of_academy')
    )
  );

CREATE POLICY "welfare_delete" ON public.welfare_log
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_academies
      WHERE user_id = auth.uid() AND academy_id = welfare_log.academy_id
        AND role IN ('welfare_officer','safeguarding_lead','head_of_academy')
    )
  );

-- ── school_attendance ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_select" ON public.school_attendance;
DROP POLICY IF EXISTS "sa_write"  ON public.school_attendance;

CREATE POLICY "sa_select" ON public.school_attendance FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sa_write"  ON public.school_attendance FOR ALL
  USING    (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── safeguarding_checklist ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "sg_select" ON public.safeguarding_checklist;
DROP POLICY IF EXISTS "sg_write"  ON public.safeguarding_checklist;

CREATE POLICY "sg_select" ON public.safeguarding_checklist FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sg_write"  ON public.safeguarding_checklist FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_academies
      WHERE user_id = auth.uid() AND academy_id = safeguarding_checklist.academy_id
        AND role IN ('welfare_officer','safeguarding_lead','head_of_academy'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_academies
      WHERE user_id = auth.uid() AND academy_id = safeguarding_checklist.academy_id
        AND role IN ('welfare_officer','safeguarding_lead','head_of_academy'))
  );

-- ── education_plan ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ep_select" ON public.education_plan;
DROP POLICY IF EXISTS "ep_write"  ON public.education_plan;

CREATE POLICY "ep_select" ON public.education_plan FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ep_write"  ON public.education_plan FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── parent_message ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pm_select" ON public.parent_message;
DROP POLICY IF EXISTS "pm_insert" ON public.parent_message;

CREATE POLICY "pm_select" ON public.parent_message FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_insert" ON public.parent_message FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- Trigger: auto-set is_restricted = true when type = 'safeguarding'
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_welfare_log_auto_restrict()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type = 'safeguarding' THEN
    NEW.is_restricted := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_welfare_log_auto_restrict ON public.welfare_log;
CREATE TRIGGER trig_welfare_log_auto_restrict
  BEFORE INSERT OR UPDATE OF type ON public.welfare_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_welfare_log_auto_restrict();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Isolation Test
--
-- Confirms a non-welfare user cannot SELECT is_restricted=true rows.
-- Run: SELECT * FROM public.verify_welfare_rls_isolation();
-- All rows must have passed = true.
--
-- T4 and T5 require ≥2 rows in auth.users. If the project has fewer,
-- those tests report passed=NULL with detail='SKIP'.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.verify_welfare_rls_isolation()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_test_id         uuid    := gen_random_uuid();
  -- Use a sentinel academy UUID that real users will not belong to
  v_academy_id      uuid    := 'fee1dead-0000-4000-a000-000000000099'::uuid;
  v_player_id       uuid;
  v_coach_id        uuid;
  v_welfare_id      uuid;
  v_orig_coach_role text;
  v_orig_wel_role   text;
  v_coach_existed   boolean := false;
  v_welfare_existed boolean := false;
  v_count           integer;
  v_rls_on          boolean;
  v_is_restr        boolean;
BEGIN
  -- ── T1: RLS is enabled ────────────────────────────────────────────────────
  SELECT relrowsecurity INTO v_rls_on
  FROM   pg_class
  WHERE  relname = 'welfare_log'
    AND  relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  RETURN QUERY SELECT
    'T1: RLS enabled on welfare_log'::text,
    COALESCE(v_rls_on, false),
    CASE WHEN v_rls_on THEN 'PASS'
         ELSE 'FAIL — run: ALTER TABLE public.welfare_log ENABLE ROW LEVEL SECURITY' END;

  -- ── T2: welfare_restricted_select policy exists ───────────────────────────
  RETURN QUERY SELECT
    'T2: welfare_restricted_select policy exists'::text,
    EXISTS(SELECT 1 FROM pg_policies
           WHERE tablename = 'welfare_log' AND policyname = 'welfare_restricted_select'),
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies
                     WHERE tablename = 'welfare_log' AND policyname = 'welfare_restricted_select')
         THEN 'PASS' ELSE 'FAIL — policy not found in pg_policies' END;

  -- ── T3: auto-restrict trigger sets is_restricted=true ────────────────────
  SELECT id INTO v_player_id FROM public.players LIMIT 1;

  IF v_player_id IS NULL THEN
    RETURN QUERY SELECT 'T3: auto-restrict trigger'::text, NULL::boolean,
                        'SKIP — no rows in players table'::text;
  ELSE
    -- Insert with is_restricted=FALSE; trigger must flip it to TRUE
    INSERT INTO public.welfare_log(id, player_id, academy_id, type, is_restricted, status)
    VALUES (v_test_id, v_player_id, v_academy_id, 'safeguarding', false, 'open');

    SELECT is_restricted INTO v_is_restr
    FROM   public.welfare_log WHERE id = v_test_id;

    RETURN QUERY SELECT
      'T3: trigger auto-sets is_restricted=true for type=safeguarding'::text,
      COALESCE(v_is_restr, false),
      format('is_restricted = %s (expected true)', COALESCE(v_is_restr::text,'null'));
  END IF;

  -- No row to test T4/T5 against
  IF v_player_id IS NULL THEN RETURN; END IF;

  -- ── T4 + T5: runtime SELECT isolation ────────────────────────────────────
  -- Pick two distinct real auth.users to avoid FK violations on user_academies
  SELECT id INTO v_coach_id   FROM auth.users ORDER BY created_at ASC  LIMIT 1;
  SELECT id INTO v_welfare_id FROM auth.users ORDER BY created_at ASC  LIMIT 1 OFFSET 1;

  IF v_coach_id IS NULL OR v_welfare_id IS NULL OR v_coach_id = v_welfare_id THEN
    RETURN QUERY SELECT 'T4: non-welfare blocked'::text, NULL::boolean,
      'SKIP — need ≥2 users in auth.users; add users then re-run'::text;
    RETURN QUERY SELECT 'T5: welfare permitted'::text, NULL::boolean,
      'SKIP — need ≥2 users in auth.users; add users then re-run'::text;
    DELETE FROM public.welfare_log WHERE id = v_test_id;
    RETURN;
  END IF;

  -- Snapshot existing user_academies rows (restore after test)
  SELECT role INTO v_orig_coach_role FROM public.user_academies
  WHERE user_id = v_coach_id AND academy_id = v_academy_id;
  v_coach_existed := FOUND;

  SELECT role INTO v_orig_wel_role FROM public.user_academies
  WHERE user_id = v_welfare_id AND academy_id = v_academy_id;
  v_welfare_existed := FOUND;

  -- Temporarily assign roles at the test academy
  INSERT INTO public.user_academies(user_id, academy_id, role)
  VALUES (v_coach_id, v_academy_id, 'coach')
  ON CONFLICT (user_id, academy_id) DO UPDATE SET role = 'coach';

  INSERT INTO public.user_academies(user_id, academy_id, role)
  VALUES (v_welfare_id, v_academy_id, 'welfare_officer')
  ON CONFLICT (user_id, academy_id) DO UPDATE SET role = 'welfare_officer';

  -- T4: coach (non-welfare) must see 0 restricted rows
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_coach_id::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*)::integer INTO v_count FROM public.welfare_log WHERE id = v_test_id;
  RESET ROLE;

  RETURN QUERY SELECT
    'T4: non-welfare user (coach) cannot SELECT restricted welfare_log row'::text,
    (v_count = 0),
    format('Rows visible to coach = %s (expected 0)', v_count);

  -- T5: welfare_officer must see 1 restricted row
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_welfare_id::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*)::integer INTO v_count FROM public.welfare_log WHERE id = v_test_id;
  RESET ROLE;

  RETURN QUERY SELECT
    'T5: welfare_officer CAN SELECT restricted welfare_log row'::text,
    (v_count = 1),
    format('Rows visible to welfare_officer = %s (expected 1)', v_count);

  -- ── Cleanup ───────────────────────────────────────────────────────────────
  DELETE FROM public.welfare_log WHERE id = v_test_id;

  IF v_coach_existed THEN
    UPDATE public.user_academies SET role = v_orig_coach_role
    WHERE  user_id = v_coach_id AND academy_id = v_academy_id;
  ELSE
    DELETE FROM public.user_academies
    WHERE  user_id = v_coach_id AND academy_id = v_academy_id;
  END IF;

  IF v_welfare_existed THEN
    UPDATE public.user_academies SET role = v_orig_wel_role
    WHERE  user_id = v_welfare_id AND academy_id = v_academy_id;
  ELSE
    DELETE FROM public.user_academies
    WHERE  user_id = v_welfare_id AND academy_id = v_academy_id;
  END IF;

EXCEPTION WHEN OTHERS THEN
  BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.welfare_log WHERE id = v_test_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN QUERY SELECT 'EXCEPTION'::text, false, SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_welfare_rls_isolation() TO service_role;
