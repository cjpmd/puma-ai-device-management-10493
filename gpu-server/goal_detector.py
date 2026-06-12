"""
goal_detector.py — reliable goal event detection.

ROOT CAUSE FINDINGS (Pain point 3 — goals not detected)
-------------------------------------------------------
1. There was no goal detector. "Goal" was a side-effect of the shot
   heuristic in EventDetector: a single frame where the ball's x position
   was within 1.5% of the panorama edge while moving fast. This assumes
   goals sit exactly at the frame edges (only ever approximately true for
   stitched dual-camera panoramas, never for VEO or single-iPhone views),
   uses no goal localisation, no trajectory, and no multi-frame
   confirmation — corners, clearances and throw-ins near the byline all
   trigger or mask it.
2. Even when a "goal" outcome was produced, it could never reach the app:
   analysis-callback only writes match_event_tags for events with
   `source === "cv"` and `confidence >= 0.7`, and the GPU worker emitted
   neither field. Zero CV events have ever been tagged in production.
3. The ball-in-net case (ball disappears behind the net/keeper) was
   unhandled — detection loss at the exact moment of the goal meant the
   edge-zone test never fired.

FIX IMPLEMENTED
---------------
* Goal-mouth localisation via the existing pitch homography: the goal is a
  7.32m segment centred on each goal line; the ball position is projected
  to pitch metres and tested against the goal mouth (± margin) directly.
  Falls back to calibration-free edge zones when homography is missing.
* Trajectory state machine per goal side:
      IDLE → BALL_APPROACHING → BALL_IN_GOAL_ZONE → GOAL_CONFIRMED
  Confirmation requires M consecutive analysed frames in/past the goal
  zone OR zone entry followed by detection loss with goal-ward velocity
  (net occlusion). Zone entry followed by a quick exit is logged as a
  REJECTED candidate (save / corner / goal-line clearance).
* Audio corroboration (optional, cheap): a crowd/player reaction spike in
  the RMS envelope within 3s of zone entry raises confidence.
* Every candidate is logged with timestamp, camera view, confidence and
  the evidence behind it — confirmed and rejected alike — so detection
  precision/recall can be measured in production.
* Multi-camera corroboration hook: corroborate() cross-checks candidates
  from a second view (used by multicam fusion when enabled).
"""

from __future__ import annotations

import os
import subprocess
from collections import deque

import numpy as np

GOAL_HALF_WIDTH_M = 3.66          # full-size goal mouth half-width
GOAL_MOUTH_MARGIN_M = 1.0         # tolerance for calibration error
GOAL_LINE_DEPTH_M = 0.5           # ball must be within this of/behind the line
APPROACH_DIST_M = 14.0            # "approaching" radius from goal centre
CONFIRM_SECONDS = 0.8             # ball must stay in zone this long (M frames)
LOST_CONFIRM_SECONDS = 1.2        # in zone, then ball lost this long → net occlusion
COOLDOWN_SECONDS = 8.0            # suppress duplicate candidates on same goal
CONFIRM_CONFIDENCE = 0.70         # matches analysis-callback tagging threshold

# Fallback (uncalibrated) image-space zones
EDGE_ZONE_FRAC = 0.035            # left/right 3.5% of frame width
EDGE_ZONE_Y_BAND = (0.20, 0.85)   # vertical band where a goal mouth plausibly sits


def compute_audio_envelope(video_path: str, tmpdir: str,
                           sample_rate: int = 8000) -> tuple[np.ndarray, np.ndarray] | None:
    """Extract mono audio and return (times_s, rms) with 100ms resolution.
    Used for crowd/player-reaction corroboration. Returns None when the
    video has no usable audio."""
    pcm_path = os.path.join(tmpdir, "goal_audio.pcm")
    cmd = ["ffmpeg", "-y", "-i", video_path, "-ac", "1", "-ar", str(sample_rate),
           "-vn", "-f", "s16le", pcm_path]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=600)
        if result.returncode != 0 or not os.path.exists(pcm_path):
            return None
        x = np.frombuffer(open(pcm_path, "rb").read(), dtype=np.int16).astype(np.float32)
    except Exception:
        return None
    if x.size < sample_rate:
        return None
    win = sample_rate // 10  # 100 ms
    n = x.size // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1))
    times = np.arange(n) * 0.1
    return times, rms


def audio_spike_score(envelope, t: float, pre: float = 0.5, post: float = 3.0) -> float:
    """0–1 score for a loudness spike shortly after time t (goal reaction)."""
    if envelope is None:
        return 0.0
    times, rms = envelope
    baseline = float(np.median(rms))
    if baseline <= 1e-3:
        return 0.0
    sel = (times >= t - pre) & (times <= t + post)
    if not np.any(sel):
        return 0.0
    ratio = float(np.max(rms[sel])) / baseline
    # 0 below 1.5× baseline, saturating at 4.5×
    return float(np.clip((ratio - 1.5) / 3.0, 0.0, 1.0))


