---
name: Match Cinema Layout
description: Veo-inspired dark cinematic match analytics view with right-side icon rail, slide-out panels (Clips/Summary/Analytics/Spotlight/Team), and customizable timeline strip
type: design
---
Match detail and demo pages use `MatchCinemaLayout` (src/components/Matches/Cinema/) when a processed video is available.

Structure:
- Full-bleed dark video container (16:9), `dark` class scoped to layout only — rest of app stays light.
- `IconRail` overlays the video top-right (md+) or sits below on mobile. Five panels: Clips, Summary, Analytics, Spotlight (player), Team.
- `MatchTimelineStrip` always rendered between video and panel — Veo-style horizontal timeline with grouping (Tags/Players), zoom (50–400%), playhead synced to video, click-to-seek, auto-scroll.
- Active panel renders below timeline as a 640px-tall expandable drawer (transition max-h).
- `ClipsPanel`: filter chips, card list with auto-generated thumbnails.
- `SummaryPanel`: `ScorelineCard` with team abbreviations, colored dots, FINAL RESULT badge.
- `PlayerSpotlightPanel`: track-id picker chips (jersey# from track_player_mapping if mapped), per-player stats grid (goals/shots/passes/tackles + distance/sprints/top speed from player_metrics), filtered clip list.
- `AnalyticsPanel` and `TeamPanel`: wrap existing MatchAnalyticsDashboard / PlayerTracksSummary.

Video time wiring:
- `CinemaVideoPlayer` exposes `onTimeUpdate` and `onDurationChange` callbacks.
- `MatchCinemaLayout` holds `currentTime` + `duration`, passes to TimelineStrip.

Thumbnails:
- `useEventThumbnails(videoUrl, times)` spawns a hidden `<video>` + `<canvas>`, seeks to each event time, exports JPEG dataURL.
- Module-level cache keyed by `${url}::${time.toFixed(2)}`.

Scoreline data: `matches` table extended with home_team, away_team, home_score, away_score, home_color, away_color, match_type, is_home, age_group. CreateMatchDialog collects these on creation.
