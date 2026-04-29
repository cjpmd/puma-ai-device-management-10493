-- Prompts 4–9: schema additions
-- ──────────────────────────────────────────────────────────────────────

-- Two-scorer workflow support on attribute_snapshot
ALTER TABLE attribute_snapshot
  ADD COLUMN IF NOT EXISTS is_final      bool NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS draft_scores_a jsonb,
  ADD COLUMN IF NOT EXISTS scorer_a_id   uuid REFERENCES auth.users(id);

-- Academy settings (one row per academy)
CREATE TABLE IF NOT EXISTS academy_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id            uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE UNIQUE,
  fc_app_url            text,
  min_scout_reports     int  NOT NULL DEFAULT 3,
  rpe_token_expiry_days int  NOT NULL DEFAULT 7,
  notifications         jsonb NOT NULL DEFAULT '{}',
  eppp_config           jsonb NOT NULL DEFAULT '{}',
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE academy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_all" ON academy_settings FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM user_academies ua WHERE ua.academy_id = academy_settings.academy_id AND ua.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM user_academies ua WHERE ua.academy_id = academy_settings.academy_id AND ua.user_id = auth.uid()));

-- RPE entry tokens (short-lived, player-specific, supports unauthenticated self-report)
CREATE TABLE IF NOT EXISTS rpe_token (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rpe_token ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpe_staff" ON rpe_token FOR ALL TO authenticated
  USING (can_access_player(player_id)) WITH CHECK (can_access_player(player_id));
CREATE POLICY "rpe_anon_read" ON rpe_token FOR SELECT TO anon
  USING (expires_at > now());
-- Anon RPE insert: valid only when a live token exists for the target player
CREATE POLICY "tl_anon_rpe" ON training_load FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM rpe_token rt
      WHERE rt.player_id = training_load.player_id AND rt.expires_at > now())
  );

-- ACWR trigger: set acwr_at_time before each training_load insert
-- acute = rolling 7-day avg load; chronic = rolling 28-day avg load; ACWR = acute/chronic
CREATE OR REPLACE FUNCTION fn_acwr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_curr    int     := COALESCE(NEW.duration_minutes,0) * COALESCE(NEW.rpe,0);
  v_acute   numeric;
  v_chronic numeric;
BEGIN
  SELECT COALESCE(SUM(load_au),0) INTO v_acute
  FROM training_load
  WHERE player_id   = NEW.player_id
    AND session_date > NEW.session_date - INTERVAL '7 days'
    AND session_date < NEW.session_date;

  SELECT COALESCE(SUM(load_au),0) INTO v_chronic
  FROM training_load
  WHERE player_id   = NEW.player_id
    AND session_date > NEW.session_date - INTERVAL '28 days'
    AND session_date < NEW.session_date;

  v_acute   := (v_acute   + v_curr) / 7.0;
  v_chronic := (v_chronic + v_curr) / 28.0;

  NEW.acwr_at_time :=
    CASE WHEN v_chronic > 0 THEN ROUND((v_acute / v_chronic)::numeric, 2) ELSE NULL END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acwr ON training_load;
CREATE TRIGGER trg_acwr
  BEFORE INSERT ON training_load
  FOR EACH ROW EXECUTE FUNCTION fn_acwr();

