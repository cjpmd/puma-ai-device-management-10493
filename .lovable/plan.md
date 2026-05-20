## PVG = approval status, no expiry

Some background checks (PVG, and arguably AccessNI in certain forms) don't carry an expiry date — they're a one-time approval. Treat the background-check fields as either *date-typed* (DBS) or *boolean-typed* (PVG), then render appropriately.

### Database

Add two nullable columns to `profiles`:
- `pvg_approved boolean` — true = approved, null/false = not on file
- `pvg_approved_at date` — optional reference date when approval was recorded (displayed as "Approved DD/MM/YYYY" tooltip; not used for expiry)

Keep existing `pvg_expiry date` column for back-compat but stop writing to it from the UI. (Leave it in place — no destructive change.)

DBS and AccessNI stay date-based (`dbs_expiry`, `accessni_expiry`).

### Settings → Staff → Qualifications editor

When a row's resolved background-check type is:
- **DBS / AccessNI** → keep the existing date input (expiry).
- **PVG** → replace the date input with a single "PVG approved" checkbox + optional "Approved on" date picker. Writes `{ pvg_approved, pvg_approved_at }` instead of `pvg_expiry`.

Apply the same logic to the "My qualifications" self-service card.

`update-staff-qualifications` edge function: add `pvg_approved` and `pvg_approved_at` to the `ALLOWED_FIELDS` whitelist (boolean / date validation).

### Compliance → Staff Qualifications table

Background-check cell rendering becomes type-aware:
- **DBS / AccessNI** → `<ExpiryBadge>` as today (date with red/amber/green).
- **PVG** → 
  - `pvg_approved === true` → green check icon + "Approved" (+ tooltip with `pvg_approved_at` if present).
  - else → existing "Not recorded" muted text.

No more "Expires in Xd" or "Expired" states for PVG rows.

### Edge function `get-academy-staff`

Add `pvg_approved`, `pvg_approved_at` to the profile select list and to the staff response object.

### Files touched

- migration: add `pvg_approved boolean`, `pvg_approved_at date` to `profiles`
- `supabase/functions/get-academy-staff/index.ts`
- `supabase/functions/update-staff-qualifications/index.ts`
- `src/pages/Settings.tsx` (staff Qualifications editor + self-service card)
- `src/pages/Compliance.tsx` (PVG branch in background-check cell, new `ApprovedBadge` component)

### Out of scope

- Migrating any existing `pvg_expiry` rows to `pvg_approved` — left for a separate data-cleanup task. UI will fall back to "Not recorded" until someone re-saves with the new control.
- Other UK nations beyond PVG. AccessNI stays expiry-based (which matches the current standard 3-year renewal cycle).
