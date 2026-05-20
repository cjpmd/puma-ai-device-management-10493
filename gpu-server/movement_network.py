"""
movement_network — build a pass network graph for one team.

Nodes: players (track_ids), positioned by heatmap centroid (normalised 0–1).
Edges: completed passes between two players (≥ MIN_EDGE_PASSES).

Output format consumed by PassNetworkPanel.tsx:
{
  "nodes": [{ "track_id": int, "avg_x": float, "avg_y": float, "pass_count": int }],
  "edges": [{ "from": int, "to": int, "count": int, "direction": str }]
}
"""

from __future__ import annotations
from collections import defaultdict
from typing import Optional


MIN_EDGE_PASSES = 2   # minimum passes on an edge to include it
MAX_EDGES       = 50  # cap to keep payload lean


def _heatmap_centroid(tracks: dict, track_id: int, frame_w: int, frame_h: int) -> tuple[float, float]:
    """Compute normalised (0–1) average position for a track."""
    positions = tracks.get(track_id, [])
    if not positions:
        return (0.5, 0.5)
    xs = [p[1] for p in positions]
    ys = [p[2] for p in positions]
    return (
        round(sum(xs) / len(xs) / max(frame_w, 1), 3),
        round(sum(ys) / len(ys) / max(frame_h, 1), 3),
    )


def build_pass_network(
    pass_events: list[dict],
    tracks: dict,
    team_id: str,
    frame_w: int,
    frame_h: int,
) -> dict:
    """
    Build a pass network for the given team.

    Args:
        pass_events: list from PassAnalyser.pass_events_for_network()
        tracks:      PlayerTracker.tracks dict  {track_id: [(frame, x, y), ...]}
        team_id:     'A' or 'B'
        frame_w, frame_h: video dimensions for normalisation

    Returns:
        { "nodes": [...], "edges": [...] }
    """
    # Filter to this team's completed passes
    team_passes = [
        p for p in pass_events
        if p["team"] == team_id
        and p["completed"]
        and p["to_track_id"] is not None
    ]

    # Collect unique track_ids that appear in this team's pass events
    involved: set[int] = set()
    for p in team_passes:
        involved.add(p["from_track_id"])
        involved.add(p["to_track_id"])

    # Count passes per player (as passer) for node sizing
    pass_count_from: dict[int, int] = defaultdict(int)
    for p in team_passes:
        pass_count_from[p["from_track_id"]] += 1

    # Build nodes
    nodes = []
    for tid in involved:
        avg_x, avg_y = _heatmap_centroid(tracks, tid, frame_w, frame_h)
        nodes.append({
            "track_id":   tid,
            "avg_x":      avg_x,
            "avg_y":      avg_y,
            "pass_count": pass_count_from.get(tid, 0),
        })

    # Build edges — aggregate by (from, to) pair
    edge_counts: dict[tuple[int, int], int] = defaultdict(int)
    edge_dir:    dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for p in team_passes:
        key = (p["from_track_id"], p["to_track_id"])
        edge_counts[key] += 1
        edge_dir[key][p["direction"]] += 1

    # Filter edges by minimum pass count, sort by frequency descending
    edges_raw = [
        (key, count)
        for key, count in edge_counts.items()
        if count >= MIN_EDGE_PASSES
    ]
    edges_raw.sort(key=lambda x: x[1], reverse=True)
    edges_raw = edges_raw[:MAX_EDGES]

    edges = []
    for (from_tid, to_tid), count in edges_raw:
        dir_counts = edge_dir[(from_tid, to_tid)]
        # Dominant direction for edge colouring
        dominant = max(dir_counts, key=dir_counts.get)  # type: ignore[arg-type]
        edges.append({
            "from":      from_tid,
            "to":        to_tid,
            "count":     count,
            "direction": dominant,
        })

    return {"nodes": nodes, "edges": edges}
