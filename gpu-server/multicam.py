"""
multicam.py — cross-camera player identity reconciliation.

Multiple iPhones film the same match from different angles. Each camera's
analysis produces its own tracker IDs; this module reconciles them by:

1. Estimating the start-time offset between the two recordings via audio
   cross-correlation (iPhones never start at exactly the same moment).
2. Projecting each camera's player tracks into a unified top-down pitch
   coordinate space using each camera's pitch homography (PitchCalibrator).
3. Time-binning both sets of pitch positions (offset-corrected) and solving
   a Hungarian assignment on mean pairwise distance, gated by a maximum
   plausible reconciliation distance.

The resulting {secondary_track_id: primary_track_id} mapping is used to
pool jersey OCR votes across views (JerseyNumberTracker.merge_scores_from)
and to corroborate goal events (GoalDetector.corroborate).

Both cameras must have a calibrated homography; otherwise reconciliation
is skipped (logged) — projecting through the fallback scale estimate would
produce garbage matches.
"""

from __future__ import annotations

import os
import subprocess

import numpy as np

MAX_RECONCILE_DIST_M = 4.0   # players further apart than this are never the same
MIN_SHARED_BINS = 5          # need this many co-visible time bins to match
TIME_BIN_S = 1.0


def estimate_sync_offset(path_a: str, path_b: str, tmpdir: str,
                         sample_rate: int = 16000, window_s: int = 60) -> float | None:
    """Offset in seconds such that t_b - offset ≈ t_a (audio cross-correlation
    with bandpass filtering for sharp sounds). None if audio unusable."""
    from scipy.signal import correlate, butter, sosfilt

    def _audio(path, name):
        pcm = os.path.join(tmpdir, f"sync_{name}.pcm")
        cmd = ["ffmpeg", "-y", "-i", path, "-ac", "1", "-ar", str(sample_rate),
               "-vn", "-f", "s16le", "-t", str(window_s), pcm]
        r = subprocess.run(cmd, capture_output=True, timeout=300)
        if r.returncode != 0 or not os.path.exists(pcm):
            return None
        return np.frombuffer(open(pcm, "rb").read(), dtype=np.int16).astype(np.float32)

    a = _audio(path_a, "a")
    b = _audio(path_b, "b")
    if a is None or b is None or a.size < sample_rate or b.size < sample_rate:
        return None
    sos = butter(4, [800, 3000], btype="band", fs=sample_rate, output="sos")
    a, b = sosfilt(sos, a), sosfilt(sos, b)
    corr = correlate(a, b, mode="full")
    lag = int(np.argmax(corr)) - len(b) + 1
    return lag / sample_rate


def project_tracks_to_pitch(tracks: dict, calibrator, native_fps: float) -> dict:
    """{tid: [(t_s, x_m, y_m), ...]} via the camera's pitch homography."""
    if calibrator is None or not getattr(calibrator, "calibrated", False):
        return {}
    out: dict[int, list] = {}
    for tid, positions in tracks.items():
        pts = []
        for frame_idx, x, y in positions:
            try:
                xm, ym = calibrator.pixel_to_metres(x, y)
            except Exception:
                continue
            pts.append((frame_idx / native_fps, xm, ym))
        if pts:
            out[tid] = pts
    return out


def _bin_positions(pitch_tracks: dict, offset_s: float = 0.0) -> dict:
    """{tid: {bin_index: (mean_x, mean_y)}} with offset-corrected times."""
    out: dict[int, dict[int, tuple[float, float]]] = {}
    for tid, pts in pitch_tracks.items():
        bins: dict[int, list] = {}
        for t, x, y in pts:
            bins.setdefault(int((t - offset_s) / TIME_BIN_S), []).append((x, y))
        out[tid] = {
            b: (float(np.mean([p[0] for p in v])), float(np.mean([p[1] for p in v])))
            for b, v in bins.items()
        }
    return out


def reconcile_identities(primary_pitch: dict, secondary_pitch: dict,
                         offset_s: float) -> dict[int, int]:
    """Match secondary-camera tracks to primary-camera tracks by proximity
    on the unified pitch map. Returns {secondary_tid: primary_tid}."""
    try:
        from scipy.optimize import linear_sum_assignment
    except Exception:
        return {}
    if not primary_pitch or not secondary_pitch:
        return {}

    p_bins = _bin_positions(primary_pitch, 0.0)
    s_bins = _bin_positions(secondary_pitch, offset_s)
    p_ids = list(p_bins.keys())
    s_ids = list(s_bins.keys())

    BIG = 1e6
    cost = np.full((len(s_ids), len(p_ids)), BIG)
    for i, sid in enumerate(s_ids):
        sb = s_bins[sid]
        for j, pid in enumerate(p_ids):
            pb = p_bins[pid]
            shared = set(sb.keys()) & set(pb.keys())
            if len(shared) < MIN_SHARED_BINS:
                continue
            d = [float(np.hypot(sb[b][0] - pb[b][0], sb[b][1] - pb[b][1]))
                 for b in shared]
            cost[i, j] = float(np.mean(d))

    rows, cols = linear_sum_assignment(cost)
    mapping = {}
    for i, j in zip(rows, cols):
        if cost[i, j] <= MAX_RECONCILE_DIST_M:
            mapping[s_ids[i]] = p_ids[j]
    return mapping
