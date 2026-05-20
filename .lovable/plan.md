## Problem

The Settings page reads everything from `academy_settings`, but the Origin Sports (Football Central) sync writes academy data into the `academies` table — never `academy_settings`. On top of that:

- The form binds to field names that don't exist anywhere (`hoa_email`, `academy_tier`, `license_expiry`, `address`, `pdc_target`, `eppp_assessor`, `eppp_next_review`, `min_snapshots`, `min_rpe_sessions`, `acwr_amber`, `acwr_red`). These can't load and can't save.
- The Staff tab renders truncated user UUIDs (`a1b2c3d4e5f6…`) because it never joins `profiles` for name/email.
- EPPP Config reads `eppp_category` from `academy_settings` (empty) instead of `academies` (populated by sync).
- Head of Academy email is never resolved — sync stores `head_of_academy_user_id` on `academies`, but the form looks for a non-existent `hoa_email` column.

## Fix

### 1. Academy Profile tab — read from `academies` + `academy_settings`, write back to both
- Pull base fields from `academies`: `name`, `fa_registration_number`, `eppp_category`, `founded_year`, `logo_url`, plus `head_of_academy_user_id`.
- Resolve Head of Academy to a profile (`profiles.full_name`, `profiles.email`) via the stored `head_of_academy_user_id` and render the email read-only (it comes from the synced admin account).
- Editable extras (`address`, `license_expiry`, `academy_tier`) → store under `academy_settings.prefs` JSONB so we don't need new columns.
- Save handler updates `academies` for synced fields (name, fa_registration_number, eppp_category, founded_year) and upserts `academy_settings` with `prefs` for the rest.

### 2. EPPP Config tab — same source-of-truth split
- Read `eppp_category` and `eppp_tier` from `academy_settings` if set, otherwise fall back to `academies.eppp_category`.
- Store assessor, next-review date, PDC target, and KPI thresholds under `academy_settings.prefs`.
- Save handler writes `eppp_category`/`eppp_tier` to `academy_settings` (and mirrors `eppp_category` to `academies` so other surfaces stay consistent).

### 3. Staff tab — join profiles
- Fetch `user_academies` rows for the academy, then a second query against `profiles` for the matched `user_id`s, and render `full_name` + `email` instead of truncated UUIDs.
- Fall back to "(no profile)" + UUID tail only when no profile row exists.

### 4. Trigger an academy sync on mount
- The Settings page should call the `sync-external-academy` edge function once when opened (similar pattern to `useAutoSync`) so newly added Origin Sports data appears without manual sync. Show a small "Syncing…" indicator while it runs; refetch the academy + settings queries on completion.

## Technical notes

- No DB migration required — `academy_settings.prefs` (jsonb, default `{}`) already exists for the extra fields.
- All reads stay RLS-safe: `academies` uses `user_has_club_access`, `academy_settings` uses `user_has_academy_access`, `profiles` is self-read only so the Staff join needs to use `user_academies` joined to `profiles` via a service-role edge function OR by relaxing the profiles SELECT policy to allow members of the same academy to see each other's name/email. I'll take the edge-function route (`get-academy-staff`) to avoid widening profiles RLS.
- Files touched: `src/pages/Settings.tsx`, new edge function `supabase/functions/get-academy-staff/index.ts`.