class GoalDetector:
    """
    Per-frame goal detection state machine.

    Call update() once per analysed frame with the fused ball estimate
    (from BallTrackingPipeline), then finalize() after the loop.
    """

    def __init__(self, frame_w: int, frame_h: int, fps: float,
                 calibrator=None, pitch_length_m: float = 80.0,
                 pitch_width_m: float = 50.0, camera_view: str = "primary"):
        self.frame_w = frame_w
        self.frame_h = frame_h
        self.fps = max(0.5, float(fps))
        self.calibrator = calibrator
        self.pitch_length_m = pitch_length_m
        self.pitch_width_m = pitch_width_m
        self.camera_view = camera_view

        self.confirm_frames = max(2, int(round(CONFIRM_SECONDS * self.fps)))
        self.lost_confirm_frames = max(2, int(round(LOST_CONFIRM_SECONDS * self.fps)))
        self.cooldown_frames = int(COOLDOWN_SECONDS * self.fps)

        self._recent = deque(maxlen=max(4, int(self.fps * 2)))  # (frame, t, x, y, stage)
        self._state = {side: self._fresh_side() for side in ("left", "right")}
        self._cooldown_until = {"left": -1, "right": -1}

        self.candidates: list[dict] = []   # all candidates, confirmed + rejected

    @staticmethod
    def _fresh_side() -> dict:
        return {
            "state": "IDLE",          # IDLE | APPROACHING | IN_ZONE
            "entered_frame": None,
            "entered_time": None,
            "frames_in_zone": 0,
            "lost_frames": 0,
            "traj_aligned": False,
            "entry_stage": None,
            "yolo_frames_in_zone": 0,
        }

    # ── geometry ─────────────────────────────────────────────────────────

    def _to_pitch(self, bx: float, by: float) -> tuple[float, float] | None:
        c = self.calibrator
        if c is not None and getattr(c, "calibrated", False):
            try:
                return c.pixel_to_metres(bx, by)
            except Exception:
                return None
        return None

    def _zone_side(self, bx: float, by: float) -> str | None:
        """Which goal zone (if any) contains the ball."""
        pitch = self._to_pitch(bx, by)
        if pitch is not None:
            xm, ym = pitch
            half = GOAL_HALF_WIDTH_M + GOAL_MOUTH_MARGIN_M
            cy = self.pitch_width_m / 2.0
            if xm <= GOAL_LINE_DEPTH_M and abs(ym - cy) <= half:
                return "left"
            if xm >= self.pitch_length_m - GOAL_LINE_DEPTH_M and abs(ym - cy) <= half:
                return "right"
            return None
        # Calibration-free fallback: narrow edge bands in a plausible vertical band
        y0, y1 = EDGE_ZONE_Y_BAND[0] * self.frame_h, EDGE_ZONE_Y_BAND[1] * self.frame_h
        if not (y0 <= by <= y1):
            return None
        if bx <= EDGE_ZONE_FRAC * self.frame_w:
            return "left"
        if bx >= (1.0 - EDGE_ZONE_FRAC) * self.frame_w:
            return "right"
        return None

    def _goal_centre_px(self, side: str) -> tuple[float, float]:
        c = self.calibrator
        if c is not None and getattr(c, "calibrated", False):
            try:
                xm = 0.0 if side == "left" else self.pitch_length_m
                return c.metres_to_pixels(xm, self.pitch_width_m / 2.0)
            except Exception:
                pass
        return (0.0 if side == "left" else float(self.frame_w), self.frame_h / 2.0)

    def _velocity_toward(self, side: str) -> bool:
        """Is the recent ball trajectory moving toward this goal?"""
        if len(self._recent) < 3:
            return False
        pts = list(self._recent)[-4:]
        df = pts[-1][0] - pts[0][0]
        if df <= 0:
            return False
        vx = (pts[-1][2] - pts[0][2]) / df
        gx, _ = self._goal_centre_px(side)
        dx = gx - pts[-1][2]
        if abs(dx) < 1e-6:
            return True  # already at the goal centre
        # Same sign and meaningful magnitude (≥ ~0.2% of width per frame)
        return vx * np.sign(dx) > 0.002 * self.frame_w

    # ── state machine ────────────────────────────────────────────────────

    def update(self, frame_idx: int, time_s: float, ball: tuple | None) -> None:
        """ball = (x, y, conf, stage) from BallTrackingPipeline, or None."""
        if ball is not None:
            bx, by, bconf, stage = ball
            self._recent.append((frame_idx, time_s, bx, by, stage))
            in_side = self._zone_side(bx, by)
        else:
            in_side = None
            stage = None

        for side in ("left", "right"):
            st = self._state[side]
            if frame_idx < self._cooldown_until[side]:
                continue

            if ball is None:
                if st["state"] == "IN_ZONE":
                    # Ball vanished inside the zone — likely in the net / behind keeper
                    st["lost_frames"] += 1
                    if st["lost_frames"] >= self.lost_confirm_frames:
                        self._emit(side, frame_idx, time_s, confirmed=True,
                                   via="disappearance")
                elif st["state"] == "APPROACHING":
                    st["state"] = "IDLE"
                continue

            if in_side == side:
                if st["state"] != "IN_ZONE":
                    st.update({
                        "state": "IN_ZONE",
                        "entered_frame": frame_idx,
                        "entered_time": time_s,
                        "frames_in_zone": 0,
                        "lost_frames": 0,
                        "traj_aligned": self._velocity_toward(side),
                        "entry_stage": stage,
                        "yolo_frames_in_zone": 0,
                    })
                st["frames_in_zone"] += 1
                st["lost_frames"] = 0
                if stage == "yolo":
                    st["yolo_frames_in_zone"] += 1
                if st["frames_in_zone"] >= self.confirm_frames:
                    self._emit(side, frame_idx, time_s, confirmed=True, via="dwell")
            else:
                if st["state"] == "IN_ZONE":
                    if st["frames_in_zone"] < self.confirm_frames:
                        # Bounced straight back out — save / clearance / corner
                        self._emit(side, frame_idx, time_s, confirmed=False, via="exit")
                    else:
                        self._state[side] = self._fresh_side()
                # Approach bookkeeping (for trajectory evidence on entry)
                pitch = self._to_pitch(*(ball[:2]))
                if pitch is not None:
                    gx = 0.0 if side == "left" else self.pitch_length_m
                    dist = float(np.hypot(pitch[0] - gx, pitch[1] - self.pitch_width_m / 2))
                    near = dist <= APPROACH_DIST_M
                else:
                    gx_px, gy_px = self._goal_centre_px(side)
                    near = float(np.hypot(ball[0] - gx_px, ball[1] - gy_px)) \
                        <= 0.18 * self.frame_w
                if st["state"] != "IN_ZONE":
                    st["state"] = "APPROACHING" if (near and self._velocity_toward(side)) else "IDLE"

    def _emit(self, side: str, frame_idx: int, time_s: float,
              confirmed: bool, via: str) -> None:
        st = self._state[side]
        entered_t = st["entered_time"] if st["entered_time"] is not None else time_s
        self.candidates.append({
            "side": side,
            "frame": st["entered_frame"] if st["entered_frame"] is not None else frame_idx,
            "time": round(entered_t, 2),
            "end_time": round(time_s, 2),
            "via": via,                          # dwell | disappearance | exit
            "frames_in_zone": st["frames_in_zone"],
            "trajectory_aligned": bool(st["traj_aligned"]),
            "yolo_frames_in_zone": st["yolo_frames_in_zone"],
            "camera_view": self.camera_view,
            "provisional_confirmed": confirmed,
        })
        self._state[side] = self._fresh_side()
        if confirmed:
            self._cooldown_until[side] = frame_idx + self.cooldown_frames

    # ── finalisation ─────────────────────────────────────────────────────

    def finalize(self, audio_envelope=None) -> tuple[list[dict], list[dict]]:
        """Score all candidates. Returns (confirmed_goals, all_candidates).
        Confidence model:
          base 0.45
          + 0.15 trajectory was goal-ward at entry
          + 0.15 dwell met (M consecutive frames in zone)
          + 0.10 ≥1 hard YOLO detection inside the zone (not motion/Kalman)
          + 0.15 × audio reaction spike score
        Rejected (zone exit) candidates are capped below the confirm bar."""
        confirmed: list[dict] = []
        for c in self.candidates:
            conf = 0.45
            if c["trajectory_aligned"]:
                conf += 0.15
            if c["provisional_confirmed"] and c["via"] == "dwell":
                conf += 0.15
            elif c["provisional_confirmed"] and c["via"] == "disappearance":
                conf += 0.10
            if c["yolo_frames_in_zone"] >= 1:
                conf += 0.10
            spike = audio_spike_score(audio_envelope, c["time"])
            c["audio_spike"] = round(spike, 3)
            conf += 0.15 * spike
            if not c["provisional_confirmed"]:
                conf = min(conf, CONFIRM_CONFIDENCE - 0.05)
            c["confidence"] = round(min(conf, 0.95), 3)
            c["status"] = (
                "confirmed" if c["provisional_confirmed"] and c["confidence"] >= CONFIRM_CONFIDENCE
                else ("candidate" if c["provisional_confirmed"] else "rejected")
            )
            if c["status"] == "confirmed":
                confirmed.append(c)
        return confirmed, self.candidates

    @staticmethod
    def corroborate(primary: list[dict], secondary: list[dict],
                    offset_s: float, window_s: float = 3.0) -> list[dict]:
        """Cross-view corroboration: a candidate seen in both views within
        window_s (after sync-offset correction) gets a confidence boost and
        the corroborating view recorded. Mutates and returns `primary`."""
        for p in primary:
            for s in secondary:
                if abs((s["time"] - offset_s) - p["time"]) <= window_s:
                    p["corroborated_by"] = s.get("camera_view", "secondary")
                    p["confidence"] = round(min(0.97, p.get("confidence", 0.6) + 0.12), 3)
                    if p.get("status") == "candidate" and p["confidence"] >= CONFIRM_CONFIDENCE:
                        p["status"] = "confirmed"
                    break
        return primary
