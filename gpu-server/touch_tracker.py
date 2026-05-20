"""
Touch Tracker — detects discrete ball touches per player.

A "touch" is a single intentional contact with the ball, distinct from:
- Dribbling (multiple frames of continuous contact = one touch sequence)
- Passing (the kick itself counts as one touch)
- Receiving (first contact after a pass = one touch)

Algorithm
---------
1. Ball is "in contact" with player T when ball is within TOUCH_RADIUS_M metres.
2. Contact episode starts → opened in _in_contact[T].
3. Contact episode ends (ball moves away) → classified and recorded:
     - Ball speed OUT >= SHOT_SPEED_MS   → 'shot'
     - Ball speed OUT >= PASS_SPEED_MS   → 'pass'
     - Ball speed IN  >= RECEIVE_SPEED_MS → 'receive'
     - Otherwise                          → 'control'
4. Dribble: if ball stays near T at low speed, a 'dribble' touch is emitted
   every DRIBBLE_GAP_S seconds to avoid exploding counts.

Known accuracy limitations
--------------------------
- Overcounts dribbles slightly despite DRIBBLE_GAP_S throttle when a player
  dribbles very slowly (ball stays within radius > 1 gap period).
- Undercounts headers / aerial challenges because ball leaves camera visibility
  or YOLO confidence drops on aerial balls; estimated 15–25% miss rate on
  aerial touches.
- At target_fps=5 (frame spacing 0.2s), very brief touches (goalkeeper parries,
  first-touch flicks) may span only one or two analyzed frames, so speed
  deltas are coarse; touch type classification error is ~10% for these.
- Proximity-based detection cannot distinguish a near-miss from a touch;
  estimated 5–10% false-positive rate when two players contest the ball.
"""

from __future__ import annotations

import numpy as np
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

# ── Tunable constants ──────────────────────────────────────────────────

TOUCH_RADIUS_M    = 1.2    # metres — player within this distance "has" the ball
DRIBBLE_GAP_S     = 1.5    # seconds between dribble touch samples to cap counts
SHOT_SPEED_MS     = 12.0   # m/s outbound — classify as shot
PASS_SPEED_MS     = 4.0    # m/s outbound — classify as pass
RECEIVE_SPEED_MS  = 3.0    # m/s inbound  — classify as receive (not control)


@dataclass
class TouchEvent:
    frame: int
    timestamp_ms: int
    track_id: int
    touch_type: str             # 'receive' | 'control' | 'pass' | 'shot' | 'dribble'
    ball_speed_before_ms: float # m/s — ball speed when contact opened
    ball_speed_after_ms: float  # m/s — ball speed when contact closed (0 for dribble)
    team: Optional[str] = None  # filled by caller after TeamClassifier runs


