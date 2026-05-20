## Goals

1. Staff list shows name + email + role (and profile reference)
2. Attribute Framework pulls the canonical attribute list from Origin Sports
3. "Origin Sports FC" topbar link points to the actual club website (configurable in Academy Profile)
4. Add a way to navigate back to the Origin Sports Performance home (`/`) from the topbar
5. Add a "Academy Dashboard" entry point on the Home page
6. Tighten data scoping (only show players for selected team/club) and fix design issues (light text on light backgrounds)

---

## 1. Staff tab (`src/pages/Settings.tsx`)

`get-academy-staff` already returns `full_name` + `email`. Update the rendered row so name is always primary, email is always shown beneath it, and role + a "View profile" link sit on the right.

```text
[ Avatar ]  Jane Smith                              [ coach ]  View profile
            jane@club.com
```

- Avatar: initials in a violet circle (same style as TopBar)
- "View profile" links to a placeholder route `/staff/:user_id` (or opens a slide-over). If a profile page does not exist yet, link to `mailto:` as a fallback and add a TODO.
- Sort: head_coach → coach → physio → analyst → others.

## 2. Attribute Framework — pull from Origin Sports

Today `attribute_definition` is locally editable but starts empty. Origin Sports stores per-player attributes as `{name, value, enabled}` on `players.attributes`. We will:

- Extend `supabase/functions/sync-external-core/index.ts` so that while iterating FC players it also collects every unique `(category, name)` pair and upserts them into `public.attribute_definition` (key on `name`).
  - Category is inferred from the FC attribute object if present, otherwise defaulted to `technical`.
  - `max_value` defaults to 20 (matches FC scale).
  - Existing locally-added rows are preserved; the sync only inserts missing names.
- On the Attributes tab, show a "Synced from Origin Sports" badge next to rows that came from FC (track via a new `source TEXT` column on `attribute_definition`, default `'local'`; sync sets `'origin_sports'`).
- Keep the local add/toggle UI for academy-specific extensions.

Migration:
```sql
ALTER TABLE public.attribute_definition
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local';
```

## 3. Club website + topbar "Origin Sports FC" link

The topbar currently links to `app.originsports.co.uk` (a dummy). Replace with a per-academy "Club website" URL.

- **Migration:** add `club_website_url TEXT` to `public.academies`.
- **Settings → Academy Profile:** new "Club website" input under Basic Information; saves to `academies.club_website_url`.
- **TopBar:** read the active academy's `club_website_url` (via `useActiveContext` + a small query in `AppShell`) and pass to `TopBar` as `fcUrl`. Fallback hidden if not set.
- Rename the link label to "Club website" to reflect what it is.

## 4. Topbar Home button

Add a "Home" link on the left side of `TopBar` (before the org name) that navigates to `/` (the Origin Sports Performance landing page). House icon + label, same violet hover treatment as the existing FC link.

## 5. Home page Academy entry point (`src/pages/Index.tsx`)

Add a fourth card alongside Match Day / ML Training / Performance Analysis:

- **Academy** card → links to `/dashboard`
- Same `glass` styling, uses a school/shield icon
- Card grid becomes `md:grid-cols-2 lg:grid-cols-4`

## 6. Data scoping + design pass

These touch multiple pages; group as a sweep but only fix the broken ones.

**Scoping audit (must filter by `activeContext.clubId` or `teamId`):**
- `Players.tsx`, `Squads.tsx`, `Welfare.tsx`, `Medical.tsx`, `FitnessTesting.tsx`, `Development.tsx`, `Scouting.tsx`, `Coaching.tsx`, `Compliance.tsx`
- For each, find the players/list query and add `.eq('club_id', clubId)` (or `team_id` when context is a team). If a page lists records keyed by `player_id`, scope via an `players!inner(club_id)` join (same pattern Dashboard uses).
- Empty state when no context is selected: "Select a club or team to view data."

**Design pass (light text on light backgrounds):**
- Replace `text-slate-900/30` and `text-white/…` usages that appear on white cards with `text-slate-400` / `text-slate-500`.
- Replace ad-hoc backgrounds with the design tokens already used in `Dashboard.tsx` (`bg-white border border-slate-200 rounded-2xl`).
- Targets identified in current files: `Settings.tsx` (Attributes tab uses `text-slate-900/30` and `text-white/…`), any page still using `wallpaper-dawn` with `text-white` outside the Home/Auth pages.

A grep pass for `text-white` + `text-slate-900/` will be used to find every offender.

---

## Technical notes

- One migration handles both schema changes:
  ```sql
  ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS club_website_url TEXT;
  ALTER TABLE public.attribute_definition ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local';
  ```
- `sync-external-core` change is additive — does not affect existing player/attribute upserts.
- `AppShell.tsx` will need to read the active academy row to provide `fcUrl` and academy name to `TopBar`.
- Staff "View profile" route is a stub; we'll add a minimal `/staff/:id` page that shows name/email/role and the academies they belong to (read via `get-academy-staff` extended to single-user, or a new `get-staff-profile` function).

## Out of scope

- Auth Admin invite workflow (still alerts a placeholder)
- Real alert feed data on Dashboard
- Full design system rewrite — only fixing legibility regressions where light text sits on light backgrounds
