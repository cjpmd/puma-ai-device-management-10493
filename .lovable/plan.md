

# Wire GPU Output Data to the Frontend

## Goal
Store and display the rich metadata the GPU handler already produces (player tracks, ball positions, play-switch events) so coaches can actually see analytics after processing completes.

## Changes

### 1. Database: Add JSON columns to `processing_jobs`
Add three nullable JSONB columns:
- `player_tracking_data` — stores player tracks from metadata
- `ball_tracking_data` — stores ball positions and detection stats
- `event_data` — stores play-switch events and future highlight events

### 2. Update `runpod-webhook` edge function
When the webhook receives results, download `metadata.json` from Wasabi and populate the new JSON columns on the `processing_jobs` row.

### 3. Create `VideoTimeline` component
A horizontal bar below the video player showing:
- Ball detection confidence over time (color-coded by stage: green=YOLO, yellow=motion, red=Kalman)
- Play-switch event markers
- Clickable to seek (future, when video player supports it)

### 4. Create `PlayerTracksSummary` component
A table/card showing for each tracked player:
- Track ID, duration on screen, distance traveled
- Small sparkline of movement intensity

### 5. Create `MatchAnalyticsDashboard` section in MatchDetail
Below the video viewer, add a tabbed section:
- **Timeline** tab → `VideoTimeline`
- **Players** tab → `PlayerTracksSummary`
- **Detection Stats** tab → pie chart of YOLO/motion/Kalman/lost percentages

### 6. Update `MatchDetail.tsx`
Import and render `MatchAnalyticsDashboard` when `processing_jobs` status is `complete`.

## Files

| File | Action |
|------|--------|
| Migration SQL | Add 3 JSONB columns to `processing_jobs` |
| `supabase/functions/runpod-webhook/index.ts` | Parse metadata and store in new columns |
| `src/components/Matches/VideoTimeline.tsx` | Create |
| `src/components/Matches/PlayerTracksSummary.tsx` | Create |
| `src/components/Matches/MatchAnalyticsDashboard.tsx` | Create — tabs wrapper |
| `src/pages/MatchDetail.tsx` | Add analytics dashboard section |

