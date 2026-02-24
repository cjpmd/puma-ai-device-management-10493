

# Connect Performance App to Football Central App

## What We're Doing

You already have the [puma-ai-football-central](/projects/5d10e51a-8461-40f2-a899-60ebdbbef2fc) app managing clubs, teams, and players. This performance app already has a sync mechanism (edge function + UI button), but it has bugs that prevent it from actually working. We need to fix those and enhance the integration.

## Current State

- The `sync-external-data` edge function exists and the `EXTERNAL_SUPABASE_URL` and `EXTERNAL_SUPABASE_ANON_KEY` secrets are configured
- The `SyncStatusIndicator` component is already in the Analysis page
- Local `clubs`, `teams`, and `players` tables exist with `external_id` columns for mapping
- A `club_teams` junction table exists in Football Central (clubs can have multiple teams)

## Problems to Fix

The edge function has **field name mismatches** with the actual Football Central database schema:

| What the sync function uses | What Football Central actually has |
|---|---|
| `club.club_name` | `club.name` |
| `team.team_name` | `team.name` |
| `player.player_name` | `player.name` |
| `player.player_type` | `player.type` |

Additionally, teams in Football Central link to clubs via both `teams.club_id` and a `club_teams` junction table -- the sync currently only handles `teams.club_id` which is fine.

The edge function also needs the entity passed as a **query parameter**, but the `SyncStatusIndicator` sends it in the **request body**. This mismatch means the entity filter is ignored.

## Implementation Plan

### 1. Fix the Edge Function (`supabase/functions/sync-external-data/index.ts`)

- Fix field name mappings to match Football Central's actual schema:
  - `club.name` (not `club_name`)
  - `team.name` (not `team_name`)
  - `player.name` (not `player_name`)
  - `player.type` (not `player_type`)
- Read entity from both query params AND request body for flexibility
- Add additional player fields from Football Central: `date_of_birth`, `availability`, `photo_url`, `play_style`
- Add additional team fields: `age_group`, `game_format`, `logo_url`
- Add additional club fields: `logo_url`, `subscription_type`
- Add CORS headers for the additional Supabase client headers
- Improve error handling and logging

### 2. Update Local Database Schema

Add columns to local tables to store the richer data from Football Central:

**players table:**
- `date_of_birth` (text, nullable)
- `availability` (text, nullable)
- `photo_url` (text, nullable)

**teams table:**
- `age_group` (text, nullable)
- `game_format` (text, nullable)
- `logo_url` (text, nullable)

**clubs table:**
- `logo_url` (text, nullable)

### 3. Fix the SyncStatusIndicator Component

- Pass entity as query parameter (not body) to match the edge function
- OR update edge function to also read from body (preferred -- we'll do both)

### 4. Add Route for Pitch Calibration

- Add the `/pitch-calibration` route to `App.tsx` (it was created previously but never added to routing)

## Technical Details

### Edge Function Changes

The core fix is straightforward -- updating field references:

```text
Before: name: club.club_name
After:  name: club.name

Before: name: team.team_name  
After:  name: team.name

Before: name: player.player_name, player_type: player.player_type
After:  name: player.name, player_type: player.type
```

### Security Note

The sync uses `EXTERNAL_SUPABASE_ANON_KEY` which relies on RLS policies in Football Central allowing read access. If the external app requires authentication, you may need to update the secret to use a service role key from that project instead. We can test this after deployment.

### Files Changed

1. `supabase/functions/sync-external-data/index.ts` -- Fix field mappings, add entity from body, sync additional fields
2. `src/components/Analysis/SyncStatusIndicator.tsx` -- Minor fix to pass entity correctly
3. Database migration -- Add new columns to players, teams, clubs tables
4. `src/App.tsx` -- Add `/pitch-calibration` route

