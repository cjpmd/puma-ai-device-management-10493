## Goal

Two problems are visible on this match:

1. The analyser never reads jersey numbers that are clearly legible (e.g. #30 on the red shirt in your screenshot).
2. Even when an OCR vote happens, there's no link to "red shirts = home = Broughty United Pumas", so a confirmed number can't be tied to a roster player.

Fix both, end-to-end.

---

## What's wrong today (one-paragraph diagnosis)

- **Team assignment uses pitch position, not shirt colour.** `TeamClassifier.assign_teams` in `gpu-server/handler.py` just splits tracks by mean X. So even when OCR confirms a number, the "team" label it gets is roughly random, and the `analysis-callback` per-side roster lookup snaps to the wrong side ~half the time.
- **The match's stored home colour is wrong.** DB has `home_color = #10b981` (green) but the team plays in red. So even if we wired colour through, it would mis-map home/away.
- **OCR thresholds are too strict for youth match footage.** `CONFIRM_VOTE_SCORE = 1.6`, `CONFIRM_MIN_FRAMES = 12`, two narrow vertical bands, and a 128 px upscale target. On 4K-downscaled grassroots clips the numbers are small and only legible for a few frames at a time — almost nothing clears the gate.
- **Process-video already forwards rosters to RunPod** ✓ — so the GPU has the legal numbers. It just doesn't know which side a track belongs to and rarely confirms a read.

---

## Plan

### 1. Fix the match's team colours (data only, one-off)

Ask you to confirm, then update `matches.home_color` for `bd76f2a1-cf46-46d4-81e4-3cf9738c6336` from `#10b981` → red (e.g. `#dc2626`). `away_color` (Kirrie Thistle) stays `#3b82f6` blue. This is the only manual fix; everything below picks colours up automatically from `matches.home_color` / `away_color`.

### 2. Forward team colours to the GPU job

`supabase/functions/process-video/index.ts`:
- Fetch `home_color`, `away_color`, `is_home` from `matches` alongside the rosters that already get loaded.
- Add to the RunPod `input` payload as `team_colors: { home: "#dc2626", away: "#3b82f6" }`.

### 3. Replace X-split team classification with HSV jersey clustering

`gpu-server/handler.py`:
- New `TeamClassifier.assign_teams_by_color(player_tracker, frames_sampled, team_colors)`:
  - During the main tracking loop, sample the torso crop (band 0.25–0.55 of bbox height) every ~30 frames per track and store mean HSV (skip green-dominant pixels — that's the pitch).
  - At end of loop, take each track's median HSV and run a 2-means cluster.
  - Map the two cluster centroids to `home`/`away` by nearest hue distance to the supplied `team_colors`. If `team_colors` is missing, fall back to the current X-split so legacy matches still work.
  - Output is still `{tid: "A"|"B"}`, with A=home, B=away (i.e. drop the `is_home` flip — A is always home from now on; update `analysis-callback` accordingly).

### 4. Make jersey OCR actually fire on this footage

`gpu-server/jersey_ocr.py`:
- Lower `MIN_CROP_SIZE` 20 → 14, raise `UPSCALE_TARGET_H` 128 → 192, drop `CONFIRM_MIN_FRAMES` 12 → 6, drop `CONFIRM_VOTE_SCORE` 1.6 → 1.1, drop `CONFIRM_VOTE_LEAD` 0.6 → 0.35.
- Add a third "back" band (0.18–0.42) — youth shirts usually carry the number high-centre on the back, outside today's two bands.
- Once `team_assignment` is known, the existing `restrict_to_team_rosters` already snaps reads to the correct side's roster — keep, but call it per-track as soon as the player has a confirmed team (not only at end-of-loop), so subsequent OCR votes feed into the right roster immediately.
- Pass `team_assignment[tid]` into `jersey_tracker.update(...)` inside the main loop (currently always `team=None`).

### 5. Tighten the OCR-confidence threshold in the callback

`supabase/functions/analysis-callback/index.ts`:
- Drop the gating constant from `1.6` → `1.1` to match the new GPU threshold.
- Keep roster-link upsert into `track_player_mapping` as-is (already correct).

### 6. UI — no logic change required

`PlayerSpotlightPanel.tsx` and `useTrackLabels.ts` already show `#<number> Name` once `track_player_mapping` rows are linked. The 30-track plausibility cap from the last change stays. Result on this match: confirmed players (e.g. "#30 <player name>") will appear in the panel; the rest stay as `T<id>`.

---

## Technical notes

- Re-run path: after these changes ship, you click **Re-run analysis** on the Match page. The dev-tools "Re-trigger processing" button is fine too — both eventually hit `process-video` with the same source video.
- Cost: per-track HSV sampling is cheap (a few HSV conversions per ~30 frames), no extra YOLO passes.
- Failure mode: if jersey clustering produces only one colour (e.g. one team off-camera for the whole sample window), we fall back to the X-split classifier and log a warning.
- No DB migrations. Only `matches.home_color` is updated for this one match via SQL.

## Files touched

- `supabase/functions/process-video/index.ts` — forward team colours.
- `supabase/functions/analysis-callback/index.ts` — lower OCR confidence gate; drop `is_home` flip (A=home).
- `gpu-server/handler.py` — HSV-based team classifier, sample torso HSV in loop, pass team into jersey OCR, call `restrict_to_team_rosters` per-track.
- `gpu-server/jersey_ocr.py` — looser thresholds + back band + per-track snap.
- One-off SQL: `UPDATE matches SET home_color='#dc2626' WHERE id='bd76f2a1-...';`
