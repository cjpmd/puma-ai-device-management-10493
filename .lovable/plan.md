## Goal

Make coach-added tags the source of truth for the cinema view: drive the scoreline, the analytics summary, and the clip list (with 5-second pre-roll for goals & shots on target).

## Scope

Frontend-only. No GPU pipeline changes, no DB schema changes. Uses the `match_event_tags` rows already saved via the Tagging panel.

## Changes

### 1. Shared tag-derived stats hook
Create `src/components/Matches/Cinema/useCoachTagStats.ts`:
- Input: `coachTags: TimelineEvent[]`.
- Output:
  - `homeScore`, `awayScore` (count of `event_type === 'goal'` per `team`).
  - Counts: `goals`, `shots`, `shots_on_target`, `saves`, `passes`, `tackles`, plus per-team breakdown.
  - `result` string: `'W' | 'L' | 'D'` from the perspective of `match.is_home`.
- Memoized; safe with empty arrays.

### 2. Summary panel — show actual result
`SummaryPanel.tsx` + `ScorelineCard.tsx`:
- Accept optional `tagHomeScore` / `tagAwayScore` props; when present, prefer them over `match.home_score` / `match.away_score`.
- Treat scoreline as Final when any coach `goal` tag exists OR `status === 'complete'`.
- Add a small "Result" pill (W / L / D, coloured) next to "Final Result" derived from `is_home`.
- Add a compact "From coach tags" caption when tag-derived scores are used so it's clear where the numbers come from.

### 3. New Tag Stats summary card
Add a small stats strip inside the Summary panel under the scoreline:
- Goals · Shots · Shots on target · Saves · Passes · Tackles (per team where possible).
- Renders only when there is at least one coach tag.
- Same `useCoachTagStats` hook.

### 4. Analytics panel — overlay coach numbers
`AnalyticsPanel.tsx` / `MatchAnalyticsDashboard.tsx`:
- Pass coach tags down.
- In `MatchStatsView`, when coach stats exist, prefer them for Goals / Shots / Shots on target / Saves / Passes / Tackles, and label the section "Coach-tagged stats" (keep CV-derived possession %, xG, pass success % as-is when present).
- Add a top scoreline row mirroring the Summary so analytics opens on the actual result.

### 5. Clips panel — include tags + 5 s pre-roll
`ClipsPanel.tsx`:
- Accept full `TimelineEvent[]` (already does); display coach tags with a small "Coach" badge so they're visually distinct from CV events.
- Extend filter presets: All, Goals, Shots, Shots on target, Saves, Passes, Tackles. Matching rules check both `type` and `outcome` for CV events and `type` for coach tags (e.g. `shot_on_target`).
- Sort newest-first by time? Keep chronological (matches current behaviour).
- Add `PRE_ROLL_SECONDS` map: `goal` → 5, `shot_on_target` → 5, default 0.
- On click, seek to `Math.max(0, ev.time - preRoll)` instead of `ev.time`. Apply only for coach tags + CV `goal`/`shot` outcomes.

### 6. Layout wiring
`MatchCinemaLayout.tsx`:
- Compute `coachStats` once via the new hook and pass to `SummaryPanel`, `AnalyticsPanel`, and `ClipsPanel` (latter only needs the pre-roll behaviour, not the stats).
- Keep existing CV merge intact; coach tags continue to flow through `mergedEvents` for the timeline strip.

## Out of scope

- Persisting tag-derived scores back to `matches.home_score` / `away_score` (kept read-only; can be a follow-up if the coach wants this saved).
- Editing/assigning tags to players (already supported by tag table, not part of this request).
- GPU/CV pipeline updates (Phase 1+ of the analytics roadmap).

## Technical notes

- "Shots on target" rule: coach tag `event_type === 'shot_on_target'`, OR `event_type === 'goal'` (a goal implies on-target).
- "Saves" rule: coach tag `event_type === 'save'`.
- Team attribution uses the `team` column from the tag (`'home' | 'away'`); tags without a team count toward totals but not per-team scoreline.
- All UI uses existing semantic Tailwind tokens; no new colours.
- No DB migrations.