-- Seed 27 default attribute definitions for a new academy
CREATE OR REPLACE FUNCTION seed_attribute_definitions(p_academy_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO attribute_definition (name, category, max_value, descriptors, is_active, academy_id) VALUES
    ('First Touch','technical',10,'{"1":"Frequently loses control","3":"Inconsistent control","5":"Adequate in space","7":"Good under pressure","9":"Exceptional in tight areas"}',true,p_academy_id),
    ('Passing','technical',10,'{"1":"Frequent misplaced passes","3":"Basic short passing","5":"Reliable over 20m","7":"Switches play effectively","9":"Full range, consistent"}',true,p_academy_id),
    ('Shooting','technical',10,'{"1":"Rarely on target","3":"On target from close range","5":"Technique developing","7":"Power and placement","9":"Clinical from multiple positions"}',true,p_academy_id),
    ('Dribbling','technical',10,'{"1":"Loses ball under pressure","3":"Beats static opponents","5":"1v1 in open space","7":"Beats opponents under pressure","9":"Changes pace and direction, elite"}',true,p_academy_id),
    ('Crossing','technical',10,'{"1":"Poor delivery","3":"Delivers into area","5":"Consistent on dominant foot","7":"Both feet, varied delivery","9":"Creates chances consistently"}',true,p_academy_id),
    ('Heading','technical',10,'{"1":"Avoids aerial duels","3":"Wins some headers","5":"Effective in own area","7":"Good power and direction","9":"Dominant in all aerial situations"}',true,p_academy_id),
    ('Ball Control','technical',10,'{"1":"Frequent miscontrols","3":"Basic control in space","5":"Adequate under pressure","7":"Controls all delivery types","9":"Instant control in any situation"}',true,p_academy_id),
    ('Set Pieces','technical',10,'{"1":"Not involved","3":"Basic delivery","5":"Consistent delivery","7":"Creates danger regularly","9":"Key asset from set pieces"}',true,p_academy_id),
    ('Tackling','technical',10,'{"1":"Avoids challenges","3":"Wins some tackles","5":"Sound technique","7":"Wins cleanly under pressure","9":"Elite timing and technique"}',true,p_academy_id),
    ('Pace','physical',10,'{"1":"Below average","3":"Average for age","5":"Above average","7":"Frequently beats opponents","9":"Elite pace for level"}',true,p_academy_id),
    ('Strength','physical',10,'{"1":"Easily dispossessed","3":"Holds off some opponents","5":"Competitive in 50/50s","7":"Dominant physically","9":"Exceptional for age"}',true,p_academy_id),
    ('Stamina','physical',10,'{"1":"Tires quickly","3":"Struggles in second half","5":"Maintains effort 60-70 min","7":"High output full game","9":"Elite conditioning"}',true,p_academy_id),
    ('Agility','physical',10,'{"1":"Slow to change direction","3":"Basic agility","5":"Quick direction changes","7":"Excellent balance and pace change","9":"Elite agility and coordination"}',true,p_academy_id),
    ('Jumping','physical',10,'{"1":"Limited spring","3":"Average jump","5":"Good spring, well-timed","7":"Dominant in aerial duels","9":"Exceptional leap and timing"}',true,p_academy_id),
    ('Balance','physical',10,'{"1":"Falls easily","3":"Basic balance","5":"Maintains under some pressure","7":"Excellent balance in movement","9":"Outstanding coordination"}',true,p_academy_id),
    ('Acceleration','physical',10,'{"1":"Slow to get moving","3":"Average burst","5":"Quick first 5m","7":"Explosive acceleration","9":"Immediate burst, elite"}',true,p_academy_id),
    ('Positioning','tactical',10,'{"1":"Frequently out of position","3":"Basic positional sense","5":"Good awareness","7":"Excellent movement and shape","9":"Controls space, elite"}',true,p_academy_id),
    ('Decision Making','tactical',10,'{"1":"Frequently wrong choice","3":"Makes simple decisions","5":"Reasonable under pressure","7":"Quick and accurate","9":"Always makes best decision rapidly"}',true,p_academy_id),
    ('Off the Ball','tactical',10,'{"1":"Not involved when off ball","3":"Makes some runs","5":"Creates space for teammates","7":"Creates overloads","9":"Constantly manipulates defenders"}',true,p_academy_id),
    ('Pressing','tactical',10,'{"1":"Does not press","3":"Presses occasionally","5":"Presses when organised","7":"High-intensity pressing leader","9":"Elite pressing triggers"}',true,p_academy_id),
    ('Shape Awareness','tactical',10,'{"1":"Ignores team shape","3":"Maintains basic shape","5":"Understands shape instructions","7":"Adapts shape dynamically","9":"Organises and leads"}',true,p_academy_id),
    ('Transition','tactical',10,'{"1":"Slow to transition","3":"Reacts after delay","5":"Transitions in 1-2 seconds","7":"Immediate, directional","9":"Elite, triggers teammates"}',true,p_academy_id),
    ('Work Rate','mental',10,'{"1":"Low effort","3":"Some effort","5":"Consistent effort","7":"High work rate throughout","9":"Elite work rate and attitude"}',true,p_academy_id),
    ('Leadership','mental',10,'{"1":"Passive","3":"Occasional voice","5":"Communicates regularly","7":"Leads by example and voice","9":"Key leader, elevates teammates"}',true,p_academy_id),
    ('Coachability','mental',10,'{"1":"Resistant to feedback","3":"Accepts basic feedback","5":"Applies in training","7":"Rapidly applies in games","9":"Seeks and applies proactively"}',true,p_academy_id),
    ('Composure','mental',10,'{"1":"Panics under pressure","3":"Composed in simple situations","5":"Adequate composure","7":"Calm in high-pressure moments","9":"Elite composure, thrives under pressure"}',true,p_academy_id),
    ('Resilience','mental',10,'{"1":"Gives up after setbacks","3":"Recovers slowly","5":"Bounces back with support","7":"Self-motivated recovery","9":"Uses setbacks as fuel, elite mentality"}',true,p_academy_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Safeguarding RLS verification function
-- Run as a non-welfare user; expect { can_see_restricted: false, rls_working: true }
CREATE OR REPLACE FUNCTION check_safeguarding_rls()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_role    text;
  v_can_see bool;
BEGIN
  SELECT ua.role INTO v_role
  FROM user_academies ua
  WHERE ua.user_id = auth.uid()
    AND ua.role IN ('welfare_officer','head_of_academy')
  LIMIT 1;

  SELECT EXISTS(SELECT 1 FROM welfare_log WHERE is_restricted = true LIMIT 1) INTO v_can_see;

  RETURN jsonb_build_object(
    'calling_role',   COALESCE(v_role, 'other'),
    'can_see_restricted', v_can_see,
    'rls_working', CASE
      WHEN v_role IS NOT NULL THEN true   -- welfare officers should see restricted rows
      ELSE NOT v_can_see                  -- all others must NOT see restricted rows
    END
  );
END;
$$;
