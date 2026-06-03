## Findings

### 1. Play/Pause button — root cause

The `<video>` element has its own `onClick={togglePlay}` handler, and `VeoVideoControls` is rendered as an overlay above it. When you click the overlay's Play button, the click fires the button handler (play) **and then bubbles up to the video element** which immediately toggles back to paused. Net effect: nothing happens.

Same bubbling issue affects every overlay button (skip, mute, fullscreen, speed, settings, volume slider, progress-bar seek).

**Fix:** in `CinemaVideoPlayer.tsx`, stop propagation on the overlay container so clicks inside controls don't reach the video element. Wrap `<VeoVideoControls>` in a div with `onClick={(e) => e.stopPropagation()}`. Click-on-video to play/pause continues to work for the bare video area.

### 2. Other buttons in the cinema layout

- **Icon rail (Clips / Summary / Analytics / Spotlight / Pass Network / Team)**: pure state toggles, work fine
- **Clips → seek**: works (calls `videoRef.seekTo`)
- **Timeline event dots / strip**: work (seek to event time)
- **Mark In / Mark Out / Create Clip**: calls `extract-clip` edge function — not tested for this match, may fail because it expects a real storage path, not a Wasabi URL. Out of scope for this fix.
- **Outputs → View / Share**: View works after the previous fix; Share opens the share dialog, which calls `create-share-link` — also assumes a storage path, will likely fail for this test job. Out of scope.

### 3. Team calibration — what's wired and what's not

What's correctly set on `matches`:
- `home_team` = "Broughty United Pumas 2015s"
- `away_team` = "Kirrie Thistle"
- `team_id` linked to Pumas (36 players with squad numbers exist in `players`)
- `club_id` linked to Broughty United
- `is_home` = true, `status` = complete

What will NOT show real player names/numbers:
- **PlayerSpotlightPanel** reads from a `track_player_mapping` table, which has no rows for this match — the GPU pipeline only emits anonymous track IDs (1, 2, 3…). Without that mapping, the panel labels players as "Track N" / "#N" from jersey-OCR if present, never by player name.
- **TeamPanel** likewise shows track IDs, not roster names
- **player_match_stats** rows written by the callback have `track_id` but no `player_id`, so any roster join returns null

In short: scoreline + home/away/colour styling are correct; per-player attribution to the actual Pumas squad is **not** calibrated and requires a separate manual or assisted mapping flow (out of scope here).

What WILL show correctly:
- Scoreline header with team names + colours
- Aggregate stats (distance, top speed, sprints, passes…) per anonymous track
- Heatmaps, pass network, CV events on the timeline

## Changes in this fix

1. `src/components/Matches/Cinema/CinemaVideoPlayer.tsx` — wrap `<VeoVideoControls>` in a `<div onClick={stopPropagation}>` so overlay button clicks don't bubble to the video and self-cancel.

## Out of scope (call out, don't fix now)

- `extract-clip` / `create-share-link` likely fail for the test job (full URL stored where a storage path is expected)
- Roster mapping from anonymous CV `track_id` to real Pumas players — needs a UI to tag each track once, then persist in `track_player_mapping`
