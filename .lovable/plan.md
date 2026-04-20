

## Plan — Origin Sports integration + iOS shell upgrade

### Important caveat on "Single sign-on (shared Supabase)"
Origin Sports lives in a **different Supabase project** (`pdarngodvrzehnpvdrii`) than this app (`zibxzgrjjfdwcxgmptjb`). Truly sharing auth means pointing this whole app at the Origin Sports backend, which would **detach every existing match, device, sensor recording, and processing job** in this project (they're all keyed to the current `auth.users`) and would force RLS rewrites on ~20 tables. Big-bang risky.

I recommend a pragmatic equivalent that gives you the **same UX as SSO** without the migration hit:

> **Email-linked SSO**: keep this app's auth, but on every sign-in we look up the user's Origin Sports profile by email and cache `external_user_id` + their `user_teams` / `user_clubs` rows locally. Result: log in here, and the home/squad/matches tabs immediately show only the Origin Sports teams you're a member of, with the same role.

I'll proceed with that. If you want true SSO later, we can do the cutover separately.

---

### What gets built

**1. Schema (migrations)**
- `user_team_access` (user_id, team_id, role, external_user_id, synced_at) — local cache of who can see what
- `user_club_access` (same shape for clubs)
- Extend `sync-external-data` edge function with a new `entity = 'user_access'` path that, given the signed-in user's email, fetches their `user_teams` / `user_clubs` rows from Origin Sports and upserts here
- Add RLS so each user only sees their own rows

**2. Auth flow**
- After sign-in, call `sync-external-data?entity=user_access` once to populate access
- New `useUserTeams()` hook returning the active user's teams + active team selection (persisted in localStorage)

**3. iOS shell — wire to real data, keep design system**
- **HomeScreen**: replace dummy "Origin U15" with selected team name + badge; "Next match" pulls the next `team_events` row for that team; activity rings stay (mock for now); team form uses recent `matches` results
- **SquadScreen**: list `players` filtered by `team_id IN user_team_access`; tapping a player opens a detail screen that pulls `player_physical_data` + recent `biometric_readings` + recent `sensor_recordings` (Ultra/analysis data) — same Glass cards, real numbers
- **MatchesScreen**: list real `matches` + `team_events`; each card gets a **"Match Day Setup"** Glass button → routes to `/matches/:id`; a top **"Open Match Day"** banner → routes to `/matches`
- **TrainingScreen → UltraScreen**: rename tab + icon to "Ultra" (lightning bolt stays). New iOS-native screen with Glass cards summarising the live session (session status, last sprint, top speed, distance, heart rate avg) and a prominent **"Open full Ultra analysis"** Glass button → routes to `/analysis`
- **ProfileScreen**: shows real user, real team list (switcher), wearable count from `devices`, sign-out

**4. Tab bar** — change label "Training" → "Ultra"

**5. Design pass — fix remaining background/contrast issues**
Audit pages for legacy light backgrounds and white cards on dark wallpaper:
- `Analysis.tsx`: header is white on aurora ✓ but inner Tabs/Cards still use light defaults — wrap content in `glass` + override card defaults
- `MLTraining.tsx`, `Devices.tsx`, `MatchDetail.tsx`, `PitchCalibration.tsx`: same issue — tabs / Cards inside still render `bg-card` light. Standardise: page root `wallpaper-*`, all top-level cards use `.glass`, text `text-white` / `text-white/70`
- Toasts (`sonner`, `toaster`): theme tokens currently use light `--popover`. Confirm they render dark — they do because `--popover` is set to `270 40% 8%` already, but verify
- Buttons: replace any remaining `variant="outline"` with explicit `border-white/20 text-white hover:bg-white/10` where they sit on glass

**6. Match Day entry on the iOS Matches tab** (per your "Both" answer)
- Top Glass banner: "Match Day Setup" → `/matches`
- Each match Glass card gets a small chevron-action: "Setup recording" → `/matches/:id`

### Files

**Migrations (new)**
- `user_team_access`, `user_club_access` tables + RLS

**Edge function**
- `supabase/functions/sync-external-data/index.ts` — add `user_access` entity

**New code**
- `src/hooks/useUserTeams.ts`
- `src/hooks/useActiveTeam.ts`
- `src/pages/ios/UltraScreen.tsx`
- `src/pages/ios/PlayerDetailScreen.tsx` (real-data version, replacing in-file mock)

**Edits**
- `src/pages/ios/IOSApp.tsx` — swap Training for Ultra
- `src/pages/ios/HomeScreen.tsx` — real team + next match + form
- `src/pages/ios/SquadScreen.tsx` — real squad from `players`
- `src/pages/ios/MatchesScreen.tsx` — real matches + Match Day buttons
- `src/pages/ios/ProfileScreen.tsx` — real user + team switcher + sign-out
- `src/components/ios/TabBar.tsx` — Training → Ultra label
- `src/pages/Auth.tsx` — trigger `user_access` sync on successful sign-in
- `src/pages/Analysis.tsx`, `MLTraining.tsx`, `Devices.tsx`, `MatchDetail.tsx`, `PitchCalibration.tsx` — apply glass cards on dark wallpaper, fix contrast

### Out of scope (next)
- True shared-auth cutover (only do if you accept losing existing data linkage)
- Live activity rings on Home (need real session data wired up)
- Realtime subscription on user_team_access (one-shot sync on login is enough for now)

