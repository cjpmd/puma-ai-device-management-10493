## Goal
Make `/matches/bd76f2a1-cf46-46d4-81e4-3cf9738c6336` render consistently and show the processed match video with controls when analysis has finished.

## Plan
1. **Stabilize the match detail screen so it stops feeling blank/inconsistent**
   - Keep the match shell rendered even while polling refreshes background data.
   - Prevent the cinema area from silently disappearing when a completed job has no playable video yet.
   - Show a clear fallback state in the match page when analysis data exists but no saved video asset is available.

2. **Fix the backend output-writing mismatch that is dropping the video path**
   - Review the two callback paths that finish jobs: `runpod-webhook` and `analysis-callback`.
   - Standardize how completed jobs store:
     - final video path
     - highlights path
     - metadata path
     - final status value
   - Make sure the analysis completion path writes the playable output path into the processing row when RunPod returns it.

3. **Align the frontend with the actual job model**
   - Update the match page selectors so it uses the newest job that is both completed and playable, instead of assuming the latest completed row always has a video.
   - Update the cinema player/output viewer to surface a useful state when the backend has finished analysis but the video asset is still missing.
   - Keep controls visible whenever a valid video URL is available.

4. **Add targeted diagnostics for this flow**
   - Add lightweight logging around video URL resolution and completed-job selection so future failures are visible instead of presenting as a blank area.
   - Avoid repeated retries against missing optional resources.

5. **Validate against this exact match**
   - Re-check the `processing_jobs` row for `bd76f2a1-cf46-46d4-81e4-3cf9738c6336`.
   - Confirm the page stays rendered on reload.
   - Confirm the cinema video appears when a playable output path exists, and that the controls render on top of the player.

## What I found
- The route is not consistently failing at app boot anymore.
- The concrete video issue is that this match’s latest completed processing row has **no `output_video_path` saved**, so the cinema player never mounts.
- `get-output-url` also confirms that no completed job currently has a video output for this match.
- The likely root cause is a mismatch between the completion callbacks:
  - `runpod-webhook` writes `output_video_path`
  - `analysis-callback` marks jobs completed and writes analytics data, but this path can finish without saving a playable video path
- That leaves the UI in a misleading state: processing looks complete, but there is nothing the player can load.

## Technical details
**Files likely involved**
- `src/pages/MatchDetail.tsx`
- `src/hooks/useMatchPolling.ts`
- `src/components/Matches/Cinema/CinemaVideoPlayer.tsx`
- `supabase/functions/get-output-url/index.ts`
- `supabase/functions/runpod-webhook/index.ts`
- `supabase/functions/analysis-callback/index.ts`

**Key fix direction**
- Unify job completion semantics so a finished analysis job either:
  - has a saved playable video path, or
  - is clearly represented in the UI as analytics-only with no video available.

If you approve, I’ll implement this fix path now.