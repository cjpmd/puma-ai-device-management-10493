# AI Video Analysis Pipeline — Findings & Improvements

Investigation + fixes for the three confirmed pain points, June 2026.
Scope: `gpu-server/` (RunPod worker, endpoint uh6tok74gjrg3b, image
`chrisjpmcdonald/origin-sports-analysis:latest`) and the Supabase edge
functions `process-video` / `analysis-callback`.

---

## Pain point 1 — Player tracking (lost IDs / ID switches)

### Root causes found

1. **The BoT-SORT path never ran.** `handler.py` tried `sv.BotSort(...)` —
   that class does not exist in the `supervision` library (the kwargs used
   belong to the `boxmot` package). The `except` swallowed the error and
   every production run silently used ByteTrack with no re-ID.
2. **ByteTrack is IoU-only and the pipeline analyses at 2–5 fps.** At that
   rate a running player moves further than his own bounding-box width
   between analysed frames, so box overlap is ~0 and association fails —
   the direct cause of the "hundreds of fragment tracks" the downstream
   ghost-filter and jersey-dedupe code already apologise for.
3. **No camera-motion compensation.** VEO pan/zoom shifts every box between
   frames, breaking the static-camera assumption baked into IoU matching.
4. **No appearance model anywhere** — once a track died, nothing could ever
   reconnect it to the same player.
5. **Fragile OCR/HSV association**: tracker output was re-matched to raw
   detections by centroid distance < 20 px, silently dropping players.
6. **Team assignment**: hue-only nearest-kit matching breaks on achromatic
   kits (white/grey/black have no stable hue), and every track — referee,
   GK, ball boys — was force-assigned to the nearest team.

### Implemented (gpu-server/tracking.py, handler.py)

- **BoT-SORT via `boxmot`** with OSNet re-ID (`osnet_x0_25`, ~3 MB — far
  inside RTX 3090/A5000 headroom next to YOLOv8m) and camera-motion
  compensation (sparse optical flow / ECC) for VEO footage. Weights are
  fetched at container startup and cached in `/app/weights`, not bundled.
- **Tuned ByteTrack fallback** when boxmot is unavailable: correct
  `frame_rate` for the analysed fps, 30 s lost-track buffer, activation
  threshold 0.35, single-frame ghost suppression.
- **Online re-association layer** (backend-independent re-ID fallback):
  a brand-new tracker ID appearing near the velocity-predicted position of
  a recently lost track, with a compatible torso colour, is aliased back to
  the old ID. Ambiguous matches (two plausible candidates) are never merged.
- **Jersey OCR vote merging across track merges** (`remap_tracks`) so
  identity evidence survives fragmentation.
- **OCR/HSV now read directly from tracker output boxes** — the centroid
  re-matching loop is gone.
- **Team separation**: kit distance now uses saturation/value when either
  colour is achromatic; tracks matching *neither* kit stay unassigned
  (referee/GK/bystanders) instead of polluting a team. Assignment is
  computed once per track from whole-match median HSV, so it cannot flip
  mid-match.
- **Multi-camera fusion** (`multicam.py`, opt-in via
  `enable_multicam_fusion`): audio cross-correlation start-offset
  estimation, projection of both cameras' tracks into pitch metres via
  each view's homography, Hungarian assignment on time-binned pitch
  proximity (gated at 4 m), then cross-view OCR vote pooling and goal
  corroboration. Off by default — it roughly doubles GPU time.
- **Structured logging** (`tracking_metrics`, persisted on
  `processing_jobs.tracking_metrics`): tracks created, re-associations,
  track-loss events, short-track fraction (fragmentation proxy), average
  track length, backend in use.

---

## Pain point 2 — Jersey OCR (wrong numbers / misreads)

### Root causes found

1. General-purpose EasyOCR on tiny torso crops — 1↔7, 6↔8, 0↔8 confusions
   on blurred/curved shirts dominate the error budget.
2. No motion-blur gating: blurred frames produced confident garbage that
   polluted the vote tally.
3. Output space unconstrained: `0` and digit pairs inside longer garbage
   strings were accepted.
4. Weak confirmation: Σ-confidence ≥ 1.1 (~2 reads) could lock a wrong
   number, with no distinct-frame consistency requirement.
5. No specialist digit classifier, no multi-view pooling.

### Implemented (gpu-server/jersey_ocr.py, digit_classifier.py)

- **SVHN-style digit classifier** (two heads: tens-or-blank + units →
  numbers 1–99 by construction). Fine-tuned weights are fetched at startup
  from `JERSEY_DIGIT_MODEL_URL` and cached; without weights the pipeline
  transparently falls back to EasyOCR, so this ships safely ahead of the
  training run. Classifier votes are weighted 1.25× EasyOCR votes.
