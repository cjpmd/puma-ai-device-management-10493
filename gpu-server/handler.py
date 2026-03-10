"""
RunPod Serverless Handler — Ball-Following Virtual Camera Pipeline

This handler runs on RunPod GPU workers. It:
1. Downloads dual-camera footage from Wasabi
2. Synchronizes and stitches frames into a panorama
3. Detects the ball using YOLOv8
4. Computes a smooth virtual camera crop that follows the ball
5. Renders the output and uploads back to Wasabi
6. POSTs results to the webhook
"""

import os
import json
import tempfile
import time
import requests
import runpod
import boto3
import cv2
import numpy as np
from ultralytics import YOLO


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
    """Download a file from Wasabi to a local path."""
    print(f"⬇ Downloading s3://{bucket}/{key}")
    s3.download_file(bucket, key, local_path)
    print(f"  ✓ Downloaded {os.path.getsize(local_path) / 1e6:.1f} MB")


def upload_to_wasabi(s3, bucket: str, key: str, local_path: str, content_type: str = "video/mp4"):
    """Upload a local file to Wasabi."""
    print(f"⬆ Uploading to s3://{bucket}/{key}")
    s3.upload_file(
        local_path, bucket, key,
        ExtraArgs={"ContentType": content_type}
    )
    print(f"  ✓ Uploaded {os.path.getsize(local_path) / 1e6:.1f} MB")


# ─── Video processing pipeline ───────────────────────────────────────

def sync_videos(left_path: str, right_path: str) -> tuple:
    """
    Synchronize two video files using audio cross-correlation.

    Returns (left_offset_frames, right_offset_frames) — one will be 0.

    TODO: Implement audio fingerprint sync. For now, assumes videos
    start at the same time (offset = 0).
    """
    print("🔄 Synchronizing videos...")
    # Placeholder: assumes synced start. Replace with audio cross-correlation.
    return (0, 0)


def stitch_panorama(left_frame: np.ndarray, right_frame: np.ndarray) -> np.ndarray:
    """
    Stitch left and right camera frames into a single wide panorama.

    Uses feature matching (ORB/SIFT) to find the overlap region and
    homography to warp the right frame onto the left frame's plane.

    TODO: Replace with calibrated homography for production.
    For now, does a simple horizontal concatenation with blend zone.
    """
    h_l, w_l = left_frame.shape[:2]
    h_r, w_r = right_frame.shape[:2]

    # Resize to same height if needed
    if h_l != h_r:
        scale = h_l / h_r
        right_frame = cv2.resize(right_frame, (int(w_r * scale), h_l))
        w_r = int(w_r * scale)

    # Simple blend: overlap last 10% of left with first 10% of right
    overlap = int(min(w_l, w_r) * 0.10)
    if overlap < 10:
        return np.hstack([left_frame, right_frame])

    # Linear blend in overlap zone
    pano_width = w_l + w_r - overlap
    panorama = np.zeros((h_l, pano_width, 3), dtype=np.uint8)

    # Left side (non-overlap)
    panorama[:, :w_l - overlap] = left_frame[:, :w_l - overlap]

    # Overlap blend
    for i in range(overlap):
        alpha = i / overlap
        panorama[:, w_l - overlap + i] = (
            (1 - alpha) * left_frame[:, w_l - overlap + i] +
            alpha * right_frame[:, i]
        ).astype(np.uint8)

    # Right side (non-overlap)
    panorama[:, w_l:] = right_frame[:, overlap:]

    return panorama


def detect_ball(model: YOLO, frame: np.ndarray) -> tuple | None:
    """
    Detect the ball in a frame using YOLOv8.

    Returns (cx, cy, confidence) or None if not detected.
    """
    results = model(frame, verbose=False, conf=0.3)

    best = None
    best_conf = 0.0

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = r.names[cls_id].lower()
            conf = float(box.conf[0])

            # COCO class 32 = "sports ball", also check name
            if cls_name in ("sports ball", "ball", "football") and conf > best_conf:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                best = ((x1 + x2) / 2, (y1 + y2) / 2, conf)
                best_conf = conf

    return best


