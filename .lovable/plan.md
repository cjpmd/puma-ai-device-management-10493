

## Plan — Show Origin Sports fixtures + compute scores from goals

### Diagnosis
1. **Matches screen** (image 19) reads only the local `matches` table. That table only ever gets rows when you create a match in‑app via "Match Day Setup". The 63 Origin Sports fixtures live in `team_events`, so the Matches screen never sees them (and the few rows that do appear show "Opponent" because `matches.away_team` is `NULL`).

2. **Previous Fixtures** (image 18) all show "Result pending" because `team_events.home_score` / `away_score` are NULL for all 63 rows. The current sync tries to read `event.home_score`, `our_score`, `team_score`, `opponent_score` — none of those exist on Origin Sports' `events` table. **Scores on Origin Sports are derived from `match_events` rows (goal events)**, not stored on the event itself.

3. Side issue surfaced while investigating: the sync function also writes to `team_event_player_stats` and `team_match_events`, **neither of which exists** in this database. Those calls are silently failing. We'll create the `team_match_events` table now (we need it anyway to derive scores) and skip `team_event_player_stats` for this pass.

### Fix

**A. Compute scores from goal events in `sync-external-events`**
- Create local table `team_match_events (id, external_id, event_id, player_id, event_type, minute, period_number, team_side, notes, synced_at)` with `team_side text` (`'home' | 'away' | 'own'`) so we can attribute goals correctly. RLS policies match `team_events` (read via team membership, write via service role).
- After upserting `team_match_events`, for each Origin Sports event:
  - Count `event_type IN ('goal','Goal')` grouped by `team_side` (treat `own` goals against the scoring team).
  - If the external event has explicit `home_score`/`away_score`/`our_score`/`opponent_score` columns, prefer those; otherwise fall back to the goal counts.
  - Write `home_score` / `away_score` onto the corresponding `team_events` row.
- Add a temporary `console.log(JSON.stringify(Object.keys(externalEvents[0])))` once per run so we can confirm which score columns (if any) Origin Sports actually exposes — then tighten the field aliases in a follow-up if needed.

**B. Make Matches screen show Origin Sports fixtures**
- Rewrite `MatchesScreen.tsx` data source from `matches` → `team_events` (filtered by `activeTeam.id`), ordered by `date DESC`, last 20.
- Render using `team_events` columns:
  - Home label: `is_home ? activeTeam.name : opponent`
  - Away label: `is_home ? opponent : activeTeam.name`
  - Score: `home_score`/`away_score` (post-fix these will populate)
  - Status pill: `LIVE` if a linked `matches` row has `status in ('live','recording')`; `WIN/DRAW/LOSS` if both scores present; otherwise `UPCOMING` for future dates / `RESULT PENDING` for past.
- Tap opens `/matches/${match_id}` if a linked `matches` row exists, otherwise opens a lightweight detail (we'll lazily create a `matches` row on first tap of a Match Day Setup so existing recordings still work).

**C. HomeScreen — already correct after sync fix**
- No code change. Once `home_score`/`away_score` populate via (A), the W/D/L chips render automatically from existing logic.

### Files

**Edit**
- `supabase/functions/sync-external-events/index.ts` — fetch `match_events` from external DB, derive scores from goals, also store in new `team_match_events` table; better column-alias logging.
- `src/pages/ios/MatchesScreen.tsx` — switch from `matches` to `team_events`; format opponent label using `is_home` + `activeTeam.name`.

**New**
- Migration: create `public.team_match_events` (FK to `team_events`, RLS via existing `user_team_access` membership), with index on `event_id`.

### Out of scope
- `team_event_player_stats` table (lineups/minutes per match) — separate pass.
- Backfilling `matches` rows for every historic Origin Sports fixture so the Matches screen and old code paths stay in sync — for now MatchesScreen reads `team_events` directly and the linked `matches` row is created on demand when you open Match Day Setup.
- Goal scorers / cards timeline UI — table exists but visualisation comes later.

