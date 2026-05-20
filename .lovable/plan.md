## Goal

Replace the iOS Home picker (currently a flat list of teams) with a hierarchical **Club → Academy → Team** drill-down, so users can navigate from the clubs they're linked to, into academies within those clubs, and finally into a specific team.

## Current behaviour

- `HomeScreen` calls `useActiveTeam()` → `useUserTeams()`, which reads only `user_team_access`. The "▾" picker therefore lists teams only.
- The web `ContextSwitcher` already exposes Clubs + Academies + Teams via `useActiveContext()`, but iOS does not use it for the picker.

## Plan

### 1. New iOS picker component — `src/components/ios/HierarchicalContextPicker.tsx`
A modal/sheet built from `useActiveContext()` (already returns all three kinds with `clubId`).

Three steps, each with a back arrow:
1. **Clubs** — distinct `clubId`s derived from `availableContexts` (label = club name).
2. **Academies + Teams in that club** — academies (kind=`academy`, matching `clubId`) listed first, then teams (kind=`team`, matching `clubId`). If the club has only one team and no academy, skip to step 3.
3. **Teams in that academy** — only shown when an academy was picked; teams under the academy's club (we don't yet model team↔academy, so list all teams in the club).

Selecting a Team calls `setActiveContext(teamCtx)` → also flows into `useActiveTeam` via the existing adapter, so HomeScreen keeps working unchanged.
Selecting a Club or Academy at a leaf level (e.g. club with no teams) sets that context but HomeScreen still needs a team to render fixtures — show an empty state ("Pick a team to see fixtures") until a team is chosen.

### 2. Derive Club list
Build from `availableContexts`:
```text
clubs = unique by clubId, label from kind='club' row OR from team.clubId fallback
academiesByClub[clubId] = contexts where kind='academy' && clubId matches
teamsByClub[clubId] = contexts where kind='team' && clubId matches
```
No new DB query needed — `useActiveContext` already joins `clubs` and `academies`.

### 3. Wire into `HomeScreen`
- Replace the existing `showTeamPicker` sheet with the new `HierarchicalContextPicker`.
- Trigger button label: current `activeTeam?.name` (unchanged), but always show the ▾ chevron when the user has more than one **club**, academy, or team (not just >1 team).
- Header sub-line: small breadcrumb "Club · Academy" when applicable, so the user knows where the active team sits.

### 4. No backend changes
RLS, tables and sync untouched. Purely a frontend picker change driven by the data `useActiveContext` already loads.

## Out of scope
- Modelling team↔academy explicitly (today teams only link to clubs). When that link is added later, step 3 can filter by `team.academy_id`.
- Changing what HomeScreen displays for a Club/Academy context (still requires a Team for fixtures/squad).
- Web sidebar `ContextSwitcher` — unchanged.

## Verification
- iOS Home: tap team name → see list of Clubs you're linked to → tap a club → see its Academies + Teams → tap a team → home re-renders with that team's data.
- User with one club & one team: picker either hides or auto-skips to that team (no regression vs today).
- Active selection persists across reload (uses existing `active-ctx-v1-{userId}` localStorage).