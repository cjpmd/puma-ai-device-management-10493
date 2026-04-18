
The user is asking whether they need to wait for a real match video to see the new analytics UI, or whether we can show an updated UI now (likely with placeholder/demo content so they can see what it looks like).

Looking at the current state:
- `MatchAnalyticsDashboard`, `MatchVideoPlayer`, `HeatmapOverlay`, `AIInsightsPanel`, `PlayerTracksSummary`, `VideoTimeline` all exist
- They only render when `latestJob?.status === 'complete'`
- Without a processed video, the user sees nothing on the matches page beyond the upload cards

The right answer: add a **demo mode** so the coach can preview every dashboard tab with realistic mock data without needing to upload and process a real video.

# Demo Mode for Match Analytics

## Goal
Let the user explore every analytics view (timeline, heatmaps, player tracks, match stats, AI insights, video player) with realistic mock data — no upload or GPU run needed.

## Approach

### 1. Add a "View Demo Match" entry point
- On `/matches` page (Matches list): add a prominent **"View Demo Analytics"** card/button at the top.
- Routes to `/matches/demo` (special route, no DB lookup).

### 2. Create demo data fixture
New file `src/data/demoMatchData.ts` exporting a fully populated mock `ProcessingJob` object:
- `player_tracking_data`: ~14 tracked players with positions, durations, distances
- `ball_tracking_data`: detection stages timeline + play-switch events
- `event_data`: ~40 realistic events (passes, shots, tackles, possession changes) with timestamps
- `team_metrics`: possession 58/42, xG 1.8 vs 0.9, shots 12/6, pass success 78%/65%
- `player_metrics`: per-track passes/shots/tackles/distance/contribution scores
- `heatmaps`: sparse 20×12 grid intensities for ~8 players
- `divergence_metrics`: dominance score, shot efficiency, etc.
- Mock `match_insights` row with summary, strengths, weaknesses, top performers, coaching focus

### 3. Demo page
New `src/pages/DemoMatch.tsx` — reuses `MatchAnalyticsDashboard`, `MatchVideoPlayer`, `PlayerTracksSummary` etc. but feeds them the fixture instead of querying Supabase. Use a sample public video URL (e.g. a short football clip or a placeholder mp4) for the player.

### 4. Small component tweak
`MatchAnalyticsDashboard` and `MatchVideoPlayer` currently fetch `match_insights` and `track_player_mapping` from Supabase. Add an optional `demoMode` prop that bypasses the fetch and uses inline data.

### 5. Empty-state hint on real MatchDetail
On `MatchDetail.tsx`, when no job exists yet, show a small banner: *"No processed video yet. [See demo analytics] to preview what coaches will see."*

## Files

| File | Action |
|---|---|
| `src/data/demoMatchData.ts` | Create — fixture data |
| `src/pages/DemoMatch.tsx` | Create — demo dashboard page |
| `src/App.tsx` | Add `/matches/demo` route |
| `src/pages/Matches.tsx` | Add "View Demo Analytics" CTA |
| `src/pages/MatchDetail.tsx` | Add empty-state link to demo |
| `src/components/Matches/MatchAnalyticsDashboard.tsx` | Accept `demoMode` + inline insights |
| `src/components/Matches/MatchVideoPlayer.tsx` | Accept `demoMode` + inline events/mapping |

## Notes
- No DB changes, no edge function changes.
- Demo video: use a short public-domain football clip URL or a generic stock mp4 so the player has something to render.
- Once the user uploads and processes a real match, the live dashboard works identically — demo just front-loads the experience.
