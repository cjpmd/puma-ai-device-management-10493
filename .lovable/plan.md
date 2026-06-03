## Why "6166 players" and wrong shirt numbers happen

Two independent bugs, both in the GPU pipeline output the UI just renders verbatim:

1. **Track-count explosion.** `PlayerSpotlightPanel` shows `trackIds.length` — every distinct `player_metrics` key plus every `player_track_id` seen in `events`. The GPU emits one entry **per ByteTrack ID**, and ByteTrack on grassroots footage routinely fragments a single player into hundreds of short tracks (occlusion, jersey blur, panorama re-stitch every 500 frames). With `MetricsAggregator.compute` keeping any track with ≥5 positions (~2.5s at 2fps), you can easily get thousands of "players". 6166 is just the count of fragments, not people.
2. **Wrong shirt numbers.** OCR currently votes per fragment, so most tracks never accumulate enough confidence to confirm a number and the few that do are read once from a single noisy band. After per-team snap we still let any single OCR pass win, and the UI happily shows `#3` for a fragment that was actually nothing.

## Plan

### 1. Stop counting fragments as players (GPU side)

In `gpu-server/handler.py` `MetricsAggregator.compute` and the post-merge in `run_analysis`:

- Replace the `len(positions) < 5` filter with a **real-player gate** before emitting a `player_metrics` row:
  - `len(positions) >= max(30, fps * 8)` (≥8s on pitch), AND
  - `distance_m >= 5`, AND
  - track is not in `referee_track_ids`, AND
  - track has a `team` assignment.
- Add a hard cap: keep at most the top **30** tracks by `minutes_played` (22 starters + subs buffer) before scoring. Drop the rest from `player_metrics`, `events` (rewrite `player_track_id` to `None` on dropped ids), `heatmaps`, and pass-network nodes.
- **Dedupe fragments by jersey + team:** once `jersey_tracker.confirmed_identities()` + `best_guess_identities()` are merged, group tracks sharing `(team, jersey_number)` and pick the longest-lived one as canonical. Re-emit metrics for the canonical id only (sum `distance_m`, `sprints`, touches across fragments).
- Log the surviving count: `print(f"✓ {len(player_metrics)} real players after fragment dedupe (from {raw} raw tracks)")`.

### 2. Tighten OCR so numbers we show are trustworthy

In `gpu-server/jersey_ocr.py`:

- Raise the bar: `CONFIRM_VOTE_SCORE = 2.5`, `CONFIRM_VOTE_LEAD = 1.0`. Drop the flipped-crop pass for digits — it doubles noise on numerals (digits aren't horizontally symmetric).
- Add a **per-confirmation minimum frames seen**: don't confirm a track unless `_frame_counts[track_id] >= 30` (~6 OCR passes at the near cadence). Prevents single-frame lucky reads.
- In `restrict_to_team_rosters`, after snapping, also enforce **roster exclusivity per team**: if two tracks on the same team both confirm to jersey `#9`, keep only the higher-scoring one; demote the loser to `best_guess` (UI will render `T<id>`).
- Surface only confirmed identities to `player_metrics.jersey_number`. Keep `jersey_number_guess` / `jersey_confidence` separate (already there) so the UI can decide.

### 3. UI: only label confirmed jerseys, count real players

- `useTrackLabels.ts`: prefer roster-linked mapping; fall back to `jersey_number` ONLY if `confidence >= 2.5` (so guesses don't appear as `#3`). Otherwise show `T<id>`. Add a `confirmed` flag on `TrackLabel` so panels can render confirmed numbers in solid pills and guesses in dashed/muted pills.
- `PlayerSpotlightPanel.tsx`: change the badge to count **distinct labels** rather than `trackIds.length`:
  - `labelled = trackIds.filter(id => mapping[id]?.squad_number).length`
  - Badge: `{labelled} identified · {trackIds.length} tracked` (and cap displayed pills at the top 30 by sort metric).
- `PassNetworkPanel.tsx`: hide nodes whose `jersey_number == null` AND `pass_count < 3` (kills phantom nodes from fragment tracks).
- `ClipsPanel.tsx`: already uses `labelFor` — picks up the stricter labelling automatically.

### 4. analysis-callback adjustments

In `supabase/functions/analysis-callback/index.ts`:

- When upserting `track_player_mapping`, **skip rows with no `jersey_number`** (we already do) and additionally skip rows where `pm.jersey_confidence < 2.5`.
- When upserting `player_match_stats`, only write `jersey_number` if confirmed (i.e. `pm.jersey_number != null`), leaving guesses out of the canonical stats table.

### 5. Re-run

After deploy, re-trigger processing on match `bd76f2a1…` via Developer Controls. Expected output: ~20–30 player metric sets, badge reads e.g. "14 identified · 24 tracked", spotlight pills show real `#7 J. Smith` for roster matches and `T1234` for unidentified.

## Out of scope

- Manual track → player assignment UI (asked separately; flagged for a follow-up).
- Switching ByteTrack for a re-ID model (bigger change; dedupe by jersey + team is the cheap fix that recovers most of the win).
- Cross-match player identity.

## Files touched

- `gpu-server/handler.py` (filter + dedupe + per-canonical merge)
- `gpu-server/jersey_ocr.py` (thresholds, exclusivity, min frames, drop flip)
- `src/components/Matches/Cinema/useTrackLabels.ts`
- `src/components/Matches/Cinema/PlayerSpotlightPanel.tsx`
- `src/components/Matches/Cinema/PassNetworkPanel.tsx`
- `supabase/functions/analysis-callback/index.ts`