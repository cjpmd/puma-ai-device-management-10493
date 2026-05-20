# Fix Sync Academy + restore the missing nav links

Two root causes, one shared fix: the recent changes added an academy-tier system that depends on database tables and an edge function that were never deployed/created.

## 1. "Academy sync failed: Failed to send a request to the Edge Function"

The `sync-external-academy` edge function existed in the codebase but **was never deployed**, so the browser's `supabase.functions.invoke('sync-external-academy')` call failed at the network layer (no function at that URL → CORS-less 404 → "Failed to send a request").

I've just deployed it. But running it now would still 500, because the function writes to local tables that don't exist:

- `academies` (with `external_id`, `name`, `logo_url`, `fa_registration_number`, `eppp_category`, `founded_year`, `synced_at`, `head_of_academy_user_id`)
- `profiles` (with `id`, `email`, …)
- `user_academies` (FC mirror, used to match head-of-academy)
- `clubs.academy_id` column (referenced by step 3 of the sync)

## 2. "No links in nav bar"

The AppShell sidebar filters items by `orgType`, which is derived from `activeContext.kind`. The active-context hook fetches from `profiles`, `user_academies`, `user_club_access`, `user_team_access`. With `profiles` and `user_academies` missing, the hook returns no contexts → `orgType` defaults to `'team'` → only the few team-tier items would show; combined with the 404s halting the load, the sidebar can end up empty.

Once we (a) create the missing tables and (b) let the hook synthesise an academy context for any user that already has `user_club_access`, the sidebar populates correctly without needing the user to run Sync Academy first.

## Fix — single migration + tiny hook tweak

### Migration

**`profiles`**
- `id` UUID PK (= `auth.users.id`)
- `email` TEXT, `full_name` TEXT
- `user_group_tier` TEXT default `'amateur_professional'` (check constraint)
- safeguarding columns referenced by Compliance: `fa_safeguarding_expiry`, `dbs_expiry`, `first_aid_expiry` (DATE), `uefa_licence` TEXT
- Trigger on `auth.users` insert → seed `profiles` row with `id` and `email`
- Backfill profile rows for any existing auth user
- RLS: each user reads/updates their own row

**`academies`**
- `id` UUID PK, `external_id` UUID UNIQUE, `name` TEXT
- `logo_url`, `fa_registration_number`, `eppp_category`, `founded_year`, `head_of_academy_user_id` (FK → profiles), `synced_at`
- RLS: readable by users with access to a club linked to the academy (`user_has_club_access(auth.uid(), c.id)` via `clubs.academy_id`)

**`user_academies`**
- `id` UUID PK, `user_id` UUID → profiles, `academy_id` UUID → academies, `role` TEXT
- UNIQUE (user_id, academy_id), FK from `user_academies.user_id → profiles.id` so Compliance's PostgREST embed `profiles:user_id(...)` resolves
- RLS: user reads own rows; users with club access to the academy's club read all rows

**`clubs.academy_id`** — add the nullable FK column the sync expects

Plus a `user_has_academy_access(_user_id, _academy_id)` `SECURITY DEFINER` helper that mirrors the existing `user_has_club_access` / `user_has_team_access` pattern.

### Code

`src/hooks/useActiveContext.ts` — if `user_academies` is empty, synthesise an academy context from each `user_club_access` row using `clubs.academy_id` (when populated) or fall back to the club itself. This makes the academy-tier nav items appear immediately for any club admin, even before they hit Sync Academy.

No frontend redesign — just unblocking what's already there.

## Verification

1. Reload `/dashboard` → sidebar shows the full nav (Dashboard, Players, Squads, Development, Medical, Fitness, Welfare, Scouting, Coaching, Video, Compliance, Travel, Settings).
2. iOS Profile → tap **Sync Academy** → toast shows "Academy synced · Academies: N · Clubs linked: N" instead of "Failed to send a request".
3. Console: no more 404s for `profiles` / `user_academies`.
