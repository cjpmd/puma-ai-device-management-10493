# Plan

## 1. Ultra Analysis — match dark/glass design

The Analysis page (`/analysis`) uses a dark purple gradient background, but `MetricCard` and the chart panels render as solid white cards (`bg-white text-slate-900`), breaking the scheme. Movement Intensity and Shot Power Analysis panels are also empty white boxes.

Changes:
- **`src/components/MetricCard.tsx`** — switch to the same glass surface used elsewhere on Analysis: `bg-white/5 border border-white/10 backdrop-blur-md text-white`, title `text-white/70`, value `text-white`, unit/subtitle `text-white/60`, icon `text-white/70`. Remove the duplicated `border border-slate-200` class.
- **`src/pages/Analysis.tsx`** — wrap Movement Intensity / Shot Power Analysis / Player Movement Map / any remaining white panels in the same `bg-white/5 border border-white/10 backdrop-blur-md rounded-lg` shell; titles to `text-white`, secondary copy to `text-white/70`. Audit Individual/Group/Biometrics/Video tab panels in the same pass and fix any `bg-white`, `text-slate-900`, or `text-slate-*` on the dark background.
- Keep all functional logic, queries and props untouched.

## 2. Settings → Staff — assign role to existing staff

Today each staff row shows a static role pill. Add inline role editing and prepare the data model so Origin Sports can read it back.

Frontend (`src/pages/Settings.tsx`, `StaffTab`):
- Replace the static role pill with a small `<select>` (Head Coach, Coach, Assistant Coach, Physio, Analyst, S&C, Academy Manager, Admin, Other) bound to `user_academies.role` for the active academy.
- On change, call a new edge function `update-academy-staff-role` (service-role) that updates `user_academies.role` for `(academy_id, user_id)` after verifying the caller has academy access and is a head_coach / academy_manager / admin. Optimistic update + toast.
- Show a small "Synced to Origin Sports" hint when `external_role_synced_at` is set; otherwise "Pending sync".

Database (migration):
- `ALTER TABLE public.user_academies ADD COLUMN IF NOT EXISTS external_role_synced_at timestamptz;`
- `ALTER TABLE public.user_academies ADD COLUMN IF NOT EXISTS external_role text;` (last role pushed to Origin Sports, for diffing)
- Index on `(academy_id)` if not present.
- RLS: keep existing; the edge function uses service role.

Edge functions:
- **`update-academy-staff-role`** (new) — input `{ academy_id, user_id, role }`. Verifies caller via JWT + `user_has_academy_access` + caller role in allow-list. Updates `user_academies.role`, clears `external_role_synced_at`, returns updated row.
- **`sync-external-user-access`** (extend) — on each run, for every `user_academies` row where `role <> external_role` (or `external_role_synced_at IS NULL`), push the role to Origin Sports via the matching external membership table (`user_clubs`/`club_members` / `user_teams`/`team_members` already handled there). On success set `external_role = role`, `external_role_synced_at = now()`. If Origin Sports table is read-only, log a warning and leave timestamp null.
- **`get-academy-staff`** (extend) — include `external_role`, `external_role_synced_at` in returned rows so the Staff tab can display sync status.

Origin Sports preparation (documented, not code we own):
- Document the contract in `docs/origin-sports-sync.md`: field `role` (enum list above) on the membership row, optional `updated_at`. Note that Lovable will be the source of truth for academy role and Origin Sports should reflect it back into its UI.

## Technical notes

- No changes to `MetricCard` consumers' props.
- `update-academy-staff-role` must be registered in `supabase/config.toml` with `verify_jwt = true` (default).
- Keep `src/integrations/supabase/types.ts` regeneration to the automated pipeline after the migration.
