
The user wants the match analytics UI to look closer to Veo's. Let me analyze what Veo offers from the screenshots:

1. **Image 1**: Full-bleed video player, dark theme, minimal chrome. Right-side icon rail (camera/video, document/summary, timeline, analytics/bars, kit/team).
2. **Image 2 (Clips panel)**: Slide-out right panel with filter chips (All, Goals, Shots, By me, Filters), card-based clip list with thumbnails, timestamp overlay on thumbnail, title ("Shot on goal"), share/AI badges, comments count, kebab menu.
3. **Image 3 (Summary panel)**: Match title, date/views, tags (FRIENDLY, HOME, U9), big scoreline with team abbreviations and colored dots, "FINAL RESULT" badge.
4. **Image 4 (Analytics panel)**: Premium upsell card style, but conceptually this is where stats live.

Key Veo design patterns:
- **Dark theme** (near-black bg, white text)
- **Full-width cinematic video** as the hero
- **Slide-out right panels** instead of tabs below — opened via right-side icon rail
- **Card-based clips** with video thumbnails and timestamps
- **Filter chips** for clip filtering
- **Big scoreline** front and center in summary
- **Compact, high-density info** with rounded corners and subtle borders

Our current setup:
- Light emerald gradient background
- Tabs-below-video layout in `MatchAnalyticsDashboard`
- `MatchVideoPlayer` has clickable event timeline below video
- Already has events, heatmaps, AI insights, player tracks, match stats

Gap analysis — what to change:
1. **Theme**: Add a dark "cinema mode" for match detail / demo pages (preserve light theme elsewhere)
2. **Layout**: Replace bottom-tabs with right-side icon rail + slide-out panels
3. **Clips panel**: Convert event timeline into card-based clip list with auto-generated thumbnails (use `<video>` poster at event timestamp via canvas)
4. **Summary panel**: Score header card with team colors, tags, FINAL RESULT badge — needs `home_team`, `away_team`, `home_score`, `away_score` fields
5. **Analytics panel**: Move existing stats/heatmaps into the slide-out
6. **Team kit panel**: Bottom rail icon for player roster (we have PlayerTracksSummary)

What's missing in DB:
- `home_team`, `away_team`, `home_score`, `away_score`, `match_type` (Friendly/League) on `matches`. Need to check if these exist.

Let me keep the plan tight — focus on visual/layout transformation. We can add scoreline DB fields as part of this.

Files to touch:
- New `MatchCinemaLayout.tsx` — wraps video full-width with right icon rail + animated panel
- New panels: `ClipsPanel`, `SummaryPanel`, `AnalyticsPanel`, `TeamPanel` (mostly wrapping existing components)
- `MatchVideoPlayer.tsx` — refactor for cinema mode (controls overlay, click-on-timeline still works inside Clips panel)
- `MatchDetail.tsx` + `DemoMatch.tsx` — switch to new layout
- Migration: add `home_team`, `away_team`, `home_score`, `away_score`, `match_type` to `matches`
- `CreateMatchDialog.tsx` — add scoreline fields
- `demoMatchData.ts` — add demo scoreline

Auto-thumbnails: generate via offscreen `<video>` + `<canvas>` capturing frame at event time on demand, cached in memory.

Keep concise.
