

## Plan — Home screen upgrades

### 1. Team switcher on Home
Replace the static "today" header with a tappable team chip (Glass pill showing active team name + chevron). Tap opens a bottom-sheet style Glass dropdown listing all teams from `useActiveTeam`. Selecting one calls `setActiveTeam(id)`. If only one team, render as a non-interactive label.

### 2. Top-right avatar → Profile
Wrap the Avatar in `HomeScreen` in a click handler that calls `onTabChange?.(4)`.

### 3. Squad summary card (new section under hero)
New Glass card titled "Squad" showing:
- **Total** (count of players for active team)
- **Available** (count where `availability = 'green'`)
- **Injured** (count where `availability IN ('red','amber')`)
- Below, a compact list of injured players: avatar initials + name + `availability` badge (Amber/Red) + expected return date if present (e.g. "Back ~12 May")
- Tap card → jumps to Squad tab (`onTabChange(1)`)

Data: single query `players.select('id,name,availability,expected_return_date').eq('team_id', activeTeam.id)`.

### 4. Schema: add `expected_return_date`
`players` table has no return-date column. Add nullable `date` column `expected_return_date`. Extend `sync-external-data` to pull it from Origin Sports if their `players` row exposes it (optional — null-safe). RLS unchanged.

### 5. Previous Fixtures section (replaces "Team Form" sparkline)
Show the last 5 fixtures (matches + friendlies) for the active team:
- Pull from `team_events` where `date < today` AND `event_type IN ('match','friendly','fixture')` AND `team_id = activeTeam.id`, ordered desc.
- Join (or fallback lookup) to `matches` via `match_id` to get `home_score`/`away_score` when known.
- Each row = Glass row: date · opponent · venue (H/A) · score badge (e.g. `2–1 W`) or "—" if no result.
- Win = purple, Draw = neutral grey, Loss = red badge background.

Replace the existing "Team Form" card; keep the activity rings card untouched.

### Files to edit / create
- `src/pages/ios/HomeScreen.tsx` — team switcher, avatar→profile, squad summary, previous fixtures
- New migration: `ALTER TABLE players ADD COLUMN expected_return_date date`
- `supabase/functions/sync-external-data/index.ts` — include `expected_return_date` in player upsert mapping (null-safe)

### Out of scope
- Editing return dates from inside this app (read-only sync from Origin Sports)
- Friendly-vs-league filtering toggle (just show all past fixtures)

