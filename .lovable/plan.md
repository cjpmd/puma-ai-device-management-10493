

## Plan — fixtures, injured filter, Ultra cards

### 1. Past fixtures: pull scores from Origin Sports
**Diagnosis:** team_events rows exist (12+ past matches for the active team), but every `matches.home_score` / `matches.away_score` is `NULL`, and most events have `match_id = NULL`. So the Home screen renders "—" instead of "1‑0 W".

**Fix:**
- **`sync-external-events`** — extend the events sync to:
  - Read `home_score` / `away_score` (and any `result` / `our_score` / `opponent_score` aliases) from the external Origin Sports `events` / `matches` tables.
  - For past events with scores, upsert a `matches` row (or update the linked one) with `home_score`, `away_score`, `kickoff_at`, then set `team_events.match_id` to that row.
  - Also write the scores directly onto a new lightweight pair of columns on `team_events` (`home_score int, away_score int`) so we don't need a join — simpler and faster on the Home screen.
- **Migration** — add nullable `home_score`, `away_score` to `team_events`.
- **HomeScreen** — read scores directly from `team_events` (drop the `matches` join). If still null → show "Result pending" pill instead of "—".
- **Display** — when result exists, render it like the Origin Sports screenshot: small score `1-0` then a tiny coloured `W`/`D`/`L` chip on the right (currently we cram them together).

### 2. Injured filter on Squad screen — show real injured players
**Diagnosis:** real data is correct (Luca Stott / Fergus Cooper = `amber`, Rory Beattie = `red`). The Home count is right. The Squad Injured tab is empty because its filter looks for the strings `'injured'` / `'unavailable'`, never `red` / `amber`.

**Fix (one-line in `SquadScreen.tsx`):**
- Change the Injured filter to: `['red','amber','injured','unavailable'].includes(...)`.
- Change the Available filter to match by `green` or empty/`available`.
- Show a small coloured pill (`AMBER` / `RED`) next to each player row in Injured view, mirroring the Home screen style.

### 3. Ultra Analysis — Overall Session cards rendering as white blocks
**Diagnosis:** `MetricCard` and `PerformanceChart` hardcode `bg-white shadow-lg`, so they punch white panels through the aurora wallpaper.

**Fix:**
- **`MetricCard.tsx`** — replace `bg-white shadow-lg` with `glass border border-white/10 text-white`, muted text → `text-white/60`.
- **`PerformanceChart.tsx`** — same glass treatment + recharts grid stroke `rgba(255,255,255,0.08)`, axis tick fill `rgba(255,255,255,0.55)`, tooltip dark.
- **`Tabs` list** — switch to `bg-white/5 border border-white/10`; active trigger `bg-white/15 text-white`.
- **`PlayerMovementMap`** wrapper — wrap in same glass card.

These components are also used elsewhere; the new glass styling is theme-agnostic (works on light pages too because translucent), so no regressions expected, but I'll spot-check Index/MLTraining when wired.

### Files
**Edit**
- `src/pages/ios/HomeScreen.tsx` — read scores from `team_events`, restyle result chip
- `src/pages/ios/SquadScreen.tsx` — fix Available/Injured filters, add availability pill
- `src/pages/Analysis.tsx` — Tabs list dark styling
- `src/components/MetricCard.tsx` — glass dark variant
- `src/components/PerformanceChart.tsx` — glass dark variant + recharts theming
- `supabase/functions/sync-external-events/index.ts` — pull `home_score`, `away_score`, write to `team_events` (and `matches` if a row exists)

**New**
- Migration: `ALTER TABLE team_events ADD COLUMN home_score int, ADD COLUMN away_score int;`

### Out of scope
- Backfilling historic match-result reasoning (red cards, scorers) — only score + outcome for now
- Recolouring MLTraining / Devices cards to glass (separate pass)

