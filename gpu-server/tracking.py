"""
tracking.py — football-tuned player tracking with re-identification.

ROOT CAUSE FINDINGS (Pain point 1 — lost IDs / ID switches)
-----------------------------------------------------------
1. `sv.BotSort` does not exist in the `supervision` library. The previous
   PlayerTracker's try-block always raised and silently fell back to
   ByteTrack — the "BoT-SORT with re-ID" path never ran in production.
   (The kwargs used — track_high_thresh, new_track_thresh, cmc — belong to
   the `boxmot` library's BotSort, not supervision.)
2. ByteTrack is IoU-only. At the analysed 2–5 fps, players move more than
   their own bounding-box width between analysed frames, so IoU between
   consecutive boxes is ~0 and association fails constantly → hundreds of
   fragment tracks per match (already acknowledged by the downstream
   "ghost track filter" and jersey-number dedupe).
3. No camera-motion compensation: VEO pan/zoom footage violates the static
   camera assumption, shifting every box and breaking IoU association.
4. No appearance model anywhere — a lost player can never be re-associated.

FIX IMPLEMENTED
---------------
* Primary backend: boxmot BoT-SORT with OSNet re-ID (osnet_x0_25, ~3MB,
  negligible VRAM next to YOLOv8m) and camera-motion compensation (sparse
  optical flow / ECC) — handles VEO pan/zoom and occlusion re-entry.
  Weights are fetched at container startup and cached (not bundled).
* Fallback backend: supervision ByteTrack with football-tuned parameters
  (correct frame_rate for the analysed fps, 30s lost-track buffer,
  lower activation threshold so distant small players keep their tracks).
* Online re-association layer (backend-independent): when the backend
  spawns a brand-new ID near the predicted position of a recently-lost
  track with a compatible torso colour, the new ID is aliased to the old
  one. This is the "re-ID fallback when ByteTrack loses a track" and uses
  jersey colour as the secondary signal.
* Structured tracking-quality metrics (track births, re-associations,
  fragmentation rate, track-loss events) exported per match so accuracy
  improvements are measurable in production.
"""

from __future__ import annotations

import inspect
import os
from collections import deque

import numpy as np

try:
    import supervision as sv
except Exception:  # pragma: no cover
    sv = None

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

WEIGHTS_DIR = os.environ.get("MODEL_WEIGHTS_DIR", "/app/weights")
REID_WEIGHTS_NAME = os.environ.get("REID_WEIGHTS_NAME", "osnet_x0_25_msmt17.pt")

# ── Re-association gates (fractions of frame width so they scale with input) ──
REASSOC_MAX_GAP_S = 8.0      # max seconds a track may be lost and still re-claimed
REASSOC_BASE_FRAC = 0.025    # base radius as fraction of frame width
REASSOC_MAX_FRAC = 0.12      # cap radius as fraction of frame width
REASSOC_HUE_MAX = 25.0       # max circular hue distance between torso samples
REASSOC_AMBIGUITY = 0.8      # 2nd-best must be > best/0.8 away or we skip (ambiguous)


def _import_botsort():
    """boxmot renamed its classes across major versions; try both."""
    try:
        from boxmot import BotSort
        return BotSort
    except Exception:
        pass
    try:
        from boxmot import BoTSORT
        return BoTSORT
    except Exception:
        return None


def prefetch_reid_weights() -> str | None:
    """Download + cache the OSNet re-ID weights at container startup.
    boxmot downloads to the given path on first construction; we trigger it
    eagerly so the first job doesn't pay the latency. Safe no-op offline."""
    try:
        os.makedirs(WEIGHTS_DIR, exist_ok=True)
        path = os.path.join(WEIGHTS_DIR, REID_WEIGHTS_NAME)
        if os.path.exists(path):
            return path
        BotSort = _import_botsort()
        if BotSort is None:
            return None
        import torch
        from pathlib import Path
        # Constructing the tracker on CPU triggers boxmot's weight download
        sig = inspect.signature(BotSort.__init__)
        kwargs = {}
        if "reid_weights" in sig.parameters:
            kwargs["reid_weights"] = Path(path)
        if "device" in sig.parameters:
            kwargs["device"] = torch.device("cpu")
        if "half" in sig.parameters:
            kwargs["half"] = False
        BotSort(**kwargs)
        return path if os.path.exists(path) else None
    except Exception as exc:
        print(f"⚠ re-ID weight prefetch failed (will retry lazily): {exc}")
        return None


