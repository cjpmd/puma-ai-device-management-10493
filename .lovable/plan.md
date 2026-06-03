## Auto-populate roster from Origin Sports squad

Today the Roster panel is a manual entry form. Because the project already syncs the full squad (with `squad_number` + `name`) from Origin Sports into `public.players`, and `matches` knows which team is ours (`team_id` + `is_home`), we can pre-fill the roster automatically.

### Behaviour

1. When the Roster panel opens (or on demand via a button), look up `players` where `team_id = matches.team_id` and `squad_number IS NOT NULL`.
2. Map those into `match_rosters` for the side that corresponds to `matches.is_home` (true → `home`, false → `away`), storing `player_id`, `jersey_number`, and `player_name`.
3. Skip rows that would collide with an existing `(match_id, side, jersey_number)` entry, so re-importing is safe and never wipes manual edits.
4. The opposing side stays manual (we don't have their squad in our DB) — unchanged UX.

### UI changes (RosterPanel)

- Add an **"Import from squad"** button on our side's column header. Disabled with tooltip if `matches.team_id` is null or the squad has no players with `squad_number`.
- Auto-run the import once on first open if the roster for our side is empty (with a tiny toast: "Imported N players from squad"). User can still add/remove rows manually afterwards.
- Show a small "from squad" badge on rows that came from the import (rows with `player_id` set).

### Data / schema

- No new table needed. `match_rosters` already has `player_id` — we just start populating it.
- One small migration: add `UNIQUE (match_id, side, jersey_number)` to `match_rosters` so the upsert is conflict-safe and to prevent accidental duplicates. (If duplicates already exist they'll need to be cleaned first; I'll guard the migration with a dedupe step.)

### Downstream

- `process-video` already passes the roster numbers to the GPU OCR; no change needed there.
- Cinema panels that show `#JERSEY · Name` will start displaying real player names for our side instead of "unnamed", because `player_name` now comes from `players.name`.

### Out of scope

- Importing opposition rosters (not in our DB).
- Linking detected tracks to specific `player_id`s automatically — still requires confirmed jersey OCR, which is the next phase.
- Editing the synced squad itself from inside the match view.

### Files to touch

- `src/components/Matches/Cinema/RosterPanel.tsx` — add import button + auto-import-on-empty, accept `teamId` / `isHome` props, render "from squad" badge.
- `src/components/Matches/Cinema/MatchCinemaLayout.tsx` — pass `team_id` and `is_home` from the loaded match into `RosterPanel`.
- New migration: `ALTER TABLE public.match_rosters ADD CONSTRAINT match_rosters_match_side_num_uniq UNIQUE (match_id, side, jersey_number);` (after a dedupe pass).
