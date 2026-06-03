## Goal

Lift goals/shots/passes accuracy and per-player attribution to a level coaches trust, without training new ML models. Every change measured against a ground-truth match.

## Guiding principles

1. **Measure before changing.** No tuning lands without a before/after accuracy delta against a labelled match.
2. **Heuristics + geometry only.** No new model training. Tune thresholds, add pitch-aware rules, lean on the existing YOLOv8 + ByteTrack + EasyOCR stack.
3. **Coach-in-the-loop wins.** Where vision is unreliable (jersey OCR, goal confirmation), make it trivially fast for a coach to correct in the UI and feed corrections back as ground truth.
4. **Ship one phase, validate, then proceed.** Each phase is independently shippable.

---

## Phase 0 — Ground truth & evaluation harness (foundation)

Without this, every later phase is guesswork.

- Pick the one tagged match as the **benchmark match**. Store its ground-truth events (goals, shots, passes per team, per-player touches) in a new `match_ground_truth` table.
- Build an in-app **Tagging Mode** on the cinema player: scrub video, click event type, optionally tag player. Stores to `match_ground_truth`.
- Build an **Accuracy Report** view: for any processed match that has ground truth, show precision/recall per event type, per-team totals delta, per-player touch delta. One screen, one number per metric.
- Add a CLI script `gpu-server/eval.py` that re-runs analytics over a cached video + ground-truth JSON and prints the same accuracy table — so we can iterate on heuristics locally without re-uploading.

**Exit criteria:** baseline accuracy numbers for the benchmark match are recorded.

---

## Phase 1 — Per-player identity (jersey numbers)

Biggest unlock for Spotlight/per-player analytics. No model training.

- **Higher-resolution OCR crops.** Today crops are taken from the downscaled analysis frame. Cache the original-resolution frame for the same timestamp and OCR against that for jersey reads only.
- **Roster-constrained voting.** `JerseyNumberTracker` currently accepts any 1–2 digit reading. Constrain `allowlist` and post-filter to numbers present on the match roster (from `players.squad_number` for the team). Drop nonsense readings before they're counted.
- **Lower `MIN_CONFIRMATIONS` with weighted votes.** Weight readings by EasyOCR confidence (already returned with `detail=1`) and confirm when weighted score crosses threshold. Currently equal-weight votes throw away signal.
- **Track-ID merging.** ByteTrack frequently fragments one player into multiple IDs across occlusions. Add a post-pass: if two confirmed tracks share the same jersey number AND don't overlap in time AND are on the same team, merge their metrics.
- **UI: bulk-correct mapping.** Improve `track_player_mapping` UI to show jersey thumbnail crops next to each unassigned track — coach assigns 14 players in under a minute. Save correction to ground truth.

**Exit criteria:** ≥80% of on-pitch tracks correctly mapped to roster players on benchmark match.

---

## Phase 2 — Event accuracy (passes, shots, goals)

- **Pitch-aware shot detection.** Today `touch_tracker.py` calls anything ≥12 m/s a shot. Add a geometric gate: outbound ball trajectory must intersect a region within X metres of the opponent goal mouth (use existing pitch calibration / homography). Cuts false-positive shots from long clearances.
- **Goal detection rule.** No current goal logic. Add: shot event + ball position crosses goal-line polygon within N frames + ball decelerates sharply (net) → emit `goal` event. Coach can confirm/reject in cinema timeline.
- **Pass success.** `pass_analyser.py` exists; verify it uses next-touch-same-team logic and tune `PASS_SPEED_MS` / `RECEIVE_SPEED_MS`. Add minimum displacement filter to suppress micro-touches counted as passes.
- **Dribble overcount fix.** `TouchTracker` doc admits dribble overcounting. Increase `DRIBBLE_GAP_S` and require ball *displacement* (not just elapsed time) before emitting next dribble touch.
- **Header / aerial recovery.** Track ball loss/recovery: when ball detection drops for <0.8s then reappears near a player, emit a probable `aerial` touch.

Each change validated against benchmark numbers from Phase 0.

**Exit criteria:** event precision/recall ≥75% on benchmark match for shots and passes; goals require coach confirmation but auto-detection recall ≥70%.

---

## Phase 3 — Ball, possession, team assignment

- **Ball tracking audit.** Inspect `ball_tracking_data.detection_stages` on benchmark match to quantify ball-visible % per minute. If <60%, raise YOLO ball-class confidence threshold downward and add a Kalman-filter smoothing pass on detected positions to bridge short gaps.
- **Possession model.** Emit a `possession_team` channel per frame: the team of the player closest to the ball within `TOUCH_RADIUS_M * 2`. Use to compute `possession_pct` properly (today's value is heuristic).
- **Team assignment robustness.** Improve kit-colour clustering: sample colours only from torso region (not full bbox), exclude pixels classified as grass/skin, exclude keeper (manual flag from coach). Currently `referee_filter.py` is the only filter.

**Exit criteria:** ball-visible ≥70%, possession totals within 10% of ground truth.

---

## Phase 4 — Cinema UI feedback loop

Make every analytics output **easy for the coach to correct**, and persist corrections as ground truth for the next iteration:

- Cinema timeline events get an "edit/delete/reassign player" affordance.
- Spotlight player picker gets quick "this isn't player #7" correction.
- All corrections write to `match_ground_truth` — so each tagged match grows the benchmark set.

---

## Out of scope (explicitly)

- Training ReID models, fine-tuning event classifiers, SoccerNet integration — all parked unless heuristics + tuning plateau below acceptable accuracy after Phase 2.
- GPS fusion — not in scope (no devices).
- Real-time/live analytics — post-match only, same as today.

---

## Technical notes

- Schema changes are minimal: one `match_ground_truth` table + a `merged_into_track_id` nullable column on whatever surfaces tracks.
- All Phase 1–3 work is in `gpu-server/` Python with no new dependencies (EasyOCR already present, no model downloads).
- Re-evaluation loop runs locally via `eval.py` — RunPod GPU time only consumed when we want a full fresh end-to-end run.

---

## Suggested order to execute

1. Phase 0 first (this is the unlock for everything).
2. Phase 1 next — biggest perceived value (Spotlight starts working).
3. Phase 2 — make timeline trustworthy.
4. Phase 3 — lift the floor.
5. Phase 4 — close the loop so future matches keep improving.

Ready to proceed with **Phase 0** on approval.