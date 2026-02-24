

# Fix Data Sync and Add Club/Team Filtering

## Problem Identified

The sync is failing because the `EXTERNAL_SUPABASE_URL` secret is set to the wrong value. The edge function logs show it's returning an HTML page (the Supabase dashboard) instead of JSON data. The correct URL for your Football Central project should be `https://pdarngodvrzehnpvdrii.supabase.co`.

Additionally, Football Central has RLS policies that likely require authentication -- since the sync uses the anon key, it may also need the **service role key** from Football Central to bypass RLS and read all clubs/teams/players.

## Plan

### 1. Fix the EXTERNAL_SUPABASE_URL secret

The `EXTERNAL_SUPABASE_URL` needs to be updated to the correct value:
```text
https://pdarngodvrzehnpvdrii.supabase.co
```

I'll prompt you to re-enter this secret with the correct value.

### 2. Upgrade to Service Role Key (if needed)

Football Central likely has RLS policies requiring authentication. The anon key won't be able to read clubs/teams/players without being logged in. We should:
- Add a new secret `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` with the service role key from your Football Central project
- Update the edge function to use the service role key instead of the anon key
- This allows the sync function to bypass RLS and read all data

### 3. Fix field mapping in edge function

Based on Football Central's actual schema:

| Football Central field | What the sync maps to locally |
|---|---|
| `player.type` | `player_type` (correct already) |
| `player.play_style` | `position` (currently unmapped -- FC has no `position` column) |
| `player.availability` | `availability` (correct) |
| `player.date_of_birth` | `date_of_birth` (correct) |

Fix: Map `player.play_style` to local `position` column since Football Central doesn't have a `position` field.

### 4. Add Club and Team filtering to the Analysis page

Update the Analysis page to include:
- **ClubSelector** dropdown at the top of the page (already exists as a component)
- **TeamSelector** dropdown that filters by selected club (already exists as a component)
- **PlayerSelector** updated to filter by selected club/team
- State management to cascade the filters: Club -> Team -> Player

### 5. Update edge function to use batch upserts

Instead of upserting one record at a time (N network round-trips), batch the upserts for better performance.

## Technical Details

### Files to change:

1. **`supabase/functions/sync-external-data/index.ts`**
   - Use `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` instead of `EXTERNAL_SUPABASE_ANON_KEY`
   - Map `player.play_style` to `position`
   - Add team `club_id` lookup via `club_teams` junction table as fallback
   - Use batch upserts instead of individual calls

2. **`src/pages/Analysis.tsx`**
   - Add `selectedClubId` and `selectedTeamId` state variables
   - Import and render `ClubSelector` and `TeamSelector` components at the top
   - Pass `clubId` and `teamId` to `PlayerSelector` for cascading filter
   - Wire the filter state so selecting a club filters teams, and selecting a team filters players

3. **Secrets update**
   - Update `EXTERNAL_SUPABASE_URL` to the correct value
   - Add `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` secret (you'll need to get this from your Football Central project settings)

