---
name: Match Cinema Layout
description: Veo-inspired dark cinematic match analytics view with right-side icon rail and slide-out panels (Clips/Summary/Analytics/Team)
type: design
---
Match detail and demo pages use `MatchCinemaLayout` (src/components/Matches/Cinema/) when a processed video is available.

Structure:
- Full-bleed dark video container (16:9), `dark` class scoped to layout only — rest of app stays light.
- `IconRail` overlays the video top-right (md+) or sits below on mobile. Four panels: Clips, Summary, Analytics, Team.
- Active panel renders below video as a 640px-tall expandable drawer (transition max-h).
- `ClipsPanel`: filter chips (All/Goals/Shots/Passes/Tackles), card list with auto-generated thumbnails.
- `SummaryPanel`: `ScorelineCard` with team abbreviations, colored dots, FINAL RESULT badge.
- `AnalyticsPanel` and `TeamPanel`: wrap existing MatchAnalyticsDashboard / PlayerTracksSummary.

Thumbnails:
- `useEventThumbnails(videoUrl, times)` spawns a hidden `<video>` + `<canvas>`, seeks to each event time, exports JPEG dataURL.
- Module-level cache keyed by `${url}::${time.toFixed(2)}`.

Scoreline data: `matches` table extended with home_team, away_team, home_score, away_score, home_color, away_color, match_type, is_home, age_group. CreateMatchDialog collects these on creation.
