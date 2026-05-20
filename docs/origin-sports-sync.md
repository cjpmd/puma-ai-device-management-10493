# Origin Sports ↔ Lovable role sync

Lovable is the source of truth for academy staff roles. Each time
`sync-external-user-access` runs for a signed-in user, it pushes any pending
role changes (rows in `public.user_academies` where `role <> external_role`
or `external_role_synced_at IS NULL`) into the external (Origin Sports)
Supabase project.

## Expected external schema

The function attempts to `UPDATE` one of the following tables in the
external project, in order:

1. `public.user_academies(academy_id uuid, user_id uuid, role text, updated_at timestamptz)`
2. `public.academy_members(academy_id uuid, user_id uuid, role text, updated_at timestamptz)`

`academy_id` corresponds to `public.academies.external_id` in Lovable.
`user_id` is the Origin Sports `auth.users.id` resolved by email.

## Role enum

`head_coach`, `coach`, `assistant_coach`, `academy_manager`, `physio`,
`sports_scientist`, `analyst`, `scout`, `welfare_officer`, `admin`, `other`.

Origin Sports should display this `role` value in its own staff/management
UI so the assignment is reflected back to club admins there.

## Failure handling

If neither table accepts the update (e.g. read-only or missing), the sync
leaves `external_role_synced_at = NULL` and the Lovable Staff list shows
"Pending sync". The next sync run will retry.