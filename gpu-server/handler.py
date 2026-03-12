"""
RunPod Serverless Handler — Ball-Following Virtual Camera Pipeline

This handler runs on RunPod GPU workers. It:
1. Downloads dual-camera footage from Wasabi
2. Synchronizes frames via audio cross-correlation
3. Stitches frames into a panorama (homography or linear blend fallback)
4. Detects the ball using a 3-stage pipeline (YOLO → motion fallback → Kalman prediction)
5. Tracks players using ByteTrack (persistent IDs across frames)
6. Applies play-switch prediction and dynamic zoom
7. Computes a smooth virtual camera crop that follows the ball
8. Renders the output and uploads back to Wasabi
9. POSTs results to the webhook
"""

import os
import json
import tempfile
import time
import subprocess
import requests
import runpod
import boto3
import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv
from scipy.signal import correlate
from filterpy.kalman import KalmanFilter


# ─── Wasabi S3 helpers ────────────────────────────────────────────────

def get_s3_client(job_input: dict):
    """Create a boto3 S3 client configured for Wasabi."""
    region = (job_input.get("wasabi_region") or "us-east-1").strip()
    endpoint = (job_input.get("wasabi_endpoint") or f"https://s3.{region}.wasabisys.com").strip()
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=job_input["wasabi_access_key"],
        aws_secret_access_key=job_input["wasabi_secret_key"],
        region_name=region,
    )


def download_from_wasabi(s3, bucket: str, key: str, local_path: str):
    print(f"⬇ Downloading s3://{bucket}/{key}")
    s3.download_file(bucket, key, local_path)
    print(f"  ✓ Downloaded {os.path.getsize(local_path) / 1e6:.1f} MB")


def upload_to_wasabi(s3, bucket: str, key: str, local_path: str, content_type: str = "video/mp4"):
    print(f"⬆ Uploading to s3://{bucket}/{key}")
    s3.upload_file(
        local_path, bucket, key,
        ExtraArgs={"ContentType": content_type}
    )
    print(f"  ✓ Uploaded {os.path.getsize(local_path) / 1e6:.1f} MB")


# ─── Audio synchronization ──────────────────────────────────────────

def extract_audio_mono(video_path: str, audio_path: str, sample_rate: int = 16000):
    """Extract mono audio from video using ffmpeg."""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-ac", "1", "-ar", str(sample_rate),
        "-vn", "-f", "s16le", audio_path
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        print(f"⚠ ffmpeg audio extraction failed: {result.stderr.decode()[:200]}")
        return None
    return np.frombuffer(open(audio_path, "rb").read(), dtype=np.int16).astype(np.float32)


def sync_videos(left_path: str, right_path: str, fps: float, tmpdir: str) -> tuple:
    """
    Synchronize two video files using audio cross-correlation.
    Returns (left_offset_frames, right_offset_frames) — one will be 0.
    """
    print("🔄 Synchronizing videos via audio cross-correlation...")

    sample_rate = 16000
    left_audio = extract_audio_mono(left_path, os.path.join(tmpdir, "left.pcm"), sample_rate)
    right_audio = extract_audio_mono(right_path, os.path.join(tmpdir, "right.pcm"), sample_rate)

    if left_audio is None or right_audio is None:
        print("  ⚠ Audio extraction failed, assuming synced start")
        return (0, 0)

    # Use first 30 seconds for correlation (faster than full video)
    max_samples = sample_rate * 30
    left_chunk = left_audio[:max_samples]
    right_chunk = right_audio[:max_samples]

    # Cross-correlate
    correlation = correlate(left_chunk, right_chunk, mode="full")
    lag_samples = np.argmax(correlation) - len(right_chunk) + 1
    lag_seconds = lag_samples / sample_rate
    lag_frames = int(round(lag_seconds * fps))

    print(f"  Audio lag: {lag_seconds:.3f}s = {lag_frames} frames")

    if lag_frames > 0:
        return (lag_frames, 0)  # left starts later, skip left frames
    elif lag_frames < 0:
        return (0, -lag_frames)  # right starts later, skip right frames
    return (0, 0)


# ─── Panorama stitching ─────────────────────────────────────────────

