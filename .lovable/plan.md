

## Plan — Fix Matches list + score derivation

### Diagnosis
1. **Matches screen blank.** The 63 synced fixtures have `event_type` values `'fixture'` (24) and `'friendly'` (27) — never `'match'`. `MatchesScreen.tsx` filters `.eq('event_type', 'match')` so it returns zero rows. (HomeScreen's "Previous Fixtures" works because it correctly uses `.in('event_type', ['match','friendly','fixture',...])`.)
2. **Scores still pending.** `team_match_events` has 0 rows after sync, and the "External match_events columns" log line never fired. So either the external `match_events` table returned empty for this user, or the goal-derivation block silently returned early. Either way HomeScreen has nothing to render.
3. The score-derivation logic in the edge function also has a bug: the `Map<localEventId, counts>` is keyed by the **event UUID**, but the verbose log + an empty `team_match_events` table means we can't yet confirm whether external `match_events` exposes a `team_side` / `is_home` flag at all. Worst case, every goal hits the `else` branch and silently never increments.

### Fix

**A. Matches screen — show real fixtures (one-line fix)**
- `src/pages/ios/MatchesScreen.tsx`: replace `.eq('event_type', 'match')` with `.in('event_type', ['match','fixture','friendly','Match','Fixture','Friendly'])`.
- Update the header subtitle from `{matches.length} match{...}es` → `{matches.length} fixture{...}s` so it reads correctly when "friendly" rows appear.
- No other render changes needed — the existing template already uses `is_home` + `opponent` + `activeTeam.name` properly.

**B. Score derivation — make it observable + robust**
- `supabase/functions/sync-external-events/index.ts`:
  - Log row counts at each step: `console.log(...externalEvents.length, externalMatchEvents?.length, eventMap.size)`. So next sync we can immediately see which side is empty.
  - When `me.team_side` / `me.team` / `me.is_home` are all missing, fall back to the `team_events.is_home` flag of the parent event: i.e. if `event.is_home === true` and the goal belongs to "us", it's a `home` goal. Build a `eventIsHomeMap` (event_id → is_home) up front and use `me.is_our_team` / `me.is_opposition` style aliases when present (`me.is_our_team`, `me.our_team`, `me.team === 'us'`).
  - Also consider score columns directly on the external `events` row (already attempted: `home_score`, `our_score`, `team_score` etc.) — keep, but also try `score_home`, `score_away`, `goals_for`, `goals_against`.
- This makes the derived score work for any reasonable Origin Sports schema; if it still fails, the new logs will tell us exactly which column name to add.

**C. After deploy**
Trigger the Sync from Profile once more. Expected result:
- Matches screen lists 51 rows with opponent names + Home/Away labels.
- HomeScreen "Previous Fixtures" shows real scores for any fixture that has goal events on Origin Sports; remaining rows correctly show "Result pending".

### Files
**Edit**
- `src/pages/ios/MatchesScreen.tsx` — broaden `event_type` filter, tweak count label.
- `supabase/functions/sync-external-events/index.ts` — verbose count logs, more score-column aliases, fall back to parent-event `is_home` when goal `team_side` is missing, build `eventIsHomeMap`.

### Out of scope
- Backfilling `matches` rows for every fixture (still lazy-create on Match Day Setup tap).
- Goal scorers / cards UI on the fixture detail page.
- `team_event_player_stats` table (still missing — separate pass).

