## Goal

Make the completed test job viewable in the full cinema layout at `/match/bd76f2a1-cf46-46d4-81e4-3cf9738c6336`, with the correct teams shown and the original analysed video playing alongside all the analytics.

## Changes

### 1. Update the "test 2" match record (data change)

Set on match `bd76f2a1-cf46-46d4-81e4-3cf9738c6336`:
- `title` → "Broughty United Pumas 2015s vs Kirrie Thistle"
- `home_team` → "Broughty United Pumas 2015s"
- `away_team` → "Kirrie Thistle"
- `is_home` → true
- `team_id` → `a5c06215-b921-4204-942a-5c03809e1c07` (so squad / player panels can resolve roster)
- `club_id` → `d987b975-aa3c-490a-971d-45421ed86b3b`
- `status` → "complete"
- `age_group` → "U11" (2015s)

This unlocks the Team panel, Player Spotlight roster lookups, and proper scoreline header.

### 2. Persist the analysed video URL on the job (data change)

The test was run against a Wasabi presigned URL — that URL is currently only known to the test page, not the job row. Store it so the cinema player can find it:

- Set `processing_jobs.output_video_path` on the test job to the Wasabi presigned URL used in `TestVideoAnalysis.tsx`.

(The presigned URL is valid until ~May 2027 per its `X-Amz-Expires`, so this is fine for testing. For real captures the stitched/output path will continue to come from the normal pipeline.)

### 3. Fallback in `CinemaVideoPlayer` for full URLs

Today `loadVideo` always calls the `get-output-url` edge function with `output_video_path` treated as a storage path. Add a small fallback: if `path` already looks like a fully-qualified URL (starts with `http://` or `https://`), use it directly instead of calling the edge function. This is what lets the persisted Wasabi presigned URL play without changes to the backend.

No other behaviour changes — stitched and storage-path outputs continue through `get-output-url` exactly as today.

### 4. Verify

Open `/match/bd76f2a1-cf46-46d4-81e4-3cf9738c6336` and confirm:
- Scoreline shows Pumas vs Kirrie Thistle
- "Load Match Video" plays the analysed clip
- Timeline strip shows CV events from `event_data.events`
- Analytics, Spotlight, Pass Network, Team panels populate from `player_metrics` / `heatmaps` / `event_data`

## Files touched

- migration / data update on `public.matches` and `public.processing_jobs` (one row each)
- `src/components/Matches/Cinema/CinemaVideoPlayer.tsx` — add URL passthrough in `loadVideo`

## Out of scope

- Linking players from `players` table into per-track stats (track_ids are anonymous from the CV pipeline; player attribution is a separate feature)
- Generating a stitched video for this test match
- Any change to the analysis pipeline itself
