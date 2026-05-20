## What I found

I traced every `supabase.from(...)` call in `src/` and `supabase/functions/` and compared the list against the 41 tables currently in the database. Travel + match + GPS + ML tables are all in place. **20 tables that pages and edge functions read/write are missing**, which is why Compliance, Medical, Scouting, Welfare, Coaching, Fitness Testing, Development, Settings, Player Profile, Dashboard and the Hudl/performance-sync edge functions partially break.

Four other names that show up in code (`events`, `match_events`, `event_player_stats`, `academy_clubs`) only live in the **external Football Central database** that the sync edge functions read from — they shouldn't be created locally.

## Plan — one migration that adds 20 tables + RLS + triggers

### Helper for player-scoped policies
Reuse the existing `public.user_can_access_player(_user_id, _player_id)` and `public.user_has_academy_access(_user_id, _academy_id)` security-definer functions. No new helpers needed.

### Tables grouped by feature area

**Player development & performance** (RLS: `user_can_access_player(auth.uid(), player_id)` for all four CRUD ops)

- `attribute_snapshot` — `player_id`, `scores jsonb`, `snapshot_date`, `season`, `is_final bool default true`, `notes`
- `fitness_test_result` — `player_id`, `test_date`, `test_name`, `value numeric`, `unit`, `percentile`, `bio_age numeric`, `notes`
- `maturation_record` — `player_id`, `recorded_date`, `height_cm`, `weight_kg`, `seated_height_cm`, `bio_age_estimate numeric`, `method_used`
- `milestones` — `player_id`, `title`, `description`, `category`, `milestone_date`, `achieved_date`, `is_upcoming bool default true`
- `injury_record` — `player_id`, `injury_date`, `body_part`, `severity`, `rtp_phase int default 0`, `is_resolved bool default false`, `resolved_at`, `notes`
- `training_load` — `player_id`, `session_date`, `session_type`, `rpe int`, `duration int`, `load_au numeric`, `acwr_at_time numeric`, `notes`
- `welfare_log` — `player_id`, `author_id`, `log_date`, `log_type`, `status`, `notes`, `tags text[] default '{}'`, `is_restricted bool default false`
- `parent_communication` — `player_id`, `message`, `direction`, `sent_at`
- `coach_observation` — `player_id`, `author_id`, `observed_at`, `category`, `body`
- `school_attendance` — `player_id`, `term`, `academic_year`, `attendance_pct numeric`
- `video_clip` — `player_id`, `source`, `external_id`, `url`, `title`, `tags text[] default '{}'`, `clip_date`, `description`; unique on (`source`, `external_id`, `player_id`) to support the Hudl idempotency check

**Scouting** (RLS: `user_has_academy_access(auth.uid(), academy_id)` on `prospect`; `scout_report` joins to prospect)

- `prospect` — `academy_id`, `first_name`, `last_name`, `dob`, `position`, `current_club`, `parent_contact`, `pipeline_stage default 'identified'`, `competing_interest`, `international_eligibility_confirmed bool default false`, `approach_date`
- `scout_report` — `prospect_id` (CASCADE → prospect), `scout_id`, `report_date`, `rating int`, `notes`

**Coaching curriculum** (RLS: authenticated read/write — these are global definition tables, no academy scoping in current UI)

- `curriculum_outcome` — `age_group`, `season`, `outcome_title`, `outcome_description`, `title`, `description`, `tags text[]`
- `session_plan` — `title`, `age_group`, `curriculum_tags text[]`, `duration_minutes int`, `drills jsonb`, `created_by`
- `fitness_benchmark` — `test_name`, `age_group`, `sex`, `percentile int`, `value numeric`, `unit`

**Settings & attributes** (RLS: `user_has_academy_access` for `academy_settings`; authenticated read/write for `attribute_definition`)

- `academy_settings` — `academy_id unique`, common columns the Settings page writes (`name`, `fa_affiliation_number`, `eppp_category`, `eppp_tier`, `founded_year`, `head_of_academy_user_id`, plus a `prefs jsonb default '{}'` bag for toggles). I'll make all data columns nullable so the page's `...merged` upsert keeps working as it adds new fields.
- `attribute_definition` — `name`, `category`, `max_value int default 10`, `descriptors jsonb`, `is_active bool default true`

**Sync targets** (already external — these are *local* destinations the sync writes to)

- `team_event_player_stats` — `external_id unique`, `event_id` (→ `team_events.id` CASCADE), `player_id` (→ `players.id`), `period_number`, `team_number`, `position`, `minutes_played`, `appearances`, `goals`, `assists`, `season_start`, `age_group`, `is_captain bool`, `is_substitute bool`, `substitution_time`, `synced_at`. RLS: authenticated read, service-role insert/update (mirrors `team_events`).

**Audit**

- `audit_log` — `actor_id`, `action`, `table_name`, `record_id`, `metadata jsonb`, `created_at`. RLS: authenticated read; insert via service role (used by `sync-performance-summary` edge function).

### Triggers
Standard `update_updated_at_column()` `BEFORE UPDATE` trigger on every table that has `updated_at`.

### Indexes
`player_id`, `academy_id`, `event_id`, `prospect_id` foreign-key columns get B-tree indexes; `video_clip(source, external_id, player_id)` gets the unique index for Hudl dedupe.

## Out of scope

- No UI changes — pages already query these tables correctly; they'll just start returning data.
- I will **not** create `events`, `match_events`, `event_player_stats`, `academy_clubs` locally — those are read from the external Football Central Supabase by the sync edge functions and would be confusing to duplicate.
- No role/permission table refactor for admin-only writes on `attribute_definition`, `curriculum_outcome`, `session_plan`, `fitness_benchmark`. Currently any authenticated user can edit them (matches today's UI which has no role gating). Happy to tighten later if you add a roles table.
- Not migrating any existing data.

## Verification after the migration

1. Load `/scouting` — Add Prospect form should save and the pipeline view should populate (even if empty).
2. Load `/welfare` — "Log welfare" should save.
3. Load `/medical` — RPE log form (`/log-rpe`) inserts into `training_load`; injury list pulls from `injury_record`.
4. Load `/coaching` and `/settings` — curriculum & attribute definitions can be added without errors.
5. Open a player profile → add a fitness test, attribute snapshot, milestone, maturation record — each should write successfully.
6. Run the `sync-performance-summary` edge function — should no longer fail on the `audit_log` insert.

Approve and I'll run the single migration.