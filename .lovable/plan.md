# Fix Club/Academy linking, Profile grouping, and Home picker behaviour

## Diagnosis

DB snapshot for chrisjpmcdonald@gmail.com shows the root causes:

- All 3 clubs (Broughty United, Dundee East Girls, Dundee FC) have `academy_id = NULL`.
- One academy exists locally (`Dundee FC Academy`, external_id `fb3464f0…`) but isn't linked to any club row, so `useActiveContext` can't associate it with Dundee FC.
- Sync output `Clubs linked: 0` comes from `sync-external-academy` reading FC's `academy_clubs` table — that table is empty (or has no matching pairs) in Origin Sports, so no `clubs.academy_id` ever gets set.
- Home picker correctly sets `activeContext` to a club/academy, but `HomeScreen` reads `useActiveTeam()` which silently falls back to `teams[0]` (Dundee East Girls U16s) whenever the context is not a team. That's why picking Dundee FC visually "jumps" to a different team.
- Academy detail pages query by `activeContext.id` (the academy id) joined to clubs by `clubs.academy_id`, which is always NULL → no data.

## Fixes

### 1. Link clubs to academies during academy sync (`supabase/functions/sync-external-academy/index.ts`)

After upserting academies, instead of relying on FC's possibly-empty `academy_clubs` table, also try to derive the link from Origin Sports' canonical relation:

- Re-fetch FC `academies` selecting `id, club_id` (if FC schema has it) and also try FC `clubs` selecting `id, academy_id`.
- For each pairing found in **either** direction, look up the local academy by `external_id` and local club by `external_id`, then `UPDATE clubs SET academy_id = <local academy id> WHERE id = <local club id>`.
- Keep the existing `academy_clubs` join-table path as a third fallback so we don't regress for FC tenants that use it.
- Count every successful link in `results.clubs_linked`; log skips with reason.

This is the single backend change. No schema migration is needed — `clubs.academy_id` already exists.

### 2. Group "My Teams" by Club → Academy → Team (`src/pages/ios/ProfileScreen.tsx`)

Replace the flat `teams` list with a tree built from `useActiveContext().availableContexts`:

```text
┌─ Club: Dundee FC                          [chevron / active]
│   ├─ Academy: Dundee FC Academy
│   │     ├─ (teams under that academy — none yet)
│   └─ Teams directly under club
│         └─ …
├─ Club: Broughty United
│   ├─ Broughty United Panthers 2015s
│   ├─ Broughty United Pumas 2015s
│   └─ Broughty United Jags 2015s
└─ Club: Dundee East Girls
    └─ Dundee East Girls U16s
```

- Reuse the same grouping logic already in `HierarchicalContextPicker` (extract to `src/lib/groupContexts.ts` so both files share it).
- Tapping any node calls `setActiveContext(ctx)` for that node's kind/id. Active row gets the existing purple ACTIVE pill.
- Section header stays "My Teams" but subtitle becomes "Grouped by club".

### 3. Make Home reflect the picked context — stop forcing team fallback

The bug "selecting Dundee FC takes me to Dundee East Girls" is in `HomeScreen.tsx` reading `useActiveTeam()` which returns `teams[0]` when context is not a team.

- `HomeScreen.tsx`: read `activeContext` directly. Derive `teamId` only when `activeContext.kind === 'team'`. When kind is `club` or `academy`:
   - Header label = `activeContext.label` (Club name, or "{Club} Academy").
   - "Next event" query: aggregate across all teams in that club (`team_events` filtered by `team_id in (select id from teams where club_id = activeContext.clubId)`), limit 1.
   - "Squad" card: aggregate counts across `players` with `club_id = activeContext.clubId` (column already exists per `user_can_access_player`).
   - "Previous fixtures": same aggregation as next event but `lt('date', today)`.
   - Show a small "Club view" / "Academy view" caption under the header so users know they're not in a single-team view.
- `useActiveTeam.ts` keeps its current behaviour for the small number of remaining team-only screens (Squad, Formation), but HomeScreen no longer uses it.

### 4. Academy pages — fix data fetch once clubs.academy_id is populated

Most academy pages already filter by `clubs.academy_id = activeContext.id`. Once fix #1 backfills that column, the existing queries will return rows. Verification step in the testing section below.

For users who haven't re-run Sync Academy after fix #1 ships, also add a one-time client-side reconciliation in `useActiveContext.ts`:
- After loading contexts, if any `academy` context has a `clubId` but `clubs.academy_id` is NULL for that club, kick off a single background `UPDATE clubs SET academy_id=… WHERE id=… AND academy_id IS NULL`. RLS allows club admins to update their club row (existing policy). This is a safety net only.

## Out of scope

- Modelling a direct `teams.academy_id` link — today academies inherit teams from their club. We surface every team in the club under the academy node for now.
- Web sidebar `ContextSwitcher` — already grouped; unchanged.

## Verification

After the user re-runs Sync Academy:

1. `select id, name, academy_id from clubs` returns a non-null `academy_id` for Dundee FC (matching the `Dundee FC Academy` row).
2. Profile → My Teams shows three club groups with their teams nested; Dundee FC group shows "Dundee FC Academy" as a child.
3. Home picker → tap **Dundee FC** (club): header shows "Dundee FC" with "Club view" caption; "Next event" and "Squad" aggregate across all 3 Dundee FC academy teams; no jump to Dundee East Girls U16s.
4. Home picker → tap **Dundee FC Academy**: header shows the academy label with "Academy view" caption.
5. Navigate to `/dashboard` while in Academy context — academy-tier pages render data instead of empty states.
