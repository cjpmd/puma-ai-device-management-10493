"""
JerseyNumberTracker — player identity via jersey number OCR.

ROOT CAUSE FINDINGS (Pain point 2 — wrong numbers / misreads)
-------------------------------------------------------------
1. General-purpose EasyOCR on tiny torso crops: the dominant misread source.
   Digits-only allowlist helps but EasyOCR still confuses 1↔7, 6↔8, 0↔8 on
   blurred or curved shirts.
2. No motion-blur gating — high-blur frames produced confident garbage reads
   that polluted the vote tally.
3. Output space not constrained: regex accepted "0" and any 1–2 digit string
   inside longer text; nothing rejected reads outside 1–99.
4. Confirmation threshold too weak: Σ-confidence ≥ 1.1 ≈ two reads could lock
   a wrong number; there was no requirement for consistency across distinct
   frames.
5. No specialist digit classifier and no multi-view pooling.

FIX IMPLEMENTED
---------------
* SVHN-style digit classifier (digit_classifier.py) runs first when its
  fine-tuned weights are configured; EasyOCR is the fallback/ensemble. Both
  feed the same per-track vote tally.
* Blur gating: Laplacian-variance score per crop; blurred crops are skipped
  (the previous confident reading stands — we simply don't add noise).
* Preprocessing: upscale → CLAHE → unsharp; an Otsu-binarised second pass
  runs when the first pass yields nothing.
* Hard output constraint: numbers must be 1–99, standalone 1–2 digit string.
* Temporal voting: a number must be read in ≥ CONFIRM_MIN_READS *distinct
  frames* AND reach Σ-confidence ≥ CONFIRM_VOTE_SCORE with a clear lead
  before it is committed. Once committed the track is locked and OCR stops
  (cost ↓, flip-flopping impossible).
* Multi-view pooling: merge_scores_from() pools votes from a second camera
  before confirmation (used by multicam fusion).
* Structured metrics: lock rate, per-track confidence distribution, blur
  skips, range rejections — exported per match.
"""

from __future__ import annotations
import os
import re
from collections import defaultdict
from typing import Optional

import numpy as np

# Sampling cadence
OCR_EVERY_N_NEAR  = 4    # bbox height >= NEAR_BBOX_PX
OCR_EVERY_N_FAR   = 12   # smaller bboxes
NEAR_BBOX_PX      = 120

# Crop bands as (y_start_pct, y_end_pct) — chest-high, chest, back
CROP_BANDS = ((0.18, 0.42), (0.28, 0.48), (0.50, 0.72))
MIN_CROP_SIZE     = 14   # pixels — skip tiny detections
UPSCALE_TARGET_H  = 192  # px — upscale band to this height before OCR

# Blur gating — Laplacian variance on the upscaled grayscale band.
# Below this the crop is motion-blurred and OCR output is noise.
BLUR_MIN_LAPLACIAN_VAR = float(os.environ.get("OCR_BLUR_MIN_VAR", 60.0))

# Voting
OCR_MIN_CONF       = 0.40
CONFIRM_VOTE_SCORE = 1.5   # Σ confidence required for the winning number
CONFIRM_VOTE_LEAD  = 0.5   # winner must beat runner-up by this much
CONFIRM_MIN_FRAMES = 6     # don't confirm before this many frames seen
CONFIRM_MIN_READS  = 3     # winning number must be read in >= N distinct frames

# Digit classifier ensemble
DIGIT_CLS_MIN_CONF = 0.55  # below this the classifier read is discarded
DIGIT_CLS_WEIGHT   = 1.25  # classifier votes count more than EasyOCR votes

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
    """Pull a standalone 1–2 digit integer from OCR text, constrained to 1–99."""
    s = str(text).strip()
    # Whole string must be the number (with optional surrounding junk chars
    # stripped) — a digit pair inside longer garbage is not a jersey number.
    matches = re.findall(r"(?<!\d)(\d{1,2})(?!\d)", s)
    for m in matches:
        num = int(m)
        if 1 <= num <= 99:
            return num
    return None


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 2:
        return max(len(a), len(b))
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


