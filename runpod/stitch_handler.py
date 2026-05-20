"""
RunPod serverless handler for panoramic video stitching and clip extraction.

Supports two job types:
  - stitch: download left + right MP4s from Wasabi, produce panoramic via FFmpeg hstack
            (with optional OpenCV homography fallback), upload output.
  - extract_clip: download source MP4 from Wasabi, trim segment, upload clip.

Environment variables required:
  (passed in job input — no server-level env needed beyond RunPod base)
"""

import io
import os
import math
import subprocess
import tempfile
import time
import urllib.request

import boto3
import runpod

# ── Wasabi helpers ──────────────────────────────────────────────────────────

def _s3_client(access_key: str, secret_key: str, region: str, endpoint: str):
    return boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        endpoint_url=endpoint,
    )


def download_from_wasabi(s3, bucket: str, path: str, local_path: str):
    s3.download_file(bucket, path, local_path)


def upload_to_wasabi(s3, bucket: str, path: str, local_path: str):
    s3.upload_file(
        local_path,
        bucket,
        path,
        ExtraArgs={"ContentType": "video/mp4", "ACL": "private"},
    )


# ── FFmpeg helpers ──────────────────────────────────────────────────────────

def run_ffmpeg(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    cmd = ["ffmpeg", "-y", "-loglevel", "warning"] + list(args)
    print("FFmpeg:", " ".join(cmd))
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def get_duration(path: str) -> float:
    """Return video duration in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def stitch_hstack(left_path: str, right_path: str, output_path: str):
    """Primary stitching: simple horizontal stack (FFmpeg hstack filter)."""
    run_ffmpeg(
        "-i", left_path,
        "-i", right_path,
        "-filter_complex", "[0:v][1:v]hstack=inputs=2",
        "-c:v", "libx264",
        "-crf", "22",
        "-preset", "fast",
        "-movflags", "+faststart",
        output_path,
    )


def stitch_opencv_panoramic(left_path: str, right_path: str, output_path: str, overlap_fraction: float = 0.15):
    """
    Fallback stitching using OpenCV homography.

    Extracts frames at 1 fps to compute a homography from overlapping regions,
    then applies it per frame via FFmpeg. Falls back to hstack if homography fails.
    """
    import cv2
    import numpy as np

    # Compute homography from the first 5 seconds of frames
    cap_l = cv2.VideoCapture(left_path)
    cap_r = cv2.VideoCapture(right_path)
    fps = cap_l.get(cv2.CAP_PROP_FPS) or 25.0
    w_l = int(cap_l.get(cv2.CAP_PROP_FRAME_WIDTH))
    h_l = int(cap_l.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w_r = int(cap_r.get(cv2.CAP_PROP_FRAME_WIDTH))

    # Sample frames for homography estimation
    orb = cv2.ORB_create(2000)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    H = None
    sample_count = 0

    for _ in range(int(fps * 5)):
        ret_l, frame_l = cap_l.read()
        ret_r, frame_r = cap_r.read()
        if not ret_l or not ret_r:
            break

        # Use the overlapping strips only
        overlap_px_l = int(w_l * overlap_fraction)
        overlap_px_r = int(w_r * overlap_fraction)
        strip_l = frame_l[:, w_l - overlap_px_l:]
        strip_r = frame_r[:, :overlap_px_r]

        kp_l, des_l = orb.detectAndCompute(strip_l, None)
        kp_r, des_r = orb.detectAndCompute(strip_r, None)
        if des_l is None or des_r is None or len(des_l) < 8 or len(des_r) < 8:
            continue

        matches = bf.match(des_l, des_r)
        matches = sorted(matches, key=lambda m: m.distance)[:50]
        if len(matches) < 8:
            continue

        pts_l = np.float32([kp_l[m.queryIdx].pt for m in matches])
        pts_r = np.float32([kp_r[m.trainIdx].pt for m in matches])
        # Translate pts_l back to full-frame coordinates in the strip context
        pts_r[:, 0] += (w_l - overlap_px_l)

        H_candidate, mask = cv2.findHomography(pts_r, pts_l, cv2.RANSAC, 5.0)
        if H_candidate is not None and mask.sum() >= 8:
            H = H_candidate
            sample_count += 1
            if sample_count >= 3:
                break

    cap_l.release()
    cap_r.release()

    if H is None:
        print("OpenCV homography failed — falling back to hstack")
        stitch_hstack(left_path, right_path, output_path)
        return

    # Compute output canvas dimensions
    corners_r = np.float32([[0, 0], [w_r, 0], [w_r, h_l], [0, h_l]]).reshape(-1, 1, 2)
    corners_warped = cv2.perspectiveTransform(corners_r, H)
    all_x = np.concatenate([corners_warped[:, 0, 0], [0, w_l]])
    all_y = np.concatenate([corners_warped[:, 0, 1], [0, h_l]])
    xmin, xmax = int(math.floor(all_x.min())), int(math.ceil(all_x.max()))
    ymin, ymax = int(math.floor(all_y.min())), int(math.ceil(all_y.max()))
    out_w = xmax - xmin
    out_h = ymax - ymin

    # Translate so top-left is (0,0)
    T = np.array([[1, 0, -xmin], [0, 1, -ymin], [0, 0, 1]], dtype=np.float64)
    H_final = T @ H

    # Write output via pipe to FFmpeg
    cap_l2 = cv2.VideoCapture(left_path)
    cap_r2 = cv2.VideoCapture(right_path)
    total_frames = int(cap_l2.get(cv2.CAP_PROP_FRAME_COUNT))

    ffmpeg_proc = subprocess.Popen(
        [
            "ffmpeg", "-y", "-loglevel", "warning",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-s", f"{out_w}x{out_h}",
            "-pix_fmt", "bgr24",
            "-r", str(fps),
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-crf", "22",
            "-preset", "fast",
            "-movflags", "+faststart",
            output_path,
        ],
        stdin=subprocess.PIPE,
    )

    for _ in range(total_frames):
        ret_l, frame_l = cap_l2.read()
        ret_r, frame_r = cap_r2.read()
        if not ret_l or not ret_r:
            break
        warped_r = cv2.warpPerspective(frame_r, H_final, (out_w, out_h))
        canvas = warped_r.copy()
        canvas[-ymin:h_l - ymin, -xmin:w_l - xmin] = frame_l
        ffmpeg_proc.stdin.write(canvas.tobytes())

    ffmpeg_proc.stdin.close()
    ffmpeg_proc.wait()
    cap_l2.release()
    cap_r2.release()


# ── Webhook notification ────────────────────────────────────────────────────

def notify_webhook(webhook_url: str, payload: dict):
    import json
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        webhook_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(f"Webhook {resp.status}: {resp.read()[:200]}")
    except Exception as e:
        print(f"Webhook error: {e}")


# ── Job handlers ────────────────────────────────────────────────────────────

def handle_stitch(inp: dict) -> dict:
    required = ["left_video", "right_video", "output_bucket", "output_path", "match_id",
                 "wasabi_access_key", "wasabi_secret_key", "wasabi_region", "wasabi_endpoint"]
    missing = [k for k in required if not inp.get(k)]
    if missing:
        return {"success": False, "error": f"Missing fields: {missing}"}

    s3 = _s3_client(
        inp["wasabi_access_key"],
        inp["wasabi_secret_key"],
        inp["wasabi_region"],
        inp["wasabi_endpoint"],
    )
    bucket = inp["output_bucket"]

    with tempfile.TemporaryDirectory() as tmp:
        left_local = os.path.join(tmp, "left.mp4")
        right_local = os.path.join(tmp, "right.mp4")
        output_local = os.path.join(tmp, "stitched.mp4")

        print("Downloading left video…")
        download_from_wasabi(s3, bucket, inp["left_video"], left_local)
        print("Downloading right video…")
        download_from_wasabi(s3, bucket, inp["right_video"], right_local)

        use_opencv = inp.get("use_opencv", False)
        overlap = inp.get("overlap_fraction", 0.15)

        print(f"Stitching (opencv={use_opencv}, overlap={overlap})…")
        if use_opencv:
            stitch_opencv_panoramic(left_local, right_local, output_local, overlap)
        else:
            stitch_hstack(left_local, right_local, output_local)

        duration = get_duration(output_local)
        print(f"Uploading stitched video ({duration:.1f}s)…")
        upload_to_wasabi(s3, bucket, inp["output_path"], output_local)

    result = {
        "success": True,
        "match_id": inp["match_id"],
        "session_id": inp.get("session_id"),
        "stitched_path": inp["output_path"],
        "duration_seconds": round(duration),
    }

    if webhook_url := inp.get("webhook_url"):
        notify_webhook(webhook_url, result)

    return result


def handle_extract_clip(inp: dict) -> dict:
    required = ["source_path", "start_sec", "end_sec", "output_bucket", "output_path", "match_id",
                 "wasabi_access_key", "wasabi_secret_key", "wasabi_region", "wasabi_endpoint"]
    missing = [k for k in required if inp.get(k) is None]
    if missing:
        return {"success": False, "error": f"Missing fields: {missing}"}

    s3 = _s3_client(
        inp["wasabi_access_key"],
        inp["wasabi_secret_key"],
        inp["wasabi_region"],
        inp["wasabi_endpoint"],
    )
    bucket = inp["output_bucket"]
    start = float(inp["start_sec"])
    end = float(inp["end_sec"])
    duration = end - start

    with tempfile.TemporaryDirectory() as tmp:
        source_local = os.path.join(tmp, "source.mp4")
        output_local = os.path.join(tmp, "clip.mp4")

        print(f"Downloading source video from {inp['source_path']}…")
        download_from_wasabi(s3, bucket, inp["source_path"], source_local)

        print(f"Extracting {start:.1f}s – {end:.1f}s…")
        run_ffmpeg(
            "-ss", str(start),
            "-i", source_local,
            "-t", str(duration),
            "-c:v", "libx264",
            "-crf", "22",
            "-preset", "fast",
            "-movflags", "+faststart",
            output_local,
        )

        actual_duration = get_duration(output_local)
        print(f"Uploading clip ({actual_duration:.1f}s)…")
        upload_to_wasabi(s3, bucket, inp["output_path"], output_local)

    result = {
        "success": True,
        "match_id": inp["match_id"],
        "clip_path": inp["output_path"],
        "start_sec": start,
        "end_sec": end,
        "duration_seconds": round(actual_duration),
    }

    if webhook_url := inp.get("webhook_url"):
        notify_webhook(webhook_url, {**result, "stitched_path": inp["output_path"]})

    return result


# ── RunPod entrypoint ───────────────────────────────────────────────────────

def handler(event: dict) -> dict:
    inp = event.get("input", {})
    job_type = inp.get("job_type", "stitch")

    try:
        if job_type == "stitch":
            return handle_stitch(inp)
        elif job_type == "extract_clip":
            return handle_extract_clip(inp)
        else:
            return {"success": False, "error": f"Unknown job_type: {job_type}"}
    except Exception as exc:
        import traceback
        err = traceback.format_exc()
        print(err)

        # Try to notify webhook of failure
        if webhook_url := inp.get("webhook_url"):
            notify_webhook(webhook_url, {
                "success": False,
                "match_id": inp.get("match_id"),
                "error": str(exc),
            })

        return {"success": False, "error": str(exc)}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