- **Blur gating**: Laplacian-variance per crop (`OCR_BLUR_MIN_VAR`, default
  60); blurred crops are skipped so the previous confident reading stands.
- **Preprocessing**: upscale → CLAHE → unsharp (kept), plus an
  Otsu-binarised second pass when the first read yields nothing; crop
  bands trimmed 15 % per side to exclude arms/background.
- **Hard output constraint**: standalone 1–2 digit string, value 1–99.
- **Stricter temporal voting**: confirmation requires Σ-confidence ≥ 1.5,
  a 0.5 lead over the runner-up, **and** ≥ 3 distinct-frame reads of the
  winning number. (The brief suggests N=5 consecutive frames; reads here
  are sampled every 4–12 frames per track, so 3 *distinct sampled frames*
  spans an equivalent or longer real-time window.) Confirmed tracks are
  locked — OCR stops, flip-flopping is impossible, GPU cost drops.
- **Multi-view pooling** (`merge_scores_from`): with multicam fusion on,
  OCR votes from the second camera are pooled per reconciled identity
  before confirmation.
- **Structured logging** (`ocr_metrics`, persisted on
  `processing_jobs.ocr_metrics`): lock rate, per-track confidence
  histogram, blur skips, range/confidence rejections, classifier-vs-EasyOCR
  read counts.

---

## Pain point 3 — Goal detection

### Root causes found

1. **There was no goal detector.** "Goal" was a side-effect of the shot
   heuristic: a single frame with ball-x within 1.5 % of the *panorama
   edge* while fast. Goals are not at the frame edge on VEO or single
   iPhone views; no goal localisation, trajectory, or multi-frame
   confirmation existed; the ball disappearing into the net (the most
   common goal signature) silently defeated it.
2. **No goal event could ever reach the app**: `analysis-callback` only
   writes `match_event_tags` for events with `source === "cv"` and
   `confidence >= 0.7` — fields the GPU worker never emitted. Zero CV
   events of any kind have ever been tagged in production.

### Implemented (gpu-server/goal_detector.py, handler.py, analysis-callback)

- **Goal-mouth localisation via the existing pitch homography**: ball
  position is projected to pitch metres and tested against a 7.32 m goal
  mouth (±1 m calibration margin) on each goal line. Calibration-free
  fallback: narrow edge bands within a plausible vertical band.
- **Trajectory state machine** per goal side:
  `IDLE → BALL_APPROACHING → BALL_IN_GOAL_ZONE → GOAL_CONFIRMED`,
  confirming after M consecutive analysed frames in the zone (~0.8 s) or
  zone entry followed by sustained detection loss with goal-ward velocity
  (ball-in-net occlusion). Zone entry followed by a quick exit is logged as
  a **rejected** candidate (save/corner/clearance). 8 s cooldown prevents
  net-bounce duplicates.
- **Confidence model** combining trajectory alignment, dwell, hard YOLO
  detections inside the zone, and an **audio reaction spike** (one cheap
  ffmpeg pass → 100 ms RMS envelope; a ≥1.5× baseline spike within 3 s of
  zone entry raises confidence — the optional audio enhancement, included
  because it costs seconds per match).
- **Multi-camera corroboration**: with fusion enabled, a candidate seen in
  both views (sync-offset corrected, ±3 s) gets a confidence boost; single
  -camera matches still confirm on their own evidence, since usually only
  one camera covers each end.
- **Events now carry `source: "cv"` and `confidence`** (all event types),
  so the existing callback tagging path finally fires; confirmed goals are
  emitted as `type: "goal"` events at ≥ 0.7 confidence and map to the
  existing `goal` tag. Scorer attribution = last touch within 5 s before
  the crossing; scorer's `player_match_stats.goals` is now populated.
- **Structured logging**: every candidate (confirmed/candidate/rejected) is
  logged and persisted to the new `goal_events` table with timestamp,
  camera view, confidence and evidence.

### Considered, not adopted

- **TrackNetV2/MonoTrack**: the existing 3-stage ball pipeline
  (YOLO → motion fallback → constant-acceleration Kalman) already covers
  occlusion prediction; a specialist ball model is the right next step if
  the new `goal_events` logs show recall is limited by ball detection
  rather than goal logic. Re-evaluate with production data.
- **PaddleOCR/TrOCR**: heavyweight additions; the digit classifier +
  constrained EasyOCR ensemble targets the same failure mode at a fraction
  of the image size / VRAM.

---

## Schema & interface changes

