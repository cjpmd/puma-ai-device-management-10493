"""
JerseyNumberTracker — cross-session player identity via jersey number OCR.

Runs EasyOCR on the upper-body crop of each player bbox (25–55% of bbox height).
A jersey number is confirmed after MIN_CONFIRMATIONS consistent readings.
OCR runs every OCR_EVERY_N frames to limit GPU overhead (~15–20ms per crop).

Integration (inside ByteTrack loop in run_analysis):
    jersey_tracker = JerseyNumberTracker()
    jersey_tracker.update(frame, track_id, bbox_xyxy)
    # after frame loop:
    identity_map = jersey_tracker.confirmed_identities()  # {track_id: jersey_number}
"""

from __future__ import annotations
import re
from collections import defaultdict, Counter
from typing import Optional

import numpy as np

OCR_EVERY_N      = 15   # run OCR every N frames for this track
MIN_CONFIRMATIONS = 3   # readings must agree this many times to confirm
CROP_Y_START_PCT  = 0.25
CROP_Y_END_PCT    = 0.55
MIN_CROP_SIZE     = 20  # pixels — skip tiny detections


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


class JerseyNumberTracker:
    def __init__(self):
        self._frame_counts: dict[int, int] = defaultdict(int)  # frames seen per track
        self._readings:     dict[int, list[int]] = defaultdict(list)  # raw OCR hits
        self._confirmed:    dict[int, int] = {}  # track_id → jersey_number

    def update(
        self,
        frame: np.ndarray,
        track_id: int,
        bbox_xyxy: tuple[float, float, float, float],
    ) -> None:
        """Call once per tracked player per frame."""
        if track_id in self._confirmed:
            return  # already locked in

        count = self._frame_counts[track_id]
        self._frame_counts[track_id] += 1

        if count % OCR_EVERY_N != 0:
            return

        x1, y1, x2, y2 = [int(v) for v in bbox_xyxy]
        h = y2 - y1
        w = x2 - x1
        if h < MIN_CROP_SIZE or w < MIN_CROP_SIZE:
            return

        crop_y1 = y1 + int(h * CROP_Y_START_PCT)
        crop_y2 = y1 + int(h * CROP_Y_END_PCT)
        crop = frame[crop_y1:crop_y2, x1:x2]

        if crop.size == 0:
            return

        try:
            reader = _get_reader()
            results = reader.readtext(crop, allowlist="0123456789", detail=0)
            for text in results:
                num = _extract_jersey_number(str(text))
                if num is not None:
                    self._readings[track_id].append(num)
        except Exception:
            return  # OCR errors are non-fatal

        # Confirm if MIN_CONFIRMATIONS readings agree
        readings = self._readings[track_id]
        if len(readings) >= MIN_CONFIRMATIONS:
            counter = Counter(readings)
            top_num, top_count = counter.most_common(1)[0]
            if top_count >= MIN_CONFIRMATIONS:
                self._confirmed[track_id] = top_num

    def confirmed_identities(self) -> dict[int, int]:
        """Return {track_id: jersey_number} for all confirmed tracks."""
        return dict(self._confirmed)

    def player_identity_summary(self, track_id: int) -> dict:
        """Return jersey_number for one player, or empty dict if not confirmed."""
        if track_id in self._confirmed:
            return {"jersey_number": self._confirmed[track_id]}
        return {}