def _blur_score(gray: np.ndarray) -> float:
    """Laplacian variance — low values mean motion blur / defocus."""
    import cv2
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _preprocess(crop: np.ndarray) -> tuple[np.ndarray | None, np.ndarray | None, float]:
    """Upscale + CLAHE + unsharp; also produce an Otsu-binarised variant.
    Returns (sharpened_bgr, binarised_bgr, blur_score)."""
    try:
        import cv2
    except Exception:
        return crop, None, 1e9
    h, w = crop.shape[:2]
    if h == 0 or w == 0:
        return None, None, 0.0
    if h < UPSCALE_TARGET_H:
        scale = UPSCALE_TARGET_H / h
        crop = cv2.resize(crop, (int(w * scale), UPSCALE_TARGET_H), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    blur = _blur_score(gray)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    eq = clahe.apply(gray)
    soft = cv2.GaussianBlur(eq, (0, 0), sigmaX=1.0)
    sharp = cv2.addWeighted(eq, 1.5, soft, -0.5, 0)
    # Otsu binarisation second-chance pass — strong on low-contrast numbers
    _, binarised = cv2.threshold(eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Numbers may be light-on-dark or dark-on-light; normalise to dark digits
    if np.mean(binarised) < 127:
        binarised = cv2.bitwise_not(binarised)
    return (
        cv2.cvtColor(sharp, cv2.COLOR_GRAY2BGR),
        cv2.cvtColor(binarised, cv2.COLOR_GRAY2BGR),
        blur,
    )


class JerseyNumberTracker:
    def __init__(self, use_digit_classifier: bool = True):
        self._frame_counts: dict[int, int] = defaultdict(int)
        # track_id -> {jersey_number: Σ confidence}
        self._scores:    dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        # track_id -> {jersey_number: distinct frames in which it was read}
        self._read_frames: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
        self._confirmed: dict[int, int] = {}
        # team_label -> set of allowed jersey numbers (optional)
        self._rosters: dict[str, set[int]] = {}

        self._digit_cls = None
        if use_digit_classifier:
            try:
                from digit_classifier import get_classifier
                cls = get_classifier()
                self._digit_cls = cls if cls.available else None
            except Exception:
                self._digit_cls = None

        # ── structured metrics ──
        self.metrics = {
            "ocr_attempts": 0,
            "blur_skips": 0,
            "reads_accepted": 0,
            "reads_rejected_range": 0,
            "reads_rejected_conf": 0,
            "digit_cls_reads": 0,
            "easyocr_reads": 0,
        }

    def __deepcopy__(self, memo):
        # handler.py deep-copies the tracker to trial roster mappings; the
        # digit-classifier model must be shared, not copied (it is never mutated)
        import copy as _copy
        new = JerseyNumberTracker.__new__(JerseyNumberTracker)
        memo[id(self)] = new
        for k, v in self.__dict__.items():
            new.__dict__[k] = v if k == "_digit_cls" else _copy.deepcopy(v, memo)
        return new

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
            return  # locked — OCR stops for this track (cost + stability)

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
        self.metrics["ocr_attempts"] += 1

        # Trim 15% off each side: arms/background pollute the number region
        cx1 = x1 + int(w * 0.15)
        cx2 = x2 - int(w * 0.15)

        frame_reads: dict[int, float] = {}  # number -> best confidence this frame

        for (band_start, band_end) in CROP_BANDS:
            cy1 = y1 + int(h * band_start)
            cy2 = y1 + int(h * band_end)
            crop = frame[cy1:cy2, cx1:cx2]
            if crop.size == 0:
                continue
            sharp, binarised, blur = _preprocess(crop)
            if sharp is None:
                continue
            if blur < BLUR_MIN_LAPLACIAN_VAR:
                # Motion-blurred — skip rather than feed noise into the vote
                self.metrics["blur_skips"] += 1
                continue

            # ── 1) SVHN-style digit classifier (specialist, preferred) ──
            if self._digit_cls is not None:
                pred = self._digit_cls.predict(sharp)
                if pred is not None:
                    num, conf = pred
                    if conf >= DIGIT_CLS_MIN_CONF:
                        snapped = _snap_to_roster(num, roster) if roster is not None else num
                        if snapped is not None:
                            weighted = conf * DIGIT_CLS_WEIGHT
                            if weighted > frame_reads.get(snapped, 0.0):
                                frame_reads[snapped] = weighted
                            self.metrics["digit_cls_reads"] += 1

            # ── 2) EasyOCR (fallback / ensemble) ──
            try:
                reader = _get_reader()
            except Exception:
                continue
            results = []
            try:
                results = reader.readtext(sharp, allowlist="0123456789", detail=1)
            except Exception:
                results = []
            if not results and binarised is not None:
                try:
                    results = reader.readtext(binarised, allowlist="0123456789", detail=1)
                except Exception:
                    results = []
            for item in results:
                if not isinstance(item, (list, tuple)) or len(item) < 3:
                    continue
                text, conf = item[1], float(item[2])
                if conf < OCR_MIN_CONF:
                    self.metrics["reads_rejected_conf"] += 1
                    continue
                num = _extract_jersey_number(str(text))
                if num is None:
                    self.metrics["reads_rejected_range"] += 1
                    continue
                if roster is not None:
                    snapped = _snap_to_roster(num, roster)
                    if snapped is None:
                        continue
                    num = snapped
                self.metrics["easyocr_reads"] += 1
                if conf > frame_reads.get(num, 0.0):
                    frame_reads[num] = conf

        # Commit this frame's reads: one vote per number per frame
        for num, conf in frame_reads.items():
            self._scores[track_id][num] += conf
            self._read_frames[track_id][num] += 1
            self.metrics["reads_accepted"] += 1

        self._try_confirm(track_id)

    def _try_confirm(self, track_id: int) -> None:
        scores = self._scores[track_id]
        if not scores:
            return
        if self._frame_counts[track_id] < CONFIRM_MIN_FRAMES:
            return
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        top_num, top_score = ranked[0]
        runner_score = ranked[1][1] if len(ranked) > 1 else 0.0
        if (top_score >= CONFIRM_VOTE_SCORE
                and (top_score - runner_score) >= CONFIRM_VOTE_LEAD
                and self._read_frames[track_id][top_num] >= CONFIRM_MIN_READS):
            self._confirmed[track_id] = top_num

    def confirmed_identities(self) -> dict[int, int]:
        """Return {track_id: jersey_number} for all confirmed tracks."""
        return dict(self._confirmed)

    # ── Track-merge / multi-view support ─────────────────────────────────
    def remap_tracks(self, mapping: dict[int, int]) -> None:
        """Re-key all accumulated state when track IDs are merged
        (fragment_tid -> canonical_tid)."""
        for src, dst in mapping.items():
            if src == dst:
                continue
            for num, sc in self._scores.pop(src, {}).items():
                self._scores[dst][num] += sc
            for num, n in self._read_frames.pop(src, {}).items():
                self._read_frames[dst][num] += n
            self._frame_counts[dst] += self._frame_counts.pop(src, 0)
            src_conf = self._confirmed.pop(src, None)
            if src_conf is not None and dst not in self._confirmed:
                self._confirmed[dst] = src_conf
            self._try_confirm(dst)

    def merge_scores_from(self, other: "JerseyNumberTracker",
                          id_mapping: dict[int, int],
                          view_weight: float = 0.8) -> int:
        """Pool OCR votes from another camera view before committing numbers.
        id_mapping: {other_track_id: this_track_id}. Returns merged-track count."""
        merged = 0
        for other_tid, this_tid in id_mapping.items():
            other_scores = other._scores.get(other_tid)
            if not other_scores:
                continue
            for num, sc in other_scores.items():
                self._scores[this_tid][num] += sc * view_weight
            for num, n in other._read_frames.get(other_tid, {}).items():
                self._read_frames[this_tid][num] += n
            merged += 1
            if this_tid not in self._confirmed:
                self._try_confirm(this_tid)
        return merged

    def restrict_to_team_rosters(
        self,
        track_team_map: dict[int, str],
        rosters_by_team: dict[str, set[int]],
    ) -> None:
        """Once team assignment is known, filter each track's accumulated
        OCR scores down to its team's roster and re-evaluate confirmation."""
        if not rosters_by_team:
            return
        new_scores: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        new_reads: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
        new_confirmed: dict[int, int] = {}
        for tid, scores in self._scores.items():
            team = track_team_map.get(tid)
            roster = rosters_by_team.get(team) if team else None
            for num, sc in scores.items():
                snapped = _snap_to_roster(num, roster) if roster else num
                if snapped is None:
                    continue
                new_scores[tid][snapped] += sc
                new_reads[tid][snapped] += self._read_frames[tid].get(num, 0)
            ranked = sorted(new_scores[tid].items(), key=lambda kv: kv[1], reverse=True)
            if not ranked:
                continue
            top_num, top_score = ranked[0]
            runner_score = ranked[1][1] if len(ranked) > 1 else 0.0
            if (top_score >= CONFIRM_VOTE_SCORE
                    and (top_score - runner_score) >= CONFIRM_VOTE_LEAD
                    and new_reads[tid][top_num] >= CONFIRM_MIN_READS):
                new_confirmed[tid] = top_num
            elif tid in self._confirmed and self._confirmed[tid] in new_scores[tid]:
                # Preserve previously-confirmed identity if still consistent
                new_confirmed[tid] = self._confirmed[tid]
        # ── Enforce per-team roster exclusivity ──
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
        self._read_frames = new_reads
        self._confirmed = new_confirmed

    def best_guess_identities(self) -> dict[int, tuple[int, float]]:
        """{track_id: (jersey_number, score)} for every track with any votes."""
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

    def get_metrics(self) -> dict:
        """Structured OCR-quality metrics for production monitoring."""
        attempted = {tid for tid, n in self._frame_counts.items() if n > 0}
        conf_values = []
        for tid, scores in self._scores.items():
            if scores:
                conf_values.append(max(scores.values()))
        hist = {"0-0.5": 0, "0.5-1": 0, "1-1.5": 0, "1.5-3": 0, "3+": 0}
        for v in conf_values:
            if v < 0.5: hist["0-0.5"] += 1
            elif v < 1.0: hist["0.5-1"] += 1
            elif v < 1.5: hist["1-1.5"] += 1
            elif v < 3.0: hist["1.5-3"] += 1
            else: hist["3+"] += 1
        m = dict(self.metrics)
        m.update({
            "tracks_attempted": len(attempted),
            "tracks_locked": len(self._confirmed),
            "lock_rate": round(len(self._confirmed) / max(1, len(attempted)), 3),
            "confidence_histogram": hist,
        })
        return m
