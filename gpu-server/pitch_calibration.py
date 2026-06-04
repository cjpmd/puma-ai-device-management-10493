"""
Pitch homography calibration — maps pixel coordinates to real-world metres.

Automatic method: detects the largest green region (pitch) in a frame,
fits a bounding rectangle to its corners, then computes a homography to
the known pitch dimensions.

Fallback: aspect-ratio estimate using configurable pitch dimensions.
"""

import cv2
import numpy as np
from typing import Optional, Tuple

PITCH_LENGTH_M = 105.0
PITCH_WIDTH_M  = 68.0
PITCH_9V9_LENGTH_M = 80.0
PITCH_9V9_WIDTH_M  = 50.0


class PitchCalibrator:
    """
    Computes a homography matrix mapping pixel coordinates to pitch metres.

    Usage:
        calibrator = PitchCalibrator(pitch_length_m=80, pitch_width_m=50)
        calibrator.calibrate_from_frame(frame)      # returns True if successful
        x_m, y_m = calibrator.pixel_to_metres(px, py)
        dist_m   = calibrator.distance_metres(px1, py1, px2, py2)
    """

    def __init__(self, pitch_length_m: float = PITCH_9V9_LENGTH_M,
                 pitch_width_m: float = PITCH_9V9_WIDTH_M):
        self.pitch_length_m = pitch_length_m
        self.pitch_width_m  = pitch_width_m
        self.H: Optional[np.ndarray] = None
        self.H_inv: Optional[np.ndarray] = None
        self.calibrated = False
        self.pixels_per_metre_estimate = 1.0

    def calibrate_from_frame(self, frame: np.ndarray) -> bool:
        """
        Attempt automatic calibration. Returns True on success.
        Always sets pixels_per_metre_estimate as a fallback value.
        """
        h, w = frame.shape[:2]
        corners_px = self._detect_pitch_corners(frame)
        if corners_px is not None and len(corners_px) == 4:
            ok = self._compute_homography(corners_px, w, h)
            if ok:
                return True
        self._fallback_calibration(w, h)
        return False

    def _detect_pitch_corners(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """Return 4 corner points of the pitch bounding rect, or None."""
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower_green = np.array([35, 40, 40])
        upper_green = np.array([85, 255, 255])
        mask = cv2.inRange(hsv, lower_green, upper_green)

        # Morphological cleanup to fill small gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        h, w = frame.shape[:2]
        if area < w * h * 0.10:
            return None

        rect = cv2.minAreaRect(largest)
        corners = cv2.boxPoints(rect).astype(np.float32)
        return self._order_points(corners)

    def _order_points(self, pts: np.ndarray) -> np.ndarray:
        """Order 4 points: top-left, top-right, bottom-right, bottom-left."""
        rect = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]   # TL: smallest sum
        rect[2] = pts[np.argmax(s)]   # BR: largest sum
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]  # TR: smallest diff
        rect[3] = pts[np.argmax(diff)]  # BL: largest diff
        return rect

    def _compute_homography(self, corners_px: np.ndarray,
                            frame_w: int, frame_h: int) -> bool:
        """Compute H from 4 pixel corners → real pitch corners in metres."""
        L, W = self.pitch_length_m, self.pitch_width_m
        corners_m = np.array([
            [0, 0],   # TL
            [L, 0],   # TR
            [L, W],   # BR
            [0, W],   # BL
        ], dtype=np.float32)

        H, mask = cv2.findHomography(corners_px, corners_m, cv2.RANSAC, 5.0)
        if H is None:
            return False

        self.H = H
        self.H_inv = np.linalg.inv(H)
        self.calibrated = True

        # Derive pixels_per_metre from the centre of frame
        cx, cy = frame_w / 2.0, frame_h / 2.0
        step_px = np.array([[[cx + 1.0, cy]]], dtype=np.float32)
        base_px = np.array([[[cx, cy]]], dtype=np.float32)
        step_m = cv2.perspectiveTransform(step_px, H)[0][0]
        base_m = cv2.perspectiveTransform(base_px, H)[0][0]
        dx_m = abs(float(step_m[0]) - float(base_m[0]))
        self.pixels_per_metre_estimate = 1.0 / max(dx_m, 0.001)
        return True

    def _fallback_calibration(self, frame_w: int, frame_h: int):
        """Estimate pixels_per_metre by assuming pitch fills ~85% of frame width."""
        self.pixels_per_metre_estimate = (frame_w * 0.85) / self.pitch_length_m
        self.calibrated = False
        print(f"[calibration] Fallback: {self.pixels_per_metre_estimate:.2f} px/m "
              f"(pitch {self.pitch_length_m}×{self.pitch_width_m}m, frame {frame_w}px wide)")

    def pixel_to_metres(self, px: float, py: float) -> Tuple[float, float]:
        """Convert pixel coordinates to pitch metres."""
        if self.H is not None:
            pt = np.array([[[px, py]]], dtype=np.float32)
            result = cv2.perspectiveTransform(pt, self.H)
            return float(result[0][0][0]), float(result[0][0][1])
        ppm = self.pixels_per_metre_estimate
        return float(px / ppm), float(py / ppm)

    def metres_to_pixels(self, x_m: float, y_m: float) -> Tuple[float, float]:
        """Convert pitch metres back to pixel coordinates."""
        if self.H_inv is not None:
            pt = np.array([[[x_m, y_m]]], dtype=np.float32)
            result = cv2.perspectiveTransform(pt, self.H_inv)
            return float(result[0][0][0]), float(result[0][0][1])
        ppm = self.pixels_per_metre_estimate
        return float(x_m * ppm), float(y_m * ppm)

    def distance_metres(self, px1: float, py1: float,
                        px2: float, py2: float) -> float:
        """Real-world distance in metres between two pixel points."""
        x1, y1 = self.pixel_to_metres(px1, py1)
        x2, y2 = self.pixel_to_metres(px2, py2)
        return float(np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2))