class SmoothFollower:
    """
    Smoothly follows a target position with exponential smoothing.
    Handles lost detections by continuing momentum.
    """

    def __init__(self, smooth_factor: float = 0.85):
        self.smooth_factor = smooth_factor
        self.x = None
        self.y = None
        self.vx = 0.0
        self.vy = 0.0
        self.frames_lost = 0

    def update(self, detection: tuple | None) -> tuple:
        """Update follower with new detection. Returns (x, y)."""
        if detection is not None:
            cx, cy, _ = detection
            if self.x is None:
                self.x, self.y = cx, cy
            else:
                # Smooth position
                new_x = self.smooth_factor * self.x + (1 - self.smooth_factor) * cx
                new_y = self.smooth_factor * self.y + (1 - self.smooth_factor) * cy
                self.vx = new_x - self.x
                self.vy = new_y - self.y
                self.x, self.y = new_x, new_y
            self.frames_lost = 0
        else:
            # No detection — coast on momentum with decay
            self.frames_lost += 1
            if self.x is not None:
                decay = max(0.0, 1.0 - self.frames_lost * 0.05)
                self.x += self.vx * decay
                self.y += self.vy * decay

        return (self.x or 0, self.y or 0)


def compute_crop(
    pano_w: int, pano_h: int,
    target_x: float, target_y: float,
    output_w: int, output_h: int,
    zoom: float = 1.5
) -> tuple:
    """
    Compute crop rectangle centered on target within panorama bounds.

    Returns (x1, y1, x2, y2) — integer pixel coordinates.
    """
    crop_w = int(output_w / zoom)
    crop_h = int(output_h / zoom)

    # Clamp to panorama bounds
    cx = max(crop_w // 2, min(int(target_x), pano_w - crop_w // 2))
    cy = max(crop_h // 2, min(int(target_y), pano_h - crop_h // 2))

    x1 = cx - crop_w // 2
    y1 = cy - crop_h // 2
    x2 = x1 + crop_w
    y2 = y1 + crop_h

    return (x1, y1, x2, y2)


def process_videos(
    left_path: str,
    right_path: str,
    output_path: str,
    highlights_path: str,
    metadata_path: str,
    config: dict,
):
    """
    Main processing pipeline:
    1. Open both videos
    2. Sync frames
    3. Stitch panorama per frame
    4. Detect ball
    5. Compute virtual camera crop
    6. Write output video
    """
    print("🎬 Starting video processing pipeline...")

    # Parse config
    res_str = config.get("output_resolution", "1920x1080")
    output_w, output_h = [int(x) for x in res_str.split("x")]
    zoom = config.get("zoom_level", 1.5)
    smooth_factor = config.get("smooth_factor", 0.85)
    output_fps = config.get("output_fps", 30)

    # Load YOLO model (downloads on first use)
    print("🤖 Loading YOLOv8 model...")
    model = YOLO("yolov8n.pt")  # nano for speed; swap to yolov8m.pt for accuracy

    # Open video captures
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
    print(f"📐 Output: {output_w}x{output_h} @ {output_fps}fps, zoom={zoom}")

    # Synchronize
    left_offset, right_offset = sync_videos(left_path, right_path)

    # Skip offset frames
    for _ in range(left_offset):
        cap_left.read()
    for _ in range(right_offset):
        cap_right.read()

    # Output writer
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, output_fps, (output_w, output_h))

    follower = SmoothFollower(smooth_factor=smooth_factor)
    ball_positions = []
    highlight_moments = []
    frame_idx = 0

    print(f"⚙ Processing {total_frames} frames...")

    while True:
        ret_l, frame_l = cap_left.read()
        ret_r, frame_r = cap_right.read()

        if not ret_l or not ret_r:
            break

        # Stitch panorama
        panorama = stitch_panorama(frame_l, frame_r)
        pano_h, pano_w = panorama.shape[:2]

        # Detect ball (run every N frames for speed, interpolate between)
        detection = None
        if frame_idx % 2 == 0:  # detect every other frame
            detection = detect_ball(model, panorama)

        # Update follower
        target_x, target_y = follower.update(detection)

        # Record ball position
        if detection:
            ball_positions.append({
                "frame": frame_idx,
                "time": frame_idx / fps_left,
                "x": detection[0],
                "y": detection[1],
                "confidence": detection[2],
            })

        # Compute crop
        x1, y1, x2, y2 = compute_crop(pano_w, pano_h, target_x, target_y, output_w, output_h, zoom)

        # Extract and resize crop to output resolution
        crop = panorama[y1:y2, x1:x2]
        output_frame = cv2.resize(crop, (output_w, output_h), interpolation=cv2.INTER_LINEAR)

        writer.write(output_frame)
        frame_idx += 1

        # Progress logging every 5 seconds of video
        if frame_idx % (int(fps_left) * 5) == 0:
            pct = (frame_idx / total_frames) * 100
            print(f"  {pct:.0f}% ({frame_idx}/{total_frames} frames)")

    writer.release()
    cap_left.release()
    cap_right.release()

    print(f"✅ Rendered {frame_idx} frames to {output_path}")

    # ─── Generate highlights ──────────────────────────────────────────
    # TODO: Implement highlight detection (goals, fast movement, crowd noise)
    # For now, create a placeholder highlights file
    print("🎯 Generating highlights (placeholder)...")
    # Copy the first 30 seconds as a "highlight" placeholder
    cap_out = cv2.VideoCapture(output_path)
    highlight_writer = cv2.VideoWriter(highlights_path, fourcc, output_fps, (output_w, output_h))
    highlight_frames = min(output_fps * 30, frame_idx)
    for i in range(highlight_frames):
        ret, frame = cap_out.read()
        if not ret:
            break
        highlight_writer.write(frame)
    highlight_writer.release()
    cap_out.release()

    # ─── Write metadata ──────────────────────────────────────────────
    metadata = {
        "match_id": config.get("match_id"),
        "total_frames": frame_idx,
        "fps": output_fps,
        "resolution": f"{output_w}x{output_h}",
        "zoom_level": zoom,
        "ball_detections": len(ball_positions),
        "ball_positions": ball_positions[:1000],  # cap to keep JSON reasonable
        "highlights": highlight_moments,
        "processing_time": None,  # filled in by caller
    }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"📊 Metadata: {len(ball_positions)} ball detections written")