class PanoramaStitcher:
    """
    Stitches left and right camera frames into a panorama.
    Uses ORB feature matching + homography on the first frame,
    then caches the transform for subsequent frames.
    Falls back to linear blend if feature matching fails.
    """

    def __init__(self):
        self.homography = None
        self.calibrated = False
        self.orb = cv2.ORB_create(nfeatures=2000)
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

    def _compute_homography(self, left: np.ndarray, right: np.ndarray) -> bool:
        """Compute homography from right frame to left frame's plane."""
        gray_l = cv2.cvtColor(left, cv2.COLOR_BGR2GRAY)
        gray_r = cv2.cvtColor(right, cv2.COLOR_BGR2GRAY)

        kp_l, des_l = self.orb.detectAndCompute(gray_l, None)
        kp_r, des_r = self.orb.detectAndCompute(gray_r, None)

        if des_l is None or des_r is None or len(kp_l) < 10 or len(kp_r) < 10:
            print("  ⚠ Not enough features for homography")
            return False

        # KNN match + Lowe's ratio test
        matches = self.bf.knnMatch(des_r, des_l, k=2)
        good = []
        for pair in matches:
            if len(pair) == 2:
                m, n = pair
                if m.distance < 0.75 * n.distance:
                    good.append(m)

        if len(good) < 15:
            print(f"  ⚠ Only {len(good)} good matches (need 15+)")
            return False

        src_pts = np.float32([kp_r[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp_l[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

        H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
        if H is None:
            print("  ⚠ Homography computation failed")
            return False

        inliers = mask.ravel().sum()
        print(f"  ✓ Homography computed: {inliers}/{len(good)} inliers")
        self.homography = H
        self.calibrated = True
        return True

    def stitch(self, left: np.ndarray, right: np.ndarray) -> np.ndarray:
        """Stitch left and right into a panorama."""
        h_l, w_l = left.shape[:2]
        h_r, w_r = right.shape[:2]

        # Resize to same height if needed
        if h_l != h_r:
            scale = h_l / h_r
            right = cv2.resize(right, (int(w_r * scale), h_l))
            w_r = int(w_r * scale)

        # Try homography stitching
        if not self.calibrated:
            self._compute_homography(left, right)

        if self.calibrated and self.homography is not None:
            return self._stitch_homography(left, right)

        # Fallback: linear blend
        return self._stitch_blend(left, right)

    def _stitch_homography(self, left: np.ndarray, right: np.ndarray) -> np.ndarray:
        """Warp right frame onto left's plane using cached homography."""
        h_l, w_l = left.shape[:2]
        h_r, w_r = right.shape[:2]

        # Determine output canvas size
        corners_r = np.float32([
            [0, 0], [w_r, 0], [w_r, h_r], [0, h_r]
        ]).reshape(-1, 1, 2)
        warped_corners = cv2.perspectiveTransform(corners_r, self.homography)
        all_corners = np.concatenate([
            np.float32([[0, 0], [w_l, 0], [w_l, h_l], [0, h_l]]).reshape(-1, 1, 2),
            warped_corners
        ])

        x_min = int(np.floor(all_corners[:, 0, 0].min()))
        x_max = int(np.ceil(all_corners[:, 0, 0].max()))
        y_min = int(np.floor(all_corners[:, 0, 1].min()))
        y_max = int(np.ceil(all_corners[:, 0, 1].max()))

        # Clamp to reasonable size (prevent explosion)
        canvas_w = min(x_max - x_min, w_l + w_r)
        canvas_h = min(y_max - y_min, max(h_l, h_r) + 200)

        # Translation to handle negative coordinates
        offset = np.array([[1, 0, -x_min], [0, 1, -y_min], [0, 0, 1]], dtype=np.float64)
        H_offset = offset @ self.homography

        panorama = cv2.warpPerspective(right, H_offset, (canvas_w, canvas_h))

        # Place left frame
        ox, oy = -x_min, -y_min
        roi = panorama[oy:oy + h_l, ox:ox + w_l]
        # Blend overlap region
        mask = (roi > 0).any(axis=2)
        left_region = left.copy()
        left_region[mask] = (left_region[mask] * 0.5 + roi[mask] * 0.5).astype(np.uint8)
        panorama[oy:oy + h_l, ox:ox + w_l] = left_region

        return panorama

    def _stitch_blend(self, left: np.ndarray, right: np.ndarray) -> np.ndarray:
        """Simple horizontal stitch with linear blend in overlap zone."""
        h_l, w_l = left.shape[:2]
        h_r, w_r = right.shape[:2]

        overlap = int(min(w_l, w_r) * 0.10)
        if overlap < 10:
            return np.hstack([left, right])

        pano_width = w_l + w_r - overlap
        panorama = np.zeros((h_l, pano_width, 3), dtype=np.uint8)

        panorama[:, :w_l - overlap] = left[:, :w_l - overlap]

        alpha = np.linspace(0, 1, overlap).reshape(1, -1, 1)
        blend = ((1 - alpha) * left[:, w_l - overlap:] + alpha * right[:, :overlap]).astype(np.uint8)
        panorama[:, w_l - overlap:w_l] = blend

        panorama[:, w_l:] = right[:, overlap:]

        return panorama


# ─── Ball detection ──────────────────────────────────────────────────

BALL_CLASSES = {"sports ball", "ball", "football"}
PERSON_CLASSES = {"person"}


def parse_detections(results, target_classes: set) -> list:
    """Parse YOLO results for specific classes. Returns list of (cx, cy, x1, y1, x2, y2, conf, cls_name)."""
    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = r.names[cls_id].lower()
            conf = float(box.conf[0])
            if cls_name in target_classes and conf > 0.3:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                detections.append((cx, cy, x1, y1, x2, y2, conf, cls_name))
    return detections


# ─── Stage 2: Motion detection fallback ─────────────────────────────

class MotionDetector:
    """
    Detects fast-moving small objects via frame differencing.
    Used as fallback when YOLO misses the ball.
    """

    def __init__(self, min_area: int = 30, max_area: int = 2000, speed_threshold: float = 8.0):
        self.prev_gray = None
        self.prev_candidates = []
        self.min_area = min_area
        self.max_area = max_area
        self.speed_threshold = speed_threshold

    def detect(self, frame: np.ndarray) -> tuple | None:
        """
        Returns (cx, cy, confidence) of the most likely ball candidate,
        or None if no good candidate found.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        if self.prev_gray is None:
            self.prev_gray = gray
            return None

        # Frame difference
        diff = cv2.absdiff(self.prev_gray, gray)
        _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)

        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        thresh = cv2.dilate(thresh, kernel, iterations=1)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        for c in contours:
            area = cv2.contourArea(c)
            if self.min_area < area < self.max_area:
                M = cv2.moments(c)
                if M["m00"] == 0:
                    continue
                cx = M["m10"] / M["m00"]
                cy = M["m01"] / M["m00"]

                # Check speed against previous candidates
                speed = 0.0
                for pcx, pcy in self.prev_candidates:
                    d = np.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2)
                    speed = max(speed, d)

                if speed > self.speed_threshold:
                    # Score: prefer small, fast, round objects
                    perimeter = cv2.arcLength(c, True)
                    circularity = 4 * np.pi * area / (perimeter * perimeter + 1e-6)
                    score = speed * circularity / (area + 1.0)
                    candidates.append((cx, cy, score))

        # Save current candidates for next frame speed calculation
        self.prev_candidates = [(cx, cy) for cx, cy, _ in candidates] if candidates else []
        self.prev_gray = gray

        if not candidates:
            return None

        # Return best candidate with confidence capped at 0.5 (lower than YOLO)
        best = max(candidates, key=lambda c: c[2])
        confidence = min(0.5, best[2] / 10.0)
        return (best[0], best[1], confidence)


# ─── Stage 3: Kalman filter trajectory prediction ───────────────────

class KalmanBallPredictor:
    """
    Predicts ball position using a Kalman filter when detection fails.
    State: [x, y, vx, vy, ax, ay] — position, velocity, acceleration.
    """

    def __init__(self, fps: float = 30.0):
        self.kf = KalmanFilter(dim_x=6, dim_z=2)
        dt = 1.0 / fps

        # State transition: constant acceleration model
        self.kf.F = np.array([
            [1, 0, dt, 0, 0.5 * dt ** 2, 0],
            [0, 1, 0, dt, 0, 0.5 * dt ** 2],
            [0, 0, 1, 0, dt, 0],
            [0, 0, 0, 1, 0, dt],
            [0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1],
        ])

        # Measurement: we observe x, y
        self.kf.H = np.array([
            [1, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0],
        ])

        # Measurement noise
        self.kf.R = np.eye(2) * 10.0

        # Process noise
        self.kf.Q = np.eye(6) * 0.5
        self.kf.Q[4, 4] = 1.0  # acceleration noise
        self.kf.Q[5, 5] = 1.0

        # Initial covariance
        self.kf.P *= 100.0

        self.initialized = False
        self.frames_without_measurement = 0
        self.max_predict_frames = 30  # ~1 second at 30fps

    def update(self, measurement: tuple | None):
        """
        Call every frame. Pass (x, y) when detected, None when lost.
        """
        if measurement is not None:
            x, y = measurement
            if not self.initialized:
                self.kf.x = np.array([x, y, 0, 0, 0, 0]).reshape(6, 1)
                self.initialized = True
                self.frames_without_measurement = 0
                return
            self.kf.predict()
            self.kf.update(np.array([x, y]).reshape(2, 1))
            self.frames_without_measurement = 0
        else:
            if self.initialized:
                self.kf.predict()
                self.frames_without_measurement += 1

    def predict_position(self) -> tuple | None:
        """
        Returns (x, y, confidence) prediction, or None if not initialized
        or too many frames without measurement.
        """
        if not self.initialized:
            return None
        if self.frames_without_measurement > self.max_predict_frames:
            return None

        x = float(self.kf.x[0, 0])
        y = float(self.kf.x[1, 0])
        # Confidence decays with frames lost
        confidence = max(0.1, 0.4 * (1.0 - self.frames_without_measurement / self.max_predict_frames))
        return (x, y, confidence)

    def get_velocity(self) -> tuple:
        """Returns (vx, vy) in pixels/frame."""
        if not self.initialized:
            return (0.0, 0.0)
        return (float(self.kf.x[2, 0]), float(self.kf.x[3, 0]))


# ─── 3-Stage Ball Tracking Pipeline ─────────────────────────────────

class BallTrackingPipeline:
    """
    Combines three detection stages with confidence scoring:
    1. YOLO detection (highest confidence)
    2. Motion detection fallback (medium confidence)
    3. Kalman filter prediction (low but smooth confidence)
    """

    def __init__(self, fps: float = 30.0):
        self.motion_detector = MotionDetector()
        self.kalman = KalmanBallPredictor(fps=fps)
        self.last_stage = "none"
        self.consecutive_predictions = 0

    def update(self, yolo_detection: tuple | None, frame: np.ndarray) -> tuple | None:
        """
        Returns (x, y, confidence, stage) or None.
        yolo_detection: (cx, cy, conf) from YOLO, or None.
        frame: current panorama frame for motion detection.
        """
        # Stage 1: YOLO
        if yolo_detection is not None:
            x, y, conf = yolo_detection
            self.kalman.update((x, y))
            self.motion_detector.detect(frame)  # keep motion detector in sync
            self.last_stage = "yolo"
            self.consecutive_predictions = 0
            return (x, y, conf, "yolo")

        # Stage 2: Motion detection
        motion_result = self.motion_detector.detect(frame)
        if motion_result is not None:
            mx, my, mconf = motion_result
            # Validate against Kalman prediction if available
            kalman_pred = self.kalman.predict_position()
            if kalman_pred is not None:
                kx, ky, _ = kalman_pred
                dist = np.sqrt((mx - kx) ** 2 + (my - ky) ** 2)
                # Accept motion detection only if reasonably close to prediction
                if dist < 300:
                    self.kalman.update((mx, my))
                    self.last_stage = "motion"
                    self.consecutive_predictions = 0
                    return (mx, my, mconf, "motion")
            else:
                # No Kalman reference, accept motion detection
                self.kalman.update((mx, my))
                self.last_stage = "motion"
                self.consecutive_predictions = 0
                return (mx, my, mconf, "motion")

        # Stage 3: Kalman prediction
        self.kalman.update(None)
        prediction = self.kalman.predict_position()
        if prediction is not None:
            px, py, pconf = prediction
            self.last_stage = "kalman"
            self.consecutive_predictions += 1
            return (px, py, pconf, "kalman")

        self.last_stage = "none"
        self.consecutive_predictions += 1
        return None


# ─── Play-switch detection ───────────────────────────────────────────

class PlaySwitchDetector:
    """
    Detects rapid play switches (long passes, clearances) and provides
    camera lead distance to anticipate ball movement.
    """

    def __init__(self, panorama_width: float, fps: float = 30.0):
        self.panorama_width = panorama_width
        self.fps = fps
        self.velocity_history = []  # recent (vx, vy) values
        self.history_len = 10
        self.pass_threshold = 40.0  # px/frame for fast movement
        self.switch_threshold = 0.4  # fraction of pitch width

        self.prev_x = None
        self.is_switching = False
        self.switch_events = []

    def update(self, ball_x: float, ball_y: float, frame_idx: int) -> dict:
        """
        Returns {
            "lead_x": float,  # how far ahead to place camera (pixels)
            "lead_y": float,
            "is_switching": bool,
            "speed": float,   # ball speed in px/frame
        }
        """
        if self.prev_x is None:
            self.prev_x = ball_x
            self.prev_y = ball_y
            return {"lead_x": 0.0, "lead_y": 0.0, "is_switching": False, "speed": 0.0}

        vx = ball_x - self.prev_x
        vy = ball_y - self.prev_y
        speed = np.sqrt(vx ** 2 + vy ** 2)

        self.velocity_history.append((vx, vy))
        if len(self.velocity_history) > self.history_len:
            self.velocity_history.pop(0)

        # Average velocity for smoother lead
        avg_vx = np.mean([v[0] for v in self.velocity_history])
        avg_vy = np.mean([v[1] for v in self.velocity_history])

        # Detect play switch
        self.is_switching = False
        if speed > self.pass_threshold:
            # Check if ball has crossed significant portion of pitch
            dx = abs(ball_x - self.prev_x)
            if dx > self.panorama_width * 0.05:  # 5% per frame = very fast
                self.is_switching = True
                self.switch_events.append({
                    "frame": frame_idx,
                    "time": round(frame_idx / self.fps, 2),
                    "from_x": round(self.prev_x, 1),
                    "to_x": round(ball_x, 1),
                    "speed": round(speed, 1),
                })

        # Calculate lead distance
        # Fast ball: lead further ahead (up to 200px)
        lead_factor = min(1.0, speed / self.pass_threshold) * 5.0
        lead_x = avg_vx * lead_factor
        lead_y = avg_vy * lead_factor * 0.5  # less vertical lead

        self.prev_x = ball_x
        self.prev_y = ball_y

        return {
            "lead_x": lead_x,
            "lead_y": lead_y,
            "is_switching": self.is_switching,
            "speed": speed,
        }


# ─── Dynamic zoom ───────────────────────────────────────────────────

class DynamicZoom:
    """
    Adjusts zoom level based on game state:
    - Ball moving fast → zoom out (wide view)
    - Ball near goal → zoom in (tight)
    - Dead ball / slow → medium zoom, center midfield
    """

    def __init__(self, panorama_width: float, base_zoom: float = 1.5,
                 min_zoom: float = 1.0, max_zoom: float = 3.0):
        self.panorama_width = panorama_width
        self.base_zoom = base_zoom
        self.min_zoom = min_zoom
        self.max_zoom = max_zoom
        self.current_zoom = base_zoom
        self.smooth_factor = 0.92  # slow zoom transitions

        # Goal zones: left 15% and right 15% of panorama
        self.goal_zone_fraction = 0.15
        self.dead_ball_speed = 3.0  # px/frame
        self.fast_play_speed = 25.0  # px/frame
        self.dead_ball_frames = 0
        self.dead_ball_threshold = 45  # 1.5s at 30fps

    def update(self, ball_x: float, ball_speed: float, is_switching: bool) -> float:
        """Returns the target zoom level for this frame."""
        target_zoom = self.base_zoom

        # Dead ball detection
        if ball_speed < self.dead_ball_speed:
            self.dead_ball_frames += 1
        else:
            self.dead_ball_frames = 0

        if self.dead_ball_frames > self.dead_ball_threshold:
            # Dead ball: medium zoom
            target_zoom = self.base_zoom
        elif is_switching or ball_speed > self.fast_play_speed:
            # Fast play or switch: zoom out
            zoom_reduction = min(0.5, (ball_speed - self.fast_play_speed) / 50.0)
            target_zoom = max(self.min_zoom, self.base_zoom - zoom_reduction)
        else:
            # Check if near goal
            left_goal = self.panorama_width * self.goal_zone_fraction
            right_goal = self.panorama_width * (1.0 - self.goal_zone_fraction)

            if ball_x < left_goal or ball_x > right_goal:
                # Near goal: zoom in
                target_zoom = min(self.max_zoom, self.base_zoom + 0.3)

        # Smooth zoom transition
        target_zoom = np.clip(target_zoom, self.min_zoom, self.max_zoom)
        self.current_zoom = self.smooth_factor * self.current_zoom + (1.0 - self.smooth_factor) * target_zoom

        return self.current_zoom


# ─── Player tracking (ByteTrack) ────────────────────────────────────

class PlayerTracker:
    """
    Tracks players across frames using ByteTrack via the supervision library.
    Assigns persistent IDs so we can generate per-player heatmaps and stats.
    """

    def __init__(self):
        self.tracker = sv.ByteTrack(
            track_activation_threshold=0.4,
            lost_track_buffer=60,       # keep lost tracks for 2s at 30fps
            minimum_matching_threshold=0.8,
            frame_rate=30,
        )
        # track_id -> list of (frame_idx, cx, cy)
        self.tracks: dict[int, list] = {}

    def update(self, results, frame_idx: int) -> list:
        """
        Process YOLO results for person detections.
        Returns list of (track_id, cx, cy, x1, y1, x2, y2).
        """
        person_dets = parse_detections(results, PERSON_CLASSES)

        if not person_dets:
            return []

        # Build supervision Detections object
        xyxy = np.array([[d[2], d[3], d[4], d[5]] for d in person_dets])
        confidence = np.array([d[6] for d in person_dets])

        sv_detections = sv.Detections(
            xyxy=xyxy,
            confidence=confidence,
        )

        # Run ByteTrack
        tracked = self.tracker.update_with_detections(sv_detections)

        results_out = []
        if tracked.tracker_id is not None:
            for i, track_id in enumerate(tracked.tracker_id):
                x1, y1, x2, y2 = tracked.xyxy[i]
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                tid = int(track_id)

                if tid not in self.tracks:
                    self.tracks[tid] = []
                self.tracks[tid].append((frame_idx, float(cx), float(cy)))

                results_out.append((tid, cx, cy, x1, y1, x2, y2))

        return results_out

    def get_track_summary(self, fps: float) -> list:
        """Return summarized per-player tracks for metadata output."""
        summaries = []
        for track_id, positions in self.tracks.items():
            if len(positions) < 5:
                continue  # skip very short tracks (noise)

            frames = [p[0] for p in positions]
            xs = [p[1] for p in positions]
            ys = [p[2] for p in positions]

            # Compute distance traveled (in pixels)
            total_dist = sum(
                np.sqrt((xs[i] - xs[i - 1]) ** 2 + (ys[i] - ys[i - 1]) ** 2)
                for i in range(1, len(xs))
            )

            summaries.append({
                "track_id": track_id,
                "first_frame": frames[0],
                "last_frame": frames[-1],
                "duration_seconds": round((frames[-1] - frames[0]) / fps, 2),
                "total_distance_px": round(total_dist, 1),
                "avg_x": round(np.mean(xs), 1),
                "avg_y": round(np.mean(ys), 1),
                "num_detections": len(positions),
                # Subsample positions for metadata (every 15 frames ≈ 0.5s)
                "positions": [
                    {"frame": p[0], "time": round(p[0] / fps, 2), "x": round(p[1], 1), "y": round(p[2], 1)}
                    for p in positions[::15]
                ],
            })

        # Sort by duration (longest tracks first)
        summaries.sort(key=lambda s: s["duration_seconds"], reverse=True)
        return summaries


# ─── Ball follower (with play-switch lead) ───────────────────────────

class SmoothFollower:
    """Smoothly follows a target position with exponential smoothing and lead distance."""

    def __init__(self, smooth_factor: float = 0.85):
        self.smooth_factor = smooth_factor
        self.x = None
        self.y = None
        self.vx = 0.0
        self.vy = 0.0
        self.frames_lost = 0

    def update(self, detection: tuple | None, lead_x: float = 0.0, lead_y: float = 0.0) -> tuple:
        if detection is not None:
            cx, cy = detection[0], detection[1]
            # Apply lead distance to target
            cx += lead_x
            cy += lead_y

            if self.x is None:
                self.x, self.y = cx, cy
            else:
                new_x = self.smooth_factor * self.x + (1 - self.smooth_factor) * cx
                new_y = self.smooth_factor * self.y + (1 - self.smooth_factor) * cy
                self.vx = new_x - self.x
                self.vy = new_y - self.y
                self.x, self.y = new_x, new_y
            self.frames_lost = 0
        else:
            self.frames_lost += 1
            if self.x is not None:
                decay = max(0.0, 1.0 - self.frames_lost * 0.05)
                self.x += self.vx * decay
                self.y += self.vy * decay

        return (self.x or 0, self.y or 0)


# ─── Crop computation ────────────────────────────────────────────────

def compute_crop(pano_w, pano_h, target_x, target_y, output_w, output_h, zoom=1.5):
    crop_w = int(output_w / zoom)
    crop_h = int(output_h / zoom)
    cx = max(crop_w // 2, min(int(target_x), pano_w - crop_w // 2))
    cy = max(crop_h // 2, min(int(target_y), pano_h - crop_h // 2))
    x1 = cx - crop_w // 2
    y1 = cy - crop_h // 2
    return (x1, y1, x1 + crop_w, y1 + crop_h)


# ─── Main processing pipeline ───────────────────────────────────────

def process_videos(
    left_path: str,
    right_path: str,
    output_path: str,
    highlights_path: str,
    metadata_path: str,
    config: dict,
    tmpdir: str,
):
    """
    Main pipeline: sync → stitch → 3-stage ball detection → play-switch →
    dynamic zoom → virtual crop → render.
    """
    print("🎬 Starting video processing pipeline...")

    res_str = config.get("output_resolution", "1920x1080")
    output_w, output_h = [int(x) for x in res_str.split("x")]
    base_zoom = config.get("zoom_level", 1.5)
    smooth_factor = config.get("smooth_factor", 0.85)
    output_fps = config.get("output_fps", 30)
    follow_mode = config.get("follow_mode", "ball")

    # Load YOLO model
    print("🤖 Loading YOLOv8 model...")
    model = YOLO("yolov8n.pt")

    # Open videos
    cap_left = cv2.VideoCapture(left_path)
    cap_right = cv2.VideoCapture(right_path)

    if not cap_left.isOpened() or not cap_right.isOpened():
        raise RuntimeError("Failed to open one or both video files")

    fps_left = cap_left.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(min(
        cap_left.get(cv2.CAP_PROP_FRAME_COUNT),
        cap_right.get(cv2.CAP_PROP_FRAME_COUNT)
    ))

    print(f"📹 Left: {int(cap_left.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap_left.get(cv2.CAP_PROP_FRAME_HEIGHT))} @ {fps_left:.0f}fps")
    print(f"📹 Right: {int(cap_right.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap_right.get(cv2.CAP_PROP_FRAME_HEIGHT))} @ {cap_right.get(cv2.CAP_PROP_FPS):.0f}fps")

    # Synchronize via audio
    left_offset, right_offset = sync_videos(left_path, right_path, fps_left, tmpdir)
    for _ in range(left_offset):
        cap_left.read()
    for _ in range(right_offset):
        cap_right.read()

    # Init components
    stitcher = PanoramaStitcher()
    follower = SmoothFollower(smooth_factor=smooth_factor)
    player_tracker = PlayerTracker()

    # Read first frame to get panorama dimensions for play-switch and zoom
    ret_l, first_l = cap_left.read()
    ret_r, first_r = cap_right.read()
    if not ret_l or not ret_r:
        raise RuntimeError("Cannot read first frame from videos")
    first_pano = stitcher.stitch(first_l, first_r)
    pano_h, pano_w = first_pano.shape[:2]

    # Reset captures to after sync offset
    cap_left.set(cv2.CAP_PROP_POS_FRAMES, left_offset)
    cap_right.set(cv2.CAP_PROP_POS_FRAMES, right_offset)

    # Init 3-stage pipeline and smart camera components
    ball_pipeline = BallTrackingPipeline(fps=fps_left)
    play_switch = PlaySwitchDetector(panorama_width=pano_w, fps=fps_left)
    dynamic_zoom = DynamicZoom(panorama_width=pano_w, base_zoom=base_zoom)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, output_fps, (output_w, output_h))

    ball_positions = []
    stage_counts = {"yolo": 0, "motion": 0, "kalman": 0, "none": 0}
    frame_idx = 0

    print(f"⚙ Processing {total_frames} frames (3-stage detection, play-switch, dynamic zoom)...")

    while True:
        ret_l, frame_l = cap_left.read()
        ret_r, frame_r = cap_right.read()
        if not ret_l or not ret_r:
            break

        # Stitch panorama
        panorama = stitcher.stitch(frame_l, frame_r)
        pano_h, pano_w = panorama.shape[:2]

        # Run YOLO (every other frame for speed)
        yolo_ball_det = None
        if frame_idx % 2 == 0:
            results = model(panorama, verbose=False, conf=0.3)

            # YOLO ball detection
            ball_dets = parse_detections(results, BALL_CLASSES)
            if ball_dets:
                best = max(ball_dets, key=lambda d: d[6])
                yolo_ball_det = (best[0], best[1], best[6])

            # Player tracking
            player_tracker.update(results, frame_idx)

        # 3-stage ball tracking pipeline
        ball_result = ball_pipeline.update(yolo_ball_det, panorama)

        # Extract position and stage
        if ball_result is not None:
            bx, by, bconf, stage = ball_result
            stage_counts[stage] += 1

            # Play-switch detection
            ps = play_switch.update(bx, by, frame_idx)

            # Dynamic zoom
            current_zoom = dynamic_zoom.update(bx, ps["speed"], ps["is_switching"])

            # Update follower with lead distance
            target_x, target_y = follower.update(
                (bx, by, bconf),
                lead_x=ps["lead_x"],
                lead_y=ps["lead_y"],
            )

            ball_positions.append({
                "frame": frame_idx,
                "time": round(frame_idx / fps_left, 3),
                "x": round(bx, 1),
                "y": round(by, 1),
                "confidence": round(bconf, 3),
                "stage": stage,
                "speed": round(ps["speed"], 1),
                "zoom": round(current_zoom, 2),
            })
        else:
            stage_counts["none"] += 1
            target_x, target_y = follower.update(None)
            current_zoom = dynamic_zoom.update(pano_w / 2, 0, False)

        # Compute and apply crop with dynamic zoom
        x1, y1, x2, y2 = compute_crop(pano_w, pano_h, target_x, target_y, output_w, output_h, current_zoom)
        crop = panorama[y1:y2, x1:x2]
        output_frame = cv2.resize(crop, (output_w, output_h), interpolation=cv2.INTER_LINEAR)
        writer.write(output_frame)

        frame_idx += 1
        if frame_idx % (int(fps_left) * 5) == 0:
            print(f"  {(frame_idx / total_frames) * 100:.0f}% ({frame_idx}/{total_frames})")

    writer.release()
    cap_left.release()
    cap_right.release()

    print(f"✅ Rendered {frame_idx} frames")
    print(f"📊 Detection stages: YOLO={stage_counts['yolo']}, Motion={stage_counts['motion']}, "
          f"Kalman={stage_counts['kalman']}, Lost={stage_counts['none']}")

    # Generate highlights placeholder
    print("🎯 Generating highlights (placeholder)...")
    cap_out = cv2.VideoCapture(output_path)
    highlight_writer = cv2.VideoWriter(highlights_path, fourcc, output_fps, (output_w, output_h))
    for _ in range(min(output_fps * 30, frame_idx)):
        ret, frame = cap_out.read()
        if not ret:
            break
        highlight_writer.write(frame)
    highlight_writer.release()
    cap_out.release()

    # Write metadata with player tracks and detection stats
    player_summaries = player_tracker.get_track_summary(fps_left)
    print(f"👥 Tracked {len(player_summaries)} players")

    metadata = {
        "match_id": config.get("match_id"),
        "total_frames": frame_idx,
        "fps": output_fps,
        "resolution": f"{output_w}x{output_h}",
        "zoom_level": base_zoom,
        "follow_mode": follow_mode,
        "ball_detections": len(ball_positions),
        "detection_stages": stage_counts,
        "ball_positions": ball_positions[:1000],
        "play_switch_events": play_switch.switch_events,
        "player_tracks": player_summaries[:30],  # top 30 by duration
        "highlights": [],
        "processing_time": None,
    }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"📊 Metadata: {len(ball_positions)} ball detections, {len(player_summaries)} player tracks, "
          f"{len(play_switch.switch_events)} play switches")


# ─── RunPod handler ──────────────────────────────────────────────────

def handler(job):
    job_input = job["input"]
    match_id = job_input["match_id"]
    bucket = job_input["output_bucket"]
    config = job_input.get("config", {})
    config["match_id"] = match_id

    start_time = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        left_local = os.path.join(tmpdir, "left.mp4")
        right_local = os.path.join(tmpdir, "right.mp4")
        output_local = os.path.join(tmpdir, "output.mp4")
        highlights_local = os.path.join(tmpdir, "highlights.mp4")
        metadata_local = os.path.join(tmpdir, "metadata.json")

        s3 = get_s3_client(job_input)
        download_from_wasabi(s3, bucket, job_input["left_video"], left_local)
        download_from_wasabi(s3, bucket, job_input["right_video"], right_local)

        process_videos(
            left_local, right_local,
            output_local, highlights_local, metadata_local,
            config, tmpdir,
        )

        # Update processing time
        elapsed = time.time() - start_time
        with open(metadata_local, "r") as f:
            meta = json.load(f)
        meta["processing_time"] = round(elapsed, 2)
        with open(metadata_local, "w") as f:
            json.dump(meta, f, indent=2)

        output_key = f"matches/{match_id}/output/follow_cam.mp4"
        highlights_key = f"matches/{match_id}/output/highlights.mp4"
        metadata_key = f"matches/{match_id}/output/metadata.json"

        upload_to_wasabi(s3, bucket, output_key, output_local)
        upload_to_wasabi(s3, bucket, highlights_key, highlights_local)
        upload_to_wasabi(s3, bucket, metadata_key, metadata_local, content_type="application/json")

    print(f"🏁 Done in {elapsed:.0f}s")

    return {
        "video_path": output_key,
        "highlights_path": highlights_key,
        "metadata_path": metadata_key,
    }


runpod.serverless.start({"handler": handler})
