

# Add DeepSORT / Player Tracking to GPU Pipeline

## Current gaps

| Component | Status | Notes |
|-----------|--------|-------|
| Ball detection (YOLO) | Done | Works, uses yolov8n |
| Ball following (smooth crop) | Done | SmoothFollower class |
| Panorama stitching | Basic | Linear blend, no homography |
| Player tracking (DeepSORT) | Missing | No multi-object tracking at all |
| Audio sync | Stubbed | Returns (0, 0) |
| Highlight detection | Stubbed | Copies first 30s |

## Recommendation

**DeepSORT is overkill for ball-following** -- the current SmoothFollower already handles that well. DeepSORT (or ByteTrack) is needed for **player tracking** -- assigning consistent IDs to each player across frames so you can generate per-player heatmaps, distance stats, etc.

The `supervision` library is already in `requirements.txt` and includes **ByteTrack** (a faster, simpler alternative to DeepSORT). I recommend using that instead of adding a separate `deep-sort-realtime` dependency.

## Changes

### 1. `gpu-server/handler.py`
- Add a `PlayerTracker` class using `supervision.ByteTrack` that:
  - Runs YOLO person detection on each frame
  - Assigns persistent track IDs via ByteTrack
  - Records per-player positions over time
- Integrate it into `process_videos()` alongside ball detection (runs on same YOLO inference pass -- YOLO detects both "person" and "sports ball" classes simultaneously)
- Add player position data to the output metadata JSON
- Upgrade stitching to use ORB feature matching + homography (OpenCV has this built in) with a fallback to the current linear blend

### 2. `gpu-server/requirements.txt`
- Remove `fastapi`, `uvicorn`, `python-multipart` (unused -- this is a serverless handler, not an API server)
- Update `supervision` to latest for ByteTrack stability
- Add `scipy` for audio cross-correlation sync
- Add `filterpy` and `lap` if we want classic DeepSORT as a fallback

### 3. `gpu-server/handler.py` -- audio sync
- Implement actual audio cross-correlation using `scipy.signal.correlate` to find the frame offset between left and right cameras

### 4. Output metadata schema
- Extend the metadata JSON to include `player_tracks` array with per-player position timeseries, so the frontend can render heatmaps and distance stats from real data

## No database or edge function changes needed
All changes are in `gpu-server/` only -- the RunPod handler code you'll deploy separately.

