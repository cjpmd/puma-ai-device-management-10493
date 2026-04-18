
The user wants two Veo features:
1. **Player Spotlight** — a panel showing a single player's highlights/clips, jersey number based.
2. **Customizable Timeline** — a horizontal timeline below the video showing event markers grouped by **Tags** (event type rows: Goal, Shot on goal) or by **Players**, with zoom controls.

Current state:
- Cinema layout has icon rail with Clips/Summary/Analytics/Team
- ClipsPanel has filter chips (All/Goals/Shots/Passes/Tackles)
- Events have `player_track_id`, `type`, `outcome`, `time`
- No timeline strip below video, no per-player view

Plan:

**A) Player Spotlight panel** (new icon rail entry, replaces/augments Team)
- Player picker grid (track_id chips with jersey numbers if mapped)
- Selected player → filtered clip list (reuse ClipsPanel pattern)
- Mini stats card (passes, shots, tackles, distance from player_metrics)
- Wire to existing track→player mapping

**B) Veo-style Timeline strip** (new component below video, always visible when panel open or via toggle)
- Horizontal scrollable strip with time ruler (00:00, 08:20, 16:40...)
- Rows by mode: **Tags** (one row per event type, colored markers) or **Players** (one row per tracked player)
- Zoom controls (− 100% +) and customize dropdown
- Click marker → seek video
- Playhead indicator synced to current video time

Files:
- `MatchTimelineStrip.tsx` (new) — horizontal timeline with zoom + grouping
- `PlayerSpotlightPanel.tsx` (new) — player picker + filtered clips + mini stats
- `IconRail.tsx` — add Spotlight icon (UserCircle)
- `MatchCinemaLayout.tsx` — mount timeline strip + spotlight panel, expose currentTime + duration from video player
- `CinemaVideoPlayer.tsx` — expose `onTimeUpdate`, `onDurationChange`, `currentTime` via ref/callback

Keep concise — no DB changes, all derived from existing event_data + player_metrics.

# Player Spotlight + Customizable Timeline

## Goal
Add Veo's **Player Spotlight** (per-player clip view) and **Customizable Timeline** (horizontal event ruler grouped by Tags or Players) to the cinema layout.

## Plan

### 1. Player Spotlight panel
- New icon in `IconRail` (UserCircle) opens `PlayerSpotlightPanel`
- Panel layout:
  - **Player picker**: horizontal scroll of track-id chips (uses jersey number from `track_player_mapping` if available, else `#track_id`)
  - **Selected player header**: name/number + mini stats from `player_metrics` (passes, shots, tackles, distance, contribution score)
  - **Clip list**: reuses ClipsPanel card style, filtered to events where `player_track_id === selectedTrackId`
  - Click clip → seek video (existing pattern)

### 2. Customizable Timeline strip
- New `MatchTimelineStrip.tsx` rendered **below** the video inside `MatchCinemaLayout` (always visible, collapsible)
- Layout:
  - Header row: "Customize timeline ▾" dropdown (Tags / Players) + zoom controls (− 100% +)
  - Time ruler with tick marks every N seconds (scales with zoom)
  - Rows:
    - **Tags mode**: one row per event type (Goal yellow, Shot pink, Pass, Tackle...) with vertical markers at event times
    - **Players mode**: one row per tracked player with markers for their events
  - **Playhead**: vertical line at current video time, syncs via `onTimeUpdate`
  - Click marker → seek to that time
- Horizontal scroll when zoomed > 100%

### 3. Wire video time
- `CinemaVideoPlayer.tsx`: expose `currentTime` and `duration` via callback prop
- `MatchCinemaLayout`: hold `currentTime` + `duration` state, pass to TimelineStrip and SpotlightPanel

## Files

| File | Action |
|---|---|
| `src/components/Matches/Cinema/MatchTimelineStrip.tsx` | Create — horizontal timeline with zoom + grouping |
| `src/components/Matches/Cinema/PlayerSpotlightPanel.tsx` | Create — player picker + filtered clips + stats |
| `src/components/Matches/Cinema/IconRail.tsx` | Add Spotlight entry |
| `src/components/Matches/Cinema/MatchCinemaLayout.tsx` | Mount timeline + spotlight, manage currentTime/duration |
| `src/components/Matches/Cinema/CinemaVideoPlayer.tsx` | Expose onTimeUpdate + onDurationChange |
| `src/data/demoMatchData.ts` | (no change — existing events sufficient) |

## Notes
- No DB changes. All derived from existing `event_data`, `player_metrics`, and `track_player_mapping`.
- Timeline zoom: 50% → 400% via `pixelsPerSecond` state; horizontal overflow scroll.
- Spotlight uses jersey numbers from `track_player_mapping` when available, falls back to `#track_id`.
- Keep dark theme consistent with existing cinema panels.
