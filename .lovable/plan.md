## Problem

The Travel Events feature is wired up in the UI but the underlying database tables don't exist yet. Creating a new event fails with `Could not find the table 'public.travel_event' in the schema cache`.

The code references 8 tables and 1 storage bucket:

- `travel_event` — top-level event
- `travel_itinerary_item` — daily schedule entries
- `travel_transport_leg` — flights/coaches/etc.
- `travel_accommodation` — hotels
- `travel_budget_item` — line-item budget
- `travel_player_consent` — per-player consent/passport/dietary info
- `travel_document` — uploaded documents (linked to storage)
- `travel_update` — posted updates / push messages
- `travel-documents` storage bucket — file uploads

## Plan

Create a single migration that adds all 8 tables, the storage bucket, and RLS policies scoped to the parent academy.

### Schema

`travel_event` — `academy_id`, title, destination_city/country, departure_date, return_date, event_type, squads (text[]), total_budget (numeric), status (default `draft`), created_by, timestamps.

`travel_itinerary_item` — `travel_event_id`, day_date, item_time, title, description, location, item_type, visible_to_parents (bool), sort_order (int), timestamps.

`travel_transport_leg` — `travel_event_id`, leg_order, transport_type, provider, reference_number, departure_location, arrival_location, departure_datetime, arrival_datetime, status (default `provisional`), notes, timestamps.

`travel_accommodation` — `travel_event_id`, hotel_name, address, phone, check_in, check_out, room_count, meal_plan, booking_reference, status (default `provisional`), notes, timestamps.

`travel_budget_item` — `travel_event_id`, category, description, budgeted_amount, actual_amount, paid (bool), timestamps.

`travel_player_consent` — `travel_event_id`, `player_id` (→ players.id), travel_consent_signed, passport_submitted, medical_declaration_signed, photo_consent, emergency_contact_confirmed (booleans, default false), dietary_requirements, passport_expiry (date), signed_at, timestamps. Unique on (travel_event_id, player_id).

`travel_document` — `travel_event_id`, title, document_type, file_url, is_restricted (bool), required (bool), uploaded_at, timestamps.

`travel_update` — `travel_event_id`, title, body, update_type, target_squads (text[]), sent_push (bool), posted_at (default now()), created_by, timestamps.

All child tables: `travel_event_id` is `ON DELETE CASCADE` to `travel_event`.

### Security helper

Add a SECURITY DEFINER function `user_has_travel_event_access(_user_id, _event_id)` that returns true when the user has academy access (via `user_has_academy_access`) to the event's academy. Reuses existing helpers — no recursion issues.

### RLS

- `travel_event`: SELECT/INSERT/UPDATE/DELETE allowed when `user_has_academy_access(auth.uid(), academy_id)`.
- All child tables: SELECT/INSERT/UPDATE/DELETE allowed when `user_has_travel_event_access(auth.uid(), travel_event_id)`.

### Storage

Create `travel-documents` bucket (public for read so the existing `getPublicUrl` calls work). Add policies so only authenticated users with academy access on the owning event can upload/update/delete. Path layout: `<travel_event_id>/<document_id>.<ext>`.

### Triggers

Standard `updated_at` triggers using existing `public.update_updated_at_column()` on every table.

## Out of scope

- No UI changes — `TravelEvents.tsx` and tabs work as-is once the schema exists.
- No edits to `useActiveContext` / blank-screen work from prior turns.
- Push notification delivery for `travel_update.sent_push` is just a flag; no backend job is added.

## Verification

1. Run the migration.
2. From `/travel` create a new event for Dundee FC Academy — should succeed and appear in the list.
3. Open the event, add an itinerary item, a transport leg, a budget line, and a document upload.
