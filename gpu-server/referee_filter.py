"""
referee_filter — entropy-based exclusion of referee tracks.

Referees are distinguished from players by two signals:
  1. team=None after TeamClassifier (referees don't cluster with either team)
  2. High heatmap entropy: referees cover both halves of the pitch, so their
     positional distribution has higher entropy than outfield players.

A track is classified as a referee when:
  - team is None, AND
  - heatmap coverage ratio > ENTROPY_THRESHOLD
    (i.e. the fraction of non-empty grid cells exceeds the threshold)

The filter runs once after TeamClassifier; results are a set of track_ids
that should be excluded from player_metrics, heatmaps, and event attribution.
"""

from __future__ import annotations
from collections import defaultdict
import math
from typing import Optional


ENTROPY_THRESHOLD = 0.75   # fraction of non-empty heatmap cells; referees roam widely
GRID_W = 20
GRID_H = 12
MIN_FRAMES = 30            # minimum appearances to make classification reliable


def _heatmap_coverage(positions: list, frame_w: int, frame_h: int) -> float:
    """
    Compute the fraction of non-empty heatmap cells for a track.
    Returns 0.0 if not enough frames.
    """
    if len(positions) < MIN_FRAMES:
        return 0.0

    occupied: set[tuple[int, int]] = set()
    for _, x, y in positions:
        gx = min(int(x / frame_w * GRID_W), GRID_W - 1)
        gy = min(int(y / frame_h * GRID_H), GRID_H - 1)
        occupied.add((gx, gy))

    total_cells = GRID_W * GRID_H
    return len(occupied) / total_cells


def classify_referee(
    track_id: int,
    positions: list,
    team: Optional[str],
    frame_w: int,
    frame_h: int,
) -> bool:
    """Return True if this track is likely a referee."""
    if team is not None:
        return False  # assigned to a team → not a referee
    coverage = _heatmap_coverage(positions, frame_w, frame_h)
    return coverage > ENTROPY_THRESHOLD


def filter_referees(
    tracks: dict,
    team_assignment: dict[int, str],
    frame_w: int,
    frame_h: int,
) -> set[int]:
    """
    Return set of track_ids that are classified as referees.

    Args:
        tracks:          PlayerTracker.tracks  {track_id: [(frame, x, y), ...]}
        team_assignment: TeamClassifier output {track_id: 'A' | 'B'}
        frame_w, frame_h: video dimensions
    """
    referees: set[int] = set()
    for tid, positions in tracks.items():
        team = team_assignment.get(tid)
        if classify_referee(tid, positions, team, frame_w, frame_h):
            referees.add(tid)
    return referees
