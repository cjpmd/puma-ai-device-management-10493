"""
JerseyNumberTracker — cross-session player identity via jersey number OCR.

Heuristic-only improvements vs. the original:
  * Two read bands (chest 28-48 %, back 50-72 %) instead of one slice.
  * Crop is upscaled, CLAHE + unsharp mask before OCR — small/blurry crops
    are the dominant failure mode on grassroots 4K-downscaled footage.
  * EasyOCR confidence is used: each (number, conf) is summed; the candidate
    with score >= CONFIRM_VOTE_SCORE and lead >= CONFIRM_VOTE_LEAD wins.
  * Optional roster (set per team via `set_rosters`): off-roster reads are
    snapped to the nearest roster number within edit distance 1, else dropped.
  * OCR runs more often when the bbox is big (close to camera) and less often
    when far away.

Integration (inside ByteTrack loop in run_analysis):
    jersey_tracker = JerseyNumberTracker()
    jersey_tracker.set_rosters({"A": {7, 9, 10}, "B": {1, 4, 11}})  # optional
    jersey_tracker.update(frame, tid, bbox_xyxy, team="A")
    # after frame loop:
    identity_map = jersey_tracker.confirmed_identities()  # {tid: jersey}
"""

from __future__ import annotations
import re
from collections import defaultdict, Counter
from typing import Optional

import numpy as np

# Sampling cadence
OCR_EVERY_N_NEAR  = 4    # bbox height >= NEAR_BBOX_PX
OCR_EVERY_N_FAR   = 12   # smaller bboxes
NEAR_BBOX_PX      = 120

# Crop bands as (y_start_pct, y_end_pct)
# Back-high band added for youth shirts where the number sits between the
# shoulder blades, above the chest/back bands used originally.
CROP_BANDS = ((0.18, 0.42), (0.28, 0.48), (0.50, 0.72))
MIN_CROP_SIZE     = 14   # pixels — skip tiny detections
UPSCALE_TARGET_H  = 192  # px — upscale band to this height before OCR

# Voting
OCR_MIN_CONF      = 0.40
CONFIRM_VOTE_SCORE = 1.1   # Σ confidence required for the winning number
CONFIRM_VOTE_LEAD  = 0.35  # winner must beat runner-up by this much
CONFIRM_MIN_FRAMES = 6     # don't confirm before this many frames seen

# Roster snap
ROSTER_SNAP_DIST  = 1      # max edit distance for off-roster snap


_reader = None  # lazy-loaded EasyOCR reader


def _get_reader():
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(["en"], gpu=True, verbose=False)
    return _reader


def _extract_jersey_number(text: str) -> Optional[int]:
    """Pull the first 1–2 digit integer from OCR text."""
    matches = re.findall(r"\b(\d{1,2})\b", text)
    if matches:
        return int(matches[0])
    return None


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 2:
        return max(len(a), len(b))
    # tiny Levenshtein for ≤2-char strings
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _snap_to_roster(num: int, roster: set[int]) -> Optional[int]:
    if not roster:
        return num
    if num in roster:
        return num
    s = str(num)
    best, best_d = None, ROSTER_SNAP_DIST + 1
    for r in roster:
        d = _edit_distance(s, str(r))
        if d < best_d:
            best, best_d = r, d
    return best if best_d <= ROSTER_SNAP_DIST else None