def _build_botsort(analysed_fps: float):
    """Construct a boxmot BoT-SORT tracker with football-tuned parameters.
    Returns None if boxmot is unavailable or construction fails."""
    BotSort = _import_botsort()
    if BotSort is None:
        return None
    try:
        import torch
        from pathlib import Path
    except Exception:
        return None

    use_cuda = False
    try:
        use_cuda = torch.cuda.is_available()
    except Exception:
        pass

    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    weights = Path(WEIGHTS_DIR) / REID_WEIGHTS_NAME

    desired = dict(
        reid_weights=weights,
        half=bool(use_cuda),
        per_class=False,
        # Football tuning:
        # - high thresh 0.45: YOLO confidence on distant players hovers ~0.4-0.6
        # - low thresh 0.1: keep occluded/blurred players in the 2nd association
        # - new_track_thresh 0.6: don't spawn ghost tracks from weak detections
        track_high_thresh=0.45,
        track_low_thresh=0.1,
        new_track_thresh=0.6,
        # 30 seconds of lost-track memory at the *analysed* frame rate —
        # players leaving frame on iPhone footage routinely re-enter within this
        track_buffer=int(max(30, analysed_fps * 30)),
        match_thresh=0.85,
        proximity_thresh=0.5,
        # Appearance gate: permissive enough for jersey-similar teammates to
        # still be separated by motion, strict enough to stop cross-team swaps
        appearance_thresh=0.3,
        frame_rate=max(1, int(round(analysed_fps))),
        with_reid=True,
        fuse_first_associate=True,
    )
    sig = inspect.signature(BotSort.__init__)

    # Camera-motion compensation for VEO pan/zoom: prefer sparse optical
    # flow (fast); name differs across boxmot versions.
    cmc_candidates = ["sof", "sparseOptFlow", "ecc"] if "cmc_method" in sig.parameters else [None]

    for device in ([torch.device("cuda:0"), "cuda:0"] if use_cuda else [torch.device("cpu"), "cpu"]):
        for cmc in cmc_candidates:
            kwargs = {k: v for k, v in desired.items() if k in sig.parameters}
            if "device" in sig.parameters:
                kwargs["device"] = device
            if cmc is not None:
                kwargs["cmc_method"] = cmc
            try:
                tracker = BotSort(**kwargs)
                print(f"✓ BoT-SORT (boxmot) initialised: reid={weights.name}, "
                      f"cmc={cmc}, device={device}, buffer={desired['track_buffer']}")
                return tracker
            except Exception as exc:
                last_err = exc
                continue
    print(f"⚠ BoT-SORT construction failed, falling back to ByteTrack: {last_err}")
    return None


def _build_bytetrack(analysed_fps: float):
    """supervision ByteTrack fallback, tuned for low analysed fps."""
    if sv is None:
        raise RuntimeError("supervision library not available")
    kwargs = dict(
        # 0.35 (was 0.45): distant players on 4K-downscaled grassroots footage
        # often detect at 0.35-0.45; losing them from the high-confidence pool
        # is the main cause of track churn in the old config.
        track_activation_threshold=0.35,
        lost_track_buffer=int(max(30, analysed_fps * 30)),
        minimum_matching_threshold=0.8,
        frame_rate=max(1, int(round(analysed_fps))),
    )
    try:
        # Suppress single-frame ghost tracks where supported (sv >= 0.21)
        return sv.ByteTrack(minimum_consecutive_frames=2, **kwargs)
    except TypeError:
        return sv.ByteTrack(**kwargs)


