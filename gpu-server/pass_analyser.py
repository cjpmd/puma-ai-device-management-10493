"""
PassAnalyser — tracks ball ownership transitions and classifies pass direction.

Integrates with run_analysis() frame loop alongside TouchTracker.
Produces per-player and per-team pass stats with forward/sideways/back breakdown.

Direction conventions (based on ball travel angle relative to goal direction):
  forward:   > 30° towards opponent goal (positive x direction)
  back:      > 30° towards own goal (negative x direction)
  sideways:  within ±30° of lateral axis

Coordinate system: x=0 is left edge, x=frame_w is right edge.
Team A defends left goal (negative x), Team B defends right goal.
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Optional


POSSESSION_RADIUS_M = 2.0   # metres — player must be within this to have possession
PASS_CONFIRM_FRAMES = 3     # ball must be moving away for N frames to confirm a pass
PASS_MIN_TRAVEL_M   = 3.0   # minimum travel to register as a pass (not a dribble)
FORWARD_ANGLE_DEG   = 30.0  # angle threshold for forward vs sideways classification


@dataclass
class PassEvent:
    frame: int
    time_s: float
    from_track_id: int
    to_track_id: Optional[int]   # None if intercepted / out of play
    team: Optional[str]
    completed: bool
    direction: str                # 'forward' | 'sideways' | 'back'
    distance_m: float
    start_x: float               # pitch-normalised 0–1
    end_x: float


class PassAnalyser:
    """
    State machine that monitors ball possession changes to detect passes.

    Usage:
        pa = PassAnalyser(pixels_per_metre, fps, frame_w)
        # per frame:
        pa.update(frame_idx, ball_pos_px, ball_speed_ms, current_player_positions, team_assignment)
        # after frame loop + team assignment:
        pa.assign_teams(team_assignment)
        # extract results:
        pa.player_pass_summary(track_id)  ->  dict
        pa.team_pass_stats(team_id)       ->  dict
    """

    def __init__(self, pixels_per_metre: float, fps: float, frame_w: int):
        self.ppm        = pixels_per_metre
        self.fps        = fps
        self.frame_w    = frame_w
        self.radius_px  = POSSESSION_RADIUS_M * pixels_per_metre

        # State
        self.possessor: Optional[int]  = None   # track_id currently with ball
        self.possess_start_frame: int  = 0
        self.possess_start_pos: Optional[tuple[float, float]] = None
        self.release_frame: Optional[int]     = None
        self.release_pos:  Optional[tuple[float, float]] = None

        # Pending pass — waiting to see if ball reaches another player
        self._pending: Optional[dict]  = None
        self._pending_frames: int      = 0

        self.passes: list[PassEvent]   = []
        self._team_assignment: dict[int, str] = {}

    # ── per-frame update ─────────────────────────────────────────────────

    def update(
        self,
        frame_idx: int,
        ball_pos: Optional[tuple[float, float]],
        ball_speed_ms: float,
        player_positions: dict[int, tuple[float, float]],
        team_assignment: dict[int, str],
    ) -> None:
        self._team_assignment = team_assignment

        if ball_pos is None:
            self._advance_pending(frame_idx, None, player_positions, team_assignment)
            return

        bx, by = ball_pos

        # Find closest player to ball
        closest_tid, closest_dist_m = self._closest_player(bx, by, player_positions)

        in_possession = closest_dist_m is not None and closest_dist_m <= POSSESSION_RADIUS_M

        if in_possession:
            if self.possessor is None:
                # New possession episode
                self.possessor = closest_tid
                self.possess_start_frame = frame_idx
                self.possess_start_pos = (bx, by)
                self._pending = None
            elif closest_tid != self.possessor:
                # Possession changed — treat as pass from previous possessor
                self._register_pass(
                    frame_idx=frame_idx,
                    from_tid=self.possessor,
                    to_tid=closest_tid,
                    release_pos=self.possess_start_pos,
                    receive_pos=(bx, by),
                    team_assignment=team_assignment,
                    completed=True,
                )
                self.possessor = closest_tid
                self.possess_start_frame = frame_idx
                self.possess_start_pos = (bx, by)
                self._pending = None
        else:
            if self.possessor is not None:
                # Ball left a player — start pending window
                if self._pending is None:
                    self._pending = {
                        "from_tid": self.possessor,
                        "release_pos": (bx, by),
                        "release_frame": frame_idx,
                    }
                    self._pending_frames = 0
                self.possessor = None

            # Advance pending — check if ball reached a new player
            self._advance_pending(frame_idx, (bx, by), player_positions, team_assignment)

    def _advance_pending(
        self,
        frame_idx: int,
        ball_pos: Optional[tuple[float, float]],
        player_positions: dict[int, tuple[float, float]],
        team_assignment: dict[int, str],
    ) -> None:
        if self._pending is None:
            return
        self._pending_frames += 1

        # Time out — treat as incomplete pass or lost ball
        max_frames = int(self.fps * 3.0)  # 3 seconds max for a pass to complete
        if self._pending_frames > max_frames:
            self._register_pass(
                frame_idx=frame_idx,
                from_tid=self._pending["from_tid"],
                to_tid=None,
                release_pos=self._pending["release_pos"],
                receive_pos=ball_pos,
                team_assignment=team_assignment,
                completed=False,
            )
            self._pending = None
            return

        if ball_pos is None:
            return

        closest_tid, closest_dist_m = self._closest_player(*ball_pos, player_positions)
        if closest_dist_m is not None and closest_dist_m <= POSSESSION_RADIUS_M:
            completed = closest_tid != self._pending["from_tid"]
            self._register_pass(
                frame_idx=frame_idx,
                from_tid=self._pending["from_tid"],
                to_tid=closest_tid if completed else None,
                release_pos=self._pending["release_pos"],
                receive_pos=ball_pos,
                team_assignment=team_assignment,
                completed=completed,
            )
            self.possessor = closest_tid if completed else None
            self._pending = None

    def _register_pass(
        self,
        frame_idx: int,
        from_tid: int,
        to_tid: Optional[int],
        release_pos: Optional[tuple[float, float]],
        receive_pos: Optional[tuple[float, float]],
        team_assignment: dict[int, str],
        completed: bool,
    ) -> None:
        if release_pos is None:
            return

        rx, ry = release_pos
        if receive_pos is not None:
            dx_px = receive_pos[0] - rx
            dy_px = receive_pos[1] - ry
        else:
            dx_px, dy_px = 0.0, 0.0

        dist_m = math.sqrt(dx_px ** 2 + dy_px ** 2) / self.ppm
        if dist_m < PASS_MIN_TRAVEL_M:
            return  # too short — dribble or trap, not a pass

        team = team_assignment.get(from_tid)
        direction = self._classify_direction(dx_px, dy_px, team)

        self.passes.append(PassEvent(
            frame=frame_idx,
            time_s=round(frame_idx / self.fps, 2),
            from_track_id=from_tid,
            to_track_id=to_tid,
            team=team,
            completed=completed,
            direction=direction,
            distance_m=round(dist_m, 1),
            start_x=round(rx / self.frame_w, 3),
            end_x=round((rx + dx_px) / self.frame_w, 3),
        ))

    # ── helpers ──────────────────────────────────────────────────────────

    def _closest_player(
        self,
        bx: float,
        by: float,
        player_positions: dict[int, tuple[float, float]],
    ) -> tuple[Optional[int], Optional[float]]:
        best_tid, best_dist = None, None
        for tid, (px, py) in player_positions.items():
            d_px = math.sqrt((bx - px) ** 2 + (by - py) ** 2)
            d_m = d_px / self.ppm
            if best_dist is None or d_m < best_dist:
                best_tid, best_dist = tid, d_m
        return best_tid, best_dist

    def _classify_direction(
        self, dx_px: float, dy_px: float, team: Optional[str]
    ) -> str:
        """
        Positive x = right side of pitch.
        Team A attacks right (positive x), Team B attacks left (negative x).
        """
        angle_deg = math.degrees(math.atan2(dy_px, dx_px))  # -180 to 180
        # Lateral is roughly ±90°; forward/back split at 30° threshold
        if team == "B":
            dx_px = -dx_px  # flip for Team B so forward is always "towards opponent goal"

        if abs(dx_px) < 1e-6 and abs(dy_px) < 1e-6:
            return "sideways"

        forward_component = dx_px if team != "B" else -dx_px
        total = math.sqrt(dx_px ** 2 + dy_px ** 2)
        fwd_ratio = forward_component / total  # -1 (back) to +1 (forward)

        threshold = math.cos(math.radians(90 - FORWARD_ANGLE_DEG))  # ≈0.5 for 30°
        if fwd_ratio >= threshold:
            return "forward"
        elif fwd_ratio <= -threshold:
            return "back"
        else:
            return "sideways"

    # ── post-loop team back-fill ─────────────────────────────────────────

    def assign_teams(self, team_assignment: dict[int, str]) -> None:
        self._team_assignment = team_assignment
        for pe in self.passes:
            if pe.team is None:
                pe.team = team_assignment.get(pe.from_track_id)

    # ── summary accessors ────────────────────────────────────────────────

    def player_pass_summary(self, track_id: int) -> dict:
        my_passes = [p for p in self.passes if p.from_track_id == track_id]
        if not my_passes:
            return {}
        attempted   = len(my_passes)
        completed   = sum(1 for p in my_passes if p.completed)
        fwd         = sum(1 for p in my_passes if p.direction == "forward")
        side        = sum(1 for p in my_passes if p.direction == "sideways")
        back        = sum(1 for p in my_passes if p.direction == "back")
        return {
            "passes_attempted":  attempted,
            "passes_completed":  completed,
            "pass_accuracy":     round(completed / attempted * 100, 1) if attempted else 0.0,
            "passes_forward":    fwd,
            "passes_sideways":   side,
            "passes_back":       back,
        }

    def team_pass_stats(self, team_id: str) -> dict:
        team_passes = [p for p in self.passes if p.team == team_id]
        if not team_passes:
            return {}
        attempted = len(team_passes)
        completed = sum(1 for p in team_passes if p.completed)
        return {
            "pass_attempts":     attempted,
            "pass_completions":  completed,
            "pass_accuracy_pct": round(completed / attempted * 100, 1) if attempted else 0.0,
            "passes_forward":    sum(1 for p in team_passes if p.direction == "forward"),
            "passes_sideways":   sum(1 for p in team_passes if p.direction == "sideways"),
            "passes_back":       sum(1 for p in team_passes if p.direction == "back"),
        }

    def pass_events_for_network(self) -> list[dict]:
        """Return serialisable pass list for movement_network.build_pass_network()."""
        return [
            {
                "from_track_id": p.from_track_id,
                "to_track_id":   p.to_track_id,
                "team":          p.team,
                "completed":     p.completed,
                "direction":     p.direction,
                "distance_m":    p.distance_m,
                "start_x":       p.start_x,
                "end_x":         p.end_x,
            }
            for p in self.passes
            if p.completed and p.to_track_id is not None
        ]