class TouchTracker:
    """
    Stateful touch tracker: call update() once per analysed frame.
    After the frame loop is complete, call assign_teams() then
    player_touch_summary() / team_touch_summary() to read results.
    """

    def __init__(self, pixels_per_metre: float, fps: float):
        """
        Parameters
        ----------
        pixels_per_metre : float
            Conversion factor — frame_w / 105.0 for a full-pitch panoramic.
        fps : float
            Analysed frames per second (native_fps / frame_step).
        """
        self.ppm  = pixels_per_metre
        self.fps  = fps
        self.touches: list[TouchEvent] = []

        # track_id → open contact episode dict
        self._in_contact: dict[int, dict] = {}

        # track_id → frame index of the most recent dribble touch emitted
        self._dribble_last_frame: dict[int, int] = {}

        # Per-player running counts {track_id → {type → count}}
        self._counts: dict[int, dict] = defaultdict(lambda: {
            "total": 0, "receive": 0, "control": 0,
            "pass": 0, "shot": 0, "dribble": 0,
        })

    # ── Public API ──────────────────────────────────────────────────────

    def update(
        self,
        frame_idx: int,
        timestamp_ms: int,
        ball_pos: Optional[tuple[float, float]],    # (px, py) or None
        ball_speed_ms: float,                        # m/s, current frame
        prev_ball_speed_ms: float,                   # m/s, previous frame
        player_positions: dict[int, tuple[float, float]],  # {track_id: (cx_px, cy_px)}
    ) -> list[TouchEvent]:
        """
        Call once per analysed frame. Returns any TouchEvents recorded
        this frame (zero or more).
        """
        new_touches: list[TouchEvent] = []

        if ball_pos is None:
            # Ball not visible — close all open contacts
            for tid in list(self._in_contact.keys()):
                self._close(tid, frame_idx, timestamp_ms, ball_speed_ms, new_touches)
            return new_touches

        # ── Proximity test ──────────────────────────────────────────────
        touching_now: set[int] = set()
        for tid, (cx, cy) in player_positions.items():
            dist_m = np.sqrt(
                ((ball_pos[0] - cx) / self.ppm) ** 2 +
                ((ball_pos[1] - cy) / self.ppm) ** 2
            )
            if dist_m < TOUCH_RADIUS_M:
                touching_now.add(tid)

        newly_touching = touching_now - set(self._in_contact)
        lost_contact   = set(self._in_contact) - touching_now

        # ── Open new contact episodes ───────────────────────────────────
        for tid in newly_touching:
            self._in_contact[tid] = {
                "frame_start":        frame_idx,
                "timestamp_ms":       timestamp_ms,
                "ball_speed_arrival": prev_ball_speed_ms,
            }

        # ── Close ended contacts ────────────────────────────────────────
        for tid in lost_contact:
            self._close(tid, frame_idx, timestamp_ms, ball_speed_ms, new_touches)

        # ── Dribble sampling for ongoing contacts ───────────────────────
        gap_frames = max(1, int(self.fps * DRIBBLE_GAP_S))
        for tid in touching_now:
            # Only count as dribble if ball is slow (not mid-pass/shot)
            if ball_speed_ms < PASS_SPEED_MS:
                last = self._dribble_last_frame.get(tid, -gap_frames)
                if frame_idx - last >= gap_frames:
                    evt = TouchEvent(
                        frame=frame_idx,
                        timestamp_ms=timestamp_ms,
                        track_id=tid,
                        touch_type="dribble",
                        ball_speed_before_ms=ball_speed_ms,
                        ball_speed_after_ms=ball_speed_ms,
                    )
                    self.touches.append(evt)
                    new_touches.append(evt)
                    self._counts[tid]["total"]   += 1
                    self._counts[tid]["dribble"] += 1
                    self._dribble_last_frame[tid] = frame_idx

        return new_touches

    def assign_teams(self, team_assignment: dict[int, str]) -> None:
        """
        Back-fill team on all recorded touches.
        Call after TeamClassifier.assign_teams() returns.
        """
        for t in self.touches:
            t.team = team_assignment.get(t.track_id)

    def player_touch_summary(self, track_id: int) -> dict:
        """Return touch breakdown dict for one player, safe to merge into player_metrics."""
        c = self._counts[track_id]
        return {
            "touches":         c["total"],   # backward-compat alias
            "touches_total":   c["total"],
            "touches_receive": c["receive"],
            "touches_control": c["control"],
            "touches_pass":    c["pass"],
            "touches_shot":    c["shot"],
            "touches_dribble": c["dribble"],
        }

    def team_touch_summary(self, team_id: str) -> dict:
        """Return aggregated touch counts for one team (team_id is 'A' or 'B')."""
        team_touches = [t for t in self.touches if t.team == team_id]
        total = len(team_touches)
        return {
            "total_touches": total,
            "touches_per_type": {
                t_type: sum(1 for t in team_touches if t.touch_type == t_type)
                for t_type in ("receive", "control", "pass", "shot", "dribble")
            },
        }

    # ── Internal ────────────────────────────────────────────────────────

    def _close(
        self,
        tid: int,
        frame_idx: int,
        timestamp_ms: int,
        ball_speed_ms: float,
        out: list[TouchEvent],
    ) -> None:
        episode = self._in_contact.pop(tid, None)
        if episode is None:
            return

        arrival = episode["ball_speed_arrival"]

        if ball_speed_ms >= SHOT_SPEED_MS:
            touch_type = "shot"
        elif ball_speed_ms >= PASS_SPEED_MS:
            touch_type = "pass"
        elif arrival >= RECEIVE_SPEED_MS:
            touch_type = "receive"
        else:
            touch_type = "control"

        evt = TouchEvent(
            frame=episode["frame_start"],
            timestamp_ms=episode["timestamp_ms"],
            track_id=tid,
            touch_type=touch_type,
            ball_speed_before_ms=arrival,
            ball_speed_after_ms=ball_speed_ms,
        )
        self.touches.append(evt)
        out.append(evt)
        self._counts[tid]["total"]      += 1
        self._counts[tid][touch_type]   += 1
