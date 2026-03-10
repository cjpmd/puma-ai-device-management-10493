"""
RunPod Serverless Handler — Ball-Following Virtual Camera Pipeline

This handler runs on RunPod GPU workers. It:
1. Downloads dual-camera footage from Wasabi
2. Synchronizes frames via audio cross-correlation
3. Stitches frames into a panorama (homography or linear blend fallback)
4. Detects the ball using YOLOv8
5. Tracks players using ByteTrack (persistent IDs across frames)
6. Computes a smooth virtual camera crop that follows the ball
7. Renders the output and uploads back to Wasabi
8. POSTs results to the webhook
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


# ─── Ball follower ───────────────────────────────────────────────────

class SmoothFollower:
    """Smoothly follows a target position with exponential smoothing."""

    def __init__(self, smooth_factor: float = 0.85):
        self.smooth_factor = smooth_factor
        self.x = None
        self.y = None
        self.vx = 0.0
        self.vy = 0.0
        self.frames_lost = 0

    def update(self, detection: tuple | None) -> tuple:
        if detection is not None:
            cx, cy = detection[0], detection[1]
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
    Main pipeline: sync → stitch → detect ball + track players → virtual crop → render.
    """
    print("🎬 Starting video processing pipeline...")

    res_str = config.get("output_resolution", "1920x1080")
    output_w, output_h = [int(x) for x in res_str.split("x")]
    zoom = config.get("zoom_level", 1.5)
    smooth_factor = config.get("smooth_factor", 0.85)
    output_fps = config.get("output_fps", 30)

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

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, output_fps, (output_w, output_h))

    ball_positions = []
    frame_idx = 0

    print(f"⚙ Processing {total_frames} frames...")

    while True:
        ret_l, frame_l = cap_left.read()
        ret_r, frame_r = cap_right.read()
        if not ret_l or not ret_r:
            break

        # Stitch panorama
        panorama = stitcher.stitch(frame_l, frame_r)
        pano_h, pano_w = panorama.shape[:2]

        # Run YOLO (every other frame for speed)
        ball_det = None
        if frame_idx % 2 == 0:
            results = model(panorama, verbose=False, conf=0.3)

            # Ball detection
            ball_dets = parse_detections(results, BALL_CLASSES)
            if ball_dets:
                best = max(ball_dets, key=lambda d: d[6])
                ball_det = (best[0], best[1], best[6])

            # Player tracking
            player_tracker.update(results, frame_idx)

        # Update ball follower
        target_x, target_y = follower.update(ball_det)

        if ball_det:
            ball_positions.append({
                "frame": frame_idx,
                "time": round(frame_idx / fps_left, 3),
                "x": round(ball_det[0], 1),
                "y": round(ball_det[1], 1),
                "confidence": round(ball_det[2], 3),
            })

        # Compute and apply crop
        x1, y1, x2, y2 = compute_crop(pano_w, pano_h, target_x, target_y, output_w, output_h, zoom)
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

    # Write metadata with player tracks
    player_summaries = player_tracker.get_track_summary(fps_left)
    print(f"👥 Tracked {len(player_summaries)} players")

    metadata = {
        "match_id": config.get("match_id"),
        "total_frames": frame_idx,
        "fps": output_fps,
        "resolution": f"{output_w}x{output_h}",
        "zoom_level": zoom,
        "ball_detections": len(ball_positions),
        "ball_positions": ball_positions[:1000],
        "player_tracks": player_summaries[:30],  # top 30 by duration
        "highlights": [],
        "processing_time": None,
    }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"📊 Metadata: {len(ball_positions)} ball detections, {len(player_summaries)} player tracks")


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
