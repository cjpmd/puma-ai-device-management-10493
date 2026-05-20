# Fix: Academy not reflected + Ultra tab ignores picker

## Root causes

**1. Academy from `user_academies` never surfaces in the picker.**
`src/hooks/useActiveContext.ts` line 77 selects:
```
academies!inner(id, club_id, clubs!inner(id, name))
```
The `academies` table has **no `club_id` column** — the relationship goes the other way (`clubs.academy_id`). So `acad.club_id` is always undefined and line 98 (`if (!acad?.club_id) continue`) skips every row. The synced Dundee FC Academy membership therefore never produces an academy context from `user_academies`; it only appears via the 1b club-derived fallback, which means any academy-only metadata (e.g. true membership role, academies that aren't linked to a club the user has direct access to) is lost.

**2. Ultra tab ignores the global context picker.**
`src/pages/ios/UltraScreen.tsx` uses the legacy `useActiveTeam()` hook instead of `useActiveContext()`, so switching to Dundee FC / Dundee FC Academy on Home doesn't change anything on Ultra. Its data queries (`devices`, `biometric_readings`) are also unscoped — they fetch globally regardless of which team/club is selected.

## Changes

### A. `src/hooks/useActiveContext.ts`
- Change the `user_academies` query to fetch the academy directly and resolve the owning club via `clubs.academy_id` (reverse lookup), since there is no `academies.club_id` column:
  ```ts
  sb.from('user_academies')
    .select('academy_id, role, academies!inner(id, name)')
    .eq('user_id', user.id)
  ```
  Then in a single follow-up query, fetch `clubs` where `academy_id` is in the returned academy ids (`id, name, academy_id`), and build a map `academyId -> { clubId, clubName, academyName }`.
- Build academy contexts from that map. Use `academies.name` as the label (fallback to `${clubName} Academy`). `clubId` comes from the matched club row; skip the academy if no club is linked (rare — we still need a clubId for downstream scoping).
- Keep the 1b club-derived fallback as-is (it correctly adds academy contexts for clubs whose `academy_id` is set but the user has no `user_academies` row). De-dupe against academies already added in step 1.

### B. `src/pages/ios/UltraScreen.tsx`
- Replace `useActiveTeam` with `useActiveContext` from `@/contexts/ActiveContextContext`.
- Header subtitle: use `activeContext?.label` (with the same `· N wearables` suffix).
- Scope the data fetches to the active context:
  - `kind === 'team'`: filter `devices.assigned_player_id` and `biometric_readings.player_id` by players where `team_id = activeContext.id`.
  - `kind === 'club'` or `'academy'`: gather all teams for `activeContext.clubId`, then filter by players whose `team_id IN (teamIds)` OR `club_id = activeContext.clubId`. Mirrors the pattern already used in `SquadScreen` / `HomeScreen`.
- Re-run the effect when `activeContext?.kind / id / clubId` changes.

## Out of scope
- No DB migrations; existing data + RLS are sufficient.
- No edge-function changes (academy sync already populates `user_academies` and `clubs.academy_id`).
- No changes to other screens.