# ─── RunPod handler ──────────────────────────────────────────────────

def handler(job):
    """
    RunPod serverless handler entry point.

    Expected input:
    {
        "left_video": "matches/<id>/left/video.mp4",
        "right_video": "matches/<id>/right/video.mp4",
        "output_bucket": "bucket-name",
        "match_id": "uuid",
        "webhook_url": "https://...",
        "config": { "output_resolution": "1920x1080", ... },
        "wasabi_access_key": "...",
        "wasabi_secret_key": "...",
        "wasabi_region": "...",
        "wasabi_endpoint": "..."
    }
    """
    job_input = job["input"]
    match_id = job_input["match_id"]
    bucket = job_input["output_bucket"]
    config = job_input.get("config", {})
    config["match_id"] = match_id

    start_time = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        # Local paths
        left_local = os.path.join(tmpdir, "left.mp4")
        right_local = os.path.join(tmpdir, "right.mp4")
        output_local = os.path.join(tmpdir, "output.mp4")
        highlights_local = os.path.join(tmpdir, "highlights.mp4")
        metadata_local = os.path.join(tmpdir, "metadata.json")

        # S3 client
        s3 = get_s3_client(job_input)

        # Download input videos
        download_from_wasabi(s3, bucket, job_input["left_video"], left_local)
        download_from_wasabi(s3, bucket, job_input["right_video"], right_local)

        # Process
        process_videos(
            left_local, right_local,
            output_local, highlights_local, metadata_local,
            config,
        )

        # Update processing time in metadata
        elapsed = time.time() - start_time
        with open(metadata_local, "r") as f:
            meta = json.load(f)
        meta["processing_time"] = round(elapsed, 2)
        with open(metadata_local, "w") as f:
            json.dump(meta, f, indent=2)

        # Output paths in Wasabi
        output_key = f"matches/{match_id}/output/follow_cam.mp4"
        highlights_key = f"matches/{match_id}/output/highlights.mp4"
        metadata_key = f"matches/{match_id}/output/metadata.json"

        # Upload outputs
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
