
## Root cause of each issue

Querying the database confirms what's actually there:

- **Academies table**: only `Dundee FC Academy` exists.
- **Clubs**: `Dundee FC`, `Broughty United`, `Dundee East Girls` — **all three have `academy_id = NULL`**.
- **user_academies** for chrisjpmcdonald: **empty**.
- **user_club_access**: all three clubs.

So today:

1. The picker shows "Broughty United Academy" / "Dundee East Girls Academy" / "Dundee FC Academy" because `useActiveContext` *synthesises* a fake academy for every club that has no `academy_id`. Two of those academies don't exist, and the third is not the real one — it's a fake whose `id = Dundee FC club id`.
2. Picking that fake "Dundee FC Academy" sets `clubId = Dundee FC`. HomeScreen's Academy nav block is gated on `activeContext.kind === 'academy'` so it does render — but Squad/players queries scoped to Dundee FC return nothing useful, and `/squads` ignores the context entirely (see #3), so the user lands on whatever team `useActiveTeam` last selected (Dundee East Girls U16s).
3. `sync-external-academy` only links a club to an academy when FC exposes `academy_clubs` / `academies.club_id` / `clubs.academy_id`. None of those are populated for Dundee FC in FC, so the local link never happens and `user_academies` stays empty.

## Fix

### 1. `src/hooks/useActiveContext.ts` — stop fabricating academies
- Remove the "1b. Synthesise academy contexts from club access" block entirely.
- Replace it with: for each club the user has access to, **if `clubs.academy_id` points to a real academy row**, add an academy context for that real academy (id = academy.id, clubId = club.id, label = `${club.name} Academy`). De-dupe against `user_academies` entries.
- Net effect: clubs with no linked academy show **no** academy in the picker. The real Dundee FC Academy appears as soon as the club→academy link exists in the DB.

### 2. `supabase/functions/sync-external-academy/index.ts` — link by name + auto-grant
After the existing FC join-table / column lookups, add two fallbacks:

- **Name-match fallback for `clubs.academy_id`**: for every local academy that is still not referenced by any local club, find a local club whose name (case-insensitive, trimmed) is a prefix/contained-in match of the academy name (`"Dundee FC Academy"` ↔ `"Dundee FC"`), and set `clubs.academy_id = academy.id`. Count those into `results.clubs_linked`.
- **Auto-populate `user_academies` from club access**: for every `(user_id, club_id)` in `user_club_access` where `clubs.academy_id IS NOT NULL`, upsert `user_academies(user_id, academy_id, role='member')` (no-op if it already exists). Report a new `results.user_academies.auto_granted` count.

This way Dundee FC → Dundee FC Academy gets linked on next Sync Academy, and chrisjpmcdonald automatically gets a real `user_academies` row.

### 3. `src/pages/ios/SquadScreen.tsx` — respect `activeContext`
Currently `SquadScreen` only reads `useActiveTeam`, so context changes from the picker are ignored. Change the players query to use `useActiveContext`:

- `kind === 'team'`  → `players.team_id = activeContext.id` (current behaviour).
- `kind === 'club'` or `'academy'` → fetch all `teams` for `activeContext.clubId`, then `players.in('team_id', teamIds)` UNION `players.eq('club_id', activeContext.clubId)`. Mirrors the pattern already used in `HomeScreen.tsx`.
- No UI restructure — same list, same filter chips.

### Out of scope
- ProfileScreen "My Teams" already renders via `groupContextsByClub(availableContexts)`, so fixing #1 automatically removes the bogus academies from Profile too. No changes needed there.
- HierarchicalContextPicker is unchanged for the same reason.
- No schema migrations — the fix is in the edge function and client logic.

## Verification after implementation
1. Tap **Sync Academy** in Profile. Toast should report `Academies: 1 · Clubs linked: 1` and (with the new field) `auto_granted: 1`.
2. Profile → My Teams: Dundee FC card shows **only** `Dundee FC Academy` under it; Broughty United and Dundee East Girls show no academy children.
3. Home picker → Dundee FC → pick "Dundee FC Academy" → header reads `Dundee FC Academy`, Academy nav grid is visible, tapping **Squads** opens `/squads` and lists players from all Dundee FC teams (currently 0, which is correct).