def _hue_distance(h1: float, h2: float) -> float:
    d = abs(h1 - h2) % 180.0
    return min(d, 180.0 - d)


def _torso_hue(frame: np.ndarray, x1: float, y1: float, x2: float, y2: float) -> float | None:
    """Median hue of the torso band with grass suppression. Cheap (~tiny crop)."""
    if cv2 is None or frame is None:
        return None
    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
    h, w = y2 - y1, x2 - x1
    if h < 24 or w < 10:
        return None
    crop = frame[y1 + int(h * 0.25): y1 + int(h * 0.55),
                 x1 + int(w * 0.15): x2 - int(w * 0.15)]
    if crop.size == 0:
        return None
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hch, sch, vch = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    keep = ~(((hch >= 35) & (hch <= 85) & (sch > 40)) | (vch < 30))
    if keep.sum() < 20:
        return None
    return float(np.median(hch[keep]))


class PlayerTracker:
    """
    Tracks players across frames with persistent IDs.

    Backend: boxmot BoT-SORT (OSNet re-ID + camera-motion compensation)
    when available, supervision ByteTrack otherwise. Both backends are
    wrapped by an online re-association layer that heals ID fragmentation.
    """

    def __init__(self, analysed_fps: float = 2.0, enable_reid: bool = True):
        self.analysed_fps = max(0.5, float(analysed_fps))
        self.tracker = None
        self._tracker_type = "none"

        if enable_reid and os.environ.get("DISABLE_BOTSORT") != "1":
            self.tracker = _build_botsort(self.analysed_fps)
            if self.tracker is not None:
                self._tracker_type = "botsort_reid"

        if self.tracker is None:
            self.tracker = _build_bytetrack(self.analysed_fps)
            self._tracker_type = "bytetrack_tuned"
            print(f"Using ByteTrack fallback (analysed_fps={self.analysed_fps:.1f}, "
                  f"buffer={int(max(30, self.analysed_fps * 30))} frames)")

        # track_id -> list of (frame_idx, cx, cy)
        self.tracks: dict[int, list] = {}

        # ── online re-association state ──
        self._alias: dict[int, int] = {}            # raw backend id -> canonical id
        self._velocity: dict[int, tuple[float, float]] = {}
        self._hue: dict[int, deque] = {}            # canonical id -> recent torso hues
        self._hue_counter: dict[int, int] = {}
        self._frame_w: int | None = None
        self._last_frame_idx: int = -1

        # ── structured quality metrics ──
        self.metrics = {
            "tracker_backend": self._tracker_type,
            "tracks_created": 0,
            "reassociations": 0,       # fragments healed by the re-ID fallback
            "track_loss_events": 0,    # tracks that went unseen > buffer
            "frames_processed": 0,
        }
        self._loss_counted: set[int] = set()

    # ── internal helpers ─────────────────────────────────────────────────

    def _canonical(self, raw_id: int) -> int:
        tid = raw_id
        while tid in self._alias:
            tid = self._alias[tid]
        return tid

    def _find_reassociation(self, cx: float, cy: float, frame_idx: int,
                            hue: float | None) -> int | None:
        """Match a brand-new backend ID against recently-lost canonical tracks.
        Tracks already updated this frame have gap == 0 and are excluded."""
        if self._frame_w is None:
            return None
        max_gap = max(2, int(REASSOC_MAX_GAP_S * self.analysed_fps))
        base_px = REASSOC_BASE_FRAC * self._frame_w
        cap_px = REASSOC_MAX_FRAC * self._frame_w

        best, best_d, second_d = None, float("inf"), float("inf")
        for tid, positions in self.tracks.items():
            last_f, lx, ly = positions[-1]
            gap = frame_idx - last_f
            if gap < 1 or gap > max_gap:
                continue
            vx, vy = self._velocity.get(tid, (0.0, 0.0))
            # Predict forward with decaying velocity
            decay = max(0.0, 1.0 - gap / (max_gap * 1.5))
            px, py = lx + vx * gap * decay, ly + vy * gap * decay
            d = float(np.hypot(cx - px, cy - py))
            speed = float(np.hypot(vx, vy))
            allow = min(cap_px, base_px + gap * max(base_px * 0.4, speed * 1.2))
            if d > allow:
                continue
            # Jersey-colour gate (secondary re-ID signal)
            if hue is not None and tid in self._hue and len(self._hue[tid]) >= 2:
                if _hue_distance(hue, float(np.median(self._hue[tid]))) > REASSOC_HUE_MAX:
                    continue
            if d < best_d:
                best, second_d, best_d = tid, best_d, d
            elif d < second_d:
                second_d = d
        if best is None:
            return None
        if second_d < float("inf") and best_d > second_d * REASSOC_AMBIGUITY:
            return None  # two plausible candidates → too risky to merge
        return best

    def _run_backend(self, person_dets: list, frame: np.ndarray | None) -> list:
        """Run the underlying tracker. Returns [(raw_id, cx, cy, x1, y1, x2, y2), ...]."""
        out = []
        if self._tracker_type == "botsort_reid":
            if frame is None:
                raise ValueError("BoT-SORT backend requires the frame image")
            dets = np.array(
                [[d[2], d[3], d[4], d[5], d[6], 0] for d in person_dets],
                dtype=np.float32,
            ) if person_dets else np.empty((0, 6), dtype=np.float32)
            tracked = self.tracker.update(dets, frame)
            for row in np.atleast_2d(np.asarray(tracked)):
                if row.shape[0] < 5:
                    continue
                x1, y1, x2, y2, tid = row[0], row[1], row[2], row[3], int(row[4])
                out.append((tid, (x1 + x2) / 2, (y1 + y2) / 2, x1, y1, x2, y2))
        else:
            if not person_dets:
                return []
            sv_detections = sv.Detections(
                xyxy=np.array([[d[2], d[3], d[4], d[5]] for d in person_dets]),
                confidence=np.array([d[6] for d in person_dets]),
            )
            tracked = self.tracker.update_with_detections(sv_detections)
            if tracked.tracker_id is not None:
                for i, tid in enumerate(tracked.tracker_id):
                    x1, y1, x2, y2 = tracked.xyxy[i]
                    out.append((int(tid), (x1 + x2) / 2, (y1 + y2) / 2, x1, y1, x2, y2))
        return out

    # ── public API ───────────────────────────────────────────────────────

    def update_from_detections(self, person_dets: list, frame_idx: int,
                               frame: np.ndarray | None = None) -> list:
        """
        Process pre-parsed person detections for one frame.
        person_dets: [(cx, cy, x1, y1, x2, y2, conf, cls_name), ...]
        Returns [(track_id, cx, cy, x1, y1, x2, y2), ...] with canonical IDs.
        """
        self.metrics["frames_processed"] += 1
        if frame is not None and self._frame_w is None:
            self._frame_w = frame.shape[1]
        if self._frame_w is None and person_dets:
            self._frame_w = int(max(d[4] for d in person_dets))  # rough lower bound

        try:
            raw = self._run_backend(person_dets, frame)
            self._backend_errors = 0
        except ValueError:
            raise
        except Exception as exc:
            print(f"⚠ tracker backend error on frame {frame_idx}: {exc}")
            self._backend_errors = getattr(self, "_backend_errors", 0) + 1
            # A broken boxmot backend (runtime API drift) must not silently
            # produce an empty match — hot-swap to the ByteTrack fallback.
            if self._tracker_type == "botsort_reid" and self._backend_errors >= 3:
                print("⚠ BoT-SORT failing repeatedly — switching to ByteTrack fallback")
                self.tracker = _build_bytetrack(self.analysed_fps)
                self._tracker_type = "bytetrack_tuned"
                self.metrics["tracker_backend"] = self._tracker_type
            return []

        results_out = []
        active_now: set[int] = set()

        for raw_id, cx, cy, x1, y1, x2, y2 in raw:
            tid = self._canonical(raw_id)
            is_new = tid not in self.tracks

            hue = None
            if frame is not None:
                # Sample torso colour sparsely — every 8th update per track
                cnt = self._hue_counter.get(tid, 0)
                if is_new or cnt % 8 == 0:
                    hue = _torso_hue(frame, x1, y1, x2, y2)
                self._hue_counter[tid] = cnt + 1

            if is_new:
                match = self._find_reassociation(cx, cy, frame_idx, hue)
                if match is not None:
                    self._alias[raw_id] = match
                    tid = match
                    self.metrics["reassociations"] += 1
                else:
                    self.metrics["tracks_created"] += 1

            positions = self.tracks.setdefault(tid, [])
            if positions:
                last_f, lx, ly = positions[-1]
                gap = max(1, frame_idx - last_f)
                self._velocity[tid] = ((cx - lx) / gap, (cy - ly) / gap)
            positions.append((frame_idx, float(cx), float(cy)))
            active_now.add(tid)

            if hue is not None:
                self._hue.setdefault(tid, deque(maxlen=6)).append(hue)

            results_out.append((tid, cx, cy, x1, y1, x2, y2))

        # Track-loss accounting: a track unseen for > buffer is a loss event
        buffer_frames = int(max(30, self.analysed_fps * 30))
        for tid, positions in self.tracks.items():
            if tid in self._loss_counted or tid in active_now:
                continue
            if frame_idx - positions[-1][0] == buffer_frames:
                self.metrics["track_loss_events"] += 1
                self._loss_counted.add(tid)

        self._last_frame_idx = frame_idx
        return results_out

    def get_metrics(self) -> dict:
        """Structured tracking-quality metrics for production monitoring."""
        lengths = [len(p) for p in self.tracks.values()]
        m = dict(self.metrics)
        m.update({
            "total_tracks": len(self.tracks),
            "avg_track_length_frames": round(float(np.mean(lengths)), 1) if lengths else 0,
            "median_track_length_frames": float(np.median(lengths)) if lengths else 0,
            # Fragmentation proxy: with ~22 players + officials on pitch, every
            # track beyond ~30 represents a lost ID that had to be re-created
            "short_track_fraction": round(
                sum(1 for n in lengths if n < 10) / max(1, len(lengths)), 3),
        })
        return m

    def get_track_summary(self, fps: float) -> list:
        """Summarised per-player tracks for metadata output."""
        summaries = []
        for track_id, positions in self.tracks.items():
            if len(positions) < 5:
                continue
            frames = [p[0] for p in positions]
            xs = [p[1] for p in positions]
            ys = [p[2] for p in positions]
            total_dist = sum(
                np.sqrt((xs[i] - xs[i - 1]) ** 2 + (ys[i] - ys[i - 1]) ** 2)
                for i in range(1, len(xs))
            )
            summaries.append({
                "track_id": track_id,
                "first_frame": frames[0],
                "last_frame": frames[-1],
                "duration_seconds": round((frames[-1] - frames[0]) / fps, 2),
                "total_distance_px": round(total_dist, 1),
                "avg_x": round(np.mean(xs), 1),
                "avg_y": round(np.mean(ys), 1),
                "num_detections": len(positions),
                "positions": [
                    {"frame": p[0], "time": round(p[0] / fps, 2),
                     "x": round(p[1], 1), "y": round(p[2], 1)}
                    for p in positions[::15]
                ],
            })
        summaries.sort(key=lambda s: s["duration_seconds"], reverse=True)
        return summaries