- Migration `supabase/migrations/20260611100000_goal_events_quality_metrics.sql`:
  - `processing_jobs.tracking_metrics JSONB`, `processing_jobs.ocr_metrics JSONB`
  - new `goal_events` table (RLS mirroring `player_match_stats`)
- `analysis-callback`: persists the new fields, upserts `goal_events`
  rows, writes real `goals` into `player_match_stats`. All additions are
  optional-field reads — fully backward compatible with old workers.
- `process-video`: forwards optional `enable_multicam_fusion`.
- Worker result payload adds `goal_events`, `goals_confirmed`,
  `tracking_metrics`, `ocr_metrics`, `multicam` — additive only.
- Docker image must be rebuilt and pushed:
  `docker build -f gpu-server/Dockerfile -t chrisjpmcdonald/origin-sports-analysis:latest . && docker push chrisjpmcdonald/origin-sports-analysis:latest`

New environment variables (all optional):

| Variable | Purpose | Default |
| --- | --- | --- |
| `MODEL_WEIGHTS_DIR` | weight cache dir | `/app/weights` |
| `JERSEY_DIGIT_MODEL_URL` | fine-tuned digit CNN weights | unset → EasyOCR only |
| `OCR_BLUR_MIN_VAR` | blur-gate threshold | `60` |
| `DISABLE_BOTSORT` | force ByteTrack fallback (`1`) | unset |

---

## Testing checklist (against sample footage)

### Tracking
- [ ] Worker logs `✓ BoT-SORT (boxmot) initialised` (not the ByteTrack
      fallback) on the RunPod worker after image rebuild.
- [ ] VEO clip with a hard pan: `tracking_metrics.tracks_created` drops
      vs. the previous build on the same clip; no burst of new IDs during
      the pan.
- [ ] Crowded penalty box (corner kick): players keep IDs through the
      scramble; `reassociations > 0` indicates healed fragments.
- [ ] Player walks out of frame and returns within 30 s (substitution
      warm-up, throw-in retrieval): same ID resumes.
- [ ] `short_track_fraction` < 0.5 on a full match (was effectively >0.9
      with hundreds of fragments).
- [ ] White-vs-dark-kit fixture: team assignment is stable for the whole
      match; referee and GKs appear with `team: null`, not on a team.
- [ ] Two-iPhone match with `enable_multicam_fusion: true`: log shows
      sync offset close to the known start gap (±0.2 s) and ≥ 10
      reconciled identities; result payload `multicam.reconciled_tracks`.

### Jersey OCR
- [ ] `ocr_metrics.lock_rate` ≥ 0.5 on a match with legible numbers, and
      every locked number exists on the actual roster.
- [ ] Sprinting player (motion blur): `blur_skips > 0` and no number flip
      on that track.
- [ ] No `jersey_number` outside 1–99 anywhere in `player_match_stats`.
- [ ] A track locked early keeps the same number for the whole match
      (locking stops further OCR — verify via `ocr_attempts` plateau).
- [ ] With `JERSEY_DIGIT_MODEL_URL` set: `digit_cls_reads > 0` and
      misread rate on a labelled clip improves vs. EasyOCR-only run.
- [ ] Multicam run: a player whose number is only readable from camera B
      still gets identified on camera A's canonical track.

### Goal detection
- [ ] Clip with N known goals: N `goal_events` rows with
      `status='confirmed'` at the right timestamps (±2 s), each with a
      `match_event_tags` row of `event_type='goal'`.
- [ ] Shot saved on the line / corner won: appears as `status='rejected'`
      (via `exit`), NOT confirmed.
- [ ] Goal where the ball disappears into the side netting: confirmed via
      `disappearance`.
- [ ] Goal with audible celebration: `corroboration.audio_spike` > 0.5;
      silent training-ground goal still confirms (audio is additive only).
- [ ] Two-camera match: goal at the end covered by both cameras gets
      `corroborated_by: "secondary"` and boosted confidence.
- [ ] Scorer attribution: `player_match_stats.goals` totals match the real
      scoreline for identified players.

### Regression / interface
- [ ] `job_type: "analyse"` round-trip completes end-to-end: process-video
      → RunPod → analysis-callback → `processing_jobs.status='complete'`
      with old fields (events, player_metrics, team_stats, heatmaps)
      unchanged in shape.
- [ ] Old worker image + new edge functions: callback still succeeds
      (new fields all null-coalesced).
- [ ] follow_cam job type still renders (PlayerTracker import path).
- [ ] GPU memory on RTX 3090/A5000: peak VRAM with YOLOv8m + OSNet x0_25 +
      EasyOCR stays well under 24 GB (expect < 6 GB).