def _preprocess(crop: np.ndarray) -> np.ndarray:
    """Upscale + CLAHE + light unsharp on a small jersey crop."""
    try:
        import cv2
    except Exception:
        return crop
    h, w = crop.shape[:2]
    if h == 0 or w == 0:
        return crop
    if h < UPSCALE_TARGET_H:
        scale = UPSCALE_TARGET_H / h
        crop = cv2.resize(crop, (int(w * scale), UPSCALE_TARGET_H), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    eq = clahe.apply(gray)
    blur = cv2.GaussianBlur(eq, (0, 0), sigmaX=1.0)
    sharp = cv2.addWeighted(eq, 1.5, blur, -0.5, 0)
    return cv2.cvtColor(sharp, cv2.COLOR_GRAY2BGR)


class JerseyNumberTracker:
    def __init__(self):
        self._frame_counts: dict[int, int] = defaultdict(int)
        # track_id -> {jersey_number: Σ confidence}
        self._scores:    dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        self._confirmed: dict[int, int] = {}
        # team_label -> set of allowed jersey numbers (optional)
        self._rosters: dict[str, set[int]] = {}

    # ── Public API ────────────────────────────────────────────────────────
    def set_rosters(self, rosters: dict[str, set[int]]) -> None:
        self._rosters = {k: set(v) for k, v in (rosters or {}).items() if v}

    def update(
        self,
        frame: np.ndarray,
        track_id: int,
        bbox_xyxy: tuple[float, float, float, float],
        team: Optional[str] = None,
    ) -> None:
        """Call once per tracked player per frame."""
        if track_id in self._confirmed:
            return  # already locked in

        x1, y1, x2, y2 = [int(v) for v in bbox_xyxy]
        h = y2 - y1
        w = x2 - x1
        if h < MIN_CROP_SIZE or w < MIN_CROP_SIZE:
            return

        # Cadence depends on how close the player is
        cadence = OCR_EVERY_N_NEAR if h >= NEAR_BBOX_PX else OCR_EVERY_N_FAR
        count = self._frame_counts[track_id]
        self._frame_counts[track_id] += 1
        if count % cadence != 0:
            return

        roster = self._rosters.get(team) if team else None
        try:
            reader = _get_reader()
        except Exception:
            return

        for (band_start, band_end) in CROP_BANDS:
            cy1 = y1 + int(h * band_start)
            cy2 = y1 + int(h * band_end)
            crop = frame[cy1:cy2, x1:x2]
            if crop.size == 0:
                continue
            crop = _preprocess(crop)
            # Digits aren't horizontally symmetric, so a flipped pass only
            # injects noise. Single, well-preprocessed read per band.
            for c in [crop]:
                try:
                    results = reader.readtext(c, allowlist="0123456789", detail=1)
                except Exception:
                    continue
                for item in results:
                    # detail=1 → (bbox, text, conf)
                    if not isinstance(item, (list, tuple)) or len(item) < 3:
                        continue
                    text, conf = item[1], float(item[2])
                    if conf < OCR_MIN_CONF:
                        continue
                    num = _extract_jersey_number(str(text))
                    if num is None:
                        continue
                    if roster is not None:
                        snapped = _snap_to_roster(num, roster)
                        if snapped is None:
                            continue
                        num = snapped
                    self._scores[track_id][num] += conf

        # Try to confirm
        scores = self._scores[track_id]
        if not scores:
            return
        if self._frame_counts[track_id] < CONFIRM_MIN_FRAMES:
            return
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        top_num, top_score = ranked[0]
        runner_score = ranked[1][1] if len(ranked) > 1 else 0.0
        if top_score >= CONFIRM_VOTE_SCORE and (top_score - runner_score) >= CONFIRM_VOTE_LEAD:
            self._confirmed[track_id] = top_num

    def confirmed_identities(self) -> dict[int, int]:
        """Return {track_id: jersey_number} for all confirmed tracks."""
        return dict(self._confirmed)

    def restrict_to_team_rosters(
        self,
        track_team_map: dict[int, str],
        rosters_by_team: dict[str, set[int]],
    ) -> None:
        """Once team assignment is known, filter each track's accumulated
        OCR scores down to its team's roster and re-evaluate confirmation.
        Numbers that aren't in either roster are dropped via snap, sharply
        boosting accuracy vs. the wider union used during the OCR loop."""
        if not rosters_by_team:
            return
        new_scores: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        new_confirmed: dict[int, int] = {}
        for tid, scores in self._scores.items():
            team = track_team_map.get(tid)
            roster = rosters_by_team.get(team) if team else None
            if not roster:
                # No team yet — keep existing scores
                for num, sc in scores.items():
                    new_scores[tid][num] += sc
            else:
                for num, sc in scores.items():
                    snapped = _snap_to_roster(num, roster)
                    if snapped is None:
                        continue
                    new_scores[tid][snapped] += sc
            ranked = sorted(new_scores[tid].items(), key=lambda kv: kv[1], reverse=True)
            if not ranked:
                continue
            top_num, top_score = ranked[0]
            runner_score = ranked[1][1] if len(ranked) > 1 else 0.0
            if top_score >= CONFIRM_VOTE_SCORE and (top_score - runner_score) >= CONFIRM_VOTE_LEAD:
                new_confirmed[tid] = top_num
            elif tid in self._confirmed and self._confirmed[tid] in new_scores[tid]:
                # Preserve previously-confirmed identity if still consistent
                new_confirmed[tid] = self._confirmed[tid]
        # ── Enforce per-team roster exclusivity ──
        # If two tracks on the same team confirm to the same jersey, keep only
        # the one with the higher Σ-confidence score.
        by_team_jersey: dict[tuple[str, int], list[tuple[int, float]]] = defaultdict(list)
        for tid, jersey in new_confirmed.items():
            team = track_team_map.get(tid)
            if team is None:
                continue
            score = new_scores[tid].get(jersey, 0.0)
            by_team_jersey[(team, jersey)].append((tid, score))
        for (_team, _jersey), entries in by_team_jersey.items():
            if len(entries) <= 1:
                continue
            entries.sort(key=lambda kv: kv[1], reverse=True)
            for tid, _sc in entries[1:]:
                new_confirmed.pop(tid, None)
        self._scores = new_scores
        self._confirmed = new_confirmed

    def best_guess_identities(self) -> dict[int, tuple[int, float]]:
        """Return {track_id: (jersey_number, score)} for every track that has
        any OCR votes — including ones that haven't passed the confirmation
        threshold yet. Useful so the UI can show a low-confidence guess
        instead of falling back to the raw track ID."""
        out: dict[int, tuple[int, float]] = {}
        for tid, scores in self._scores.items():
            if not scores:
                continue
            top_num, top_score = max(scores.items(), key=lambda kv: kv[1])
            out[tid] = (top_num, round(float(top_score), 3))
        return out

    def player_identity_summary(self, track_id: int) -> dict:
        """Return jersey_number / guess / confidence for one player."""
        out: dict = {}
        if track_id in self._confirmed:
            out["jersey_number"] = self._confirmed[track_id]
        scores = self._scores.get(track_id)
        if scores:
            top_num, top_score = max(scores.items(), key=lambda kv: kv[1])
            out["jersey_number_guess"] = top_num
            out["jersey_confidence"] = round(float(top_score), 3)
        return out
