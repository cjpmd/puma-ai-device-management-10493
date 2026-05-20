
## 1. Compliance — show staff name, not ID, in Safeguarding/Audit sections

Currently the Safeguarding and Audit Trail tables render `e.user_id?.slice(0, 8)…`. Replace with full name + email.

- In `src/pages/Compliance.tsx`, collect distinct `user_id`s from `auditEntries`, fetch `profiles(id, full_name, email)` via a `useQuery` keyed on those IDs, and render `name (email)` in the Actor columns (Safeguarding + Audit Trail). Fall back to short ID only if profile is missing.
- Fix low-contrast text on this page in the same pass: `text-slate-900/30` → `text-slate-500`; ensure tables use design-system surfaces (already mostly white/slate — keep, but make sure no `text-white` on white).

## 2. DBS ↔ PVG jurisdiction toggle (academy default + per-staff override)

### Database migration
- `academies`: add `background_check_jurisdiction text default 'england'` (enum-like: `england` → DBS, `scotland` → PVG, `wales` → DBS, `northern_ireland` → AccessNI). Stored as text for flexibility.
- `profiles`: add
  - `background_check_type text` (nullable; `dbs` | `pvg` | `accessni`) — override; null = inherit academy default.
  - `pvg_expiry date` (nullable) — used when type resolves to `pvg`.
  - `accessni_expiry date` (nullable) — used for NI.
  - Keep existing `dbs_expiry` as-is.

### Settings → Academy Profile
- Add a "Background check jurisdiction" `<select>` (England – DBS / Scotland – PVG / Wales – DBS / Northern Ireland – AccessNI) bound to `academies.background_check_jurisdiction`.

### Settings → Staff tab
- New "Qualifications" inline editor per staff row (collapsible) — fields: UEFA Licence, FA Safeguarding expiry, First Aid expiry, Background check type (Inherit / DBS / PVG / AccessNI), Background check expiry (writes to the matching `*_expiry` column).
- Editable by self OR by Head Coach / Academy Manager / Admin (mirrors role edit). Use a new edge function `update-staff-qualifications` (service-role, validates caller is self or has manager role via `user_academies`).

### Compliance → Staff Qualifications table
- Replace fixed "DBS" column with dynamic header that resolves per row: row uses `profiles.background_check_type` if set, else `academies.background_check_jurisdiction`. Header label becomes "Background check"; each cell shows the resolved label (DBS / PVG / AccessNI) + expiry badge.
- Continue to show UEFA Licence, FA Safeguarding, First Aid columns unchanged.
- Fix `text-slate-900/30` "None" pill → `text-slate-500`.

## 3. Profile self-service edit

- Add a "My qualifications" card on Settings (already a page) for the signed-in user editing their own `profiles` row (UEFA, Safeguarding, First Aid, background-check type + expiry). RLS already lets users update their own profile, so this is a direct `supabase.from('profiles').update(...).eq('id', user.id)` — no edge function needed for self.

## 4. Session Plans — clarification only (no code change)

`session_plan` is a Lovable-side table per academy. It is not synced from Origin Sports and there is no UI to create plans yet. Out of scope for this plan unless you want me to add a creation UI (separate request).

## Technical notes

- Migration order: `ALTER TABLE academies ADD COLUMN background_check_jurisdiction text NOT NULL DEFAULT 'england';` then `ALTER TABLE profiles ADD COLUMN background_check_type text, ADD COLUMN pvg_expiry date, ADD COLUMN accessni_expiry date;`
- New edge function `update-staff-qualifications` deployed under `supabase/functions/update-staff-qualifications/index.ts`, follows the same auth pattern as `update-academy-staff-role`.
- `get-academy-staff` extended to return `background_check_type`, `pvg_expiry`, `accessni_expiry`, plus the academy's `background_check_jurisdiction` once at the top of the response (so the Staff tab doesn't need a second query).
- `src/integrations/supabase/types.ts` will be auto-regenerated after the migration.
- All new UI must follow the design system — no `text-white` on light surfaces, no `text-slate-900/30` low-contrast text.
