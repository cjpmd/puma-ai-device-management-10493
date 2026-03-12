

# Upgrade GPU Handler: 3-Stage Ball Detection, Play-Switch Prediction, Smart Zoom

## What's Already Done

Your `gpu-server/handler.py` already has:
- Panorama stitching (homography + blend fallback)
- YOLOv8 ball detection (single-stage only)
- ByteTrack player tracking
- SmoothFollower for camera movement
- Audio cross-correlation sync
- Wasabi upload/download
- RunPod serverless handler

## What's Missing (from the ChatGPT discussion)

### 1. Multi-stage ball detection (CRITICAL)
Currently if YOLO misses the ball, the camera drifts on momentum alone. Need:
- **Stage 1**: YOLO detection (already done)
- **Stage 2**: Motion detection fallback — frame differencing to find the fastest small object
- **Stage 3**: Kalman filter trajectory prediction — predict ball position when both YOLO and motion fail

### 2. Play-switch prediction
Currently the camera reacts to ball position. On long passes/clearances it lags behind. Need:
- Velocity-based ball trajectory extrapolation
- When ball speed exceeds a threshold, move the camera **ahead** of the ball
- Play-switch detection: when ball crosses >40% of pitch width rapidly, zoom out and pan faster

### 3. Smart zoom logic
Currently zoom is a fixed config value. Need dynamic zoom based on game state:
- Ball moving fast → zoom out (wide view)
- Ball near goal area → zoom in (tight)
- Dead ball / low speed → center on midfield, medium zoom

### 4. Video chunking prep
The ChatGPT conversation recommends splitting videos into 2-minute chunks for parallel GPU processing. This is an optimization for later but we should structure the handler to support it.

## Changes

### `gpu-server/handler.py`
- Add `MotionDetector` class: frame differencing, contour filtering for small fast objects
- Add `KalmanBallPredictor` class using `filterpy.kalman.KalmanFilter` for trajectory prediction when detection fails
- Add `BallTrackingPipeline` class that combines all 3 stages with confidence scoring
- Add `PlaySwitchDetector`: tracks ball velocity, detects rapid cross-pitch movement, outputs camera lead distance
- Add `DynamicZoom` class: adjusts zoom level based on ball speed and pitch position (goal proximity)
- Update `SmoothFollower` to accept lead distance from play-switch detection
- Update main processing loop to use `BallTrackingPipeline` instead of raw YOLO
- Add ball velocity and play-switch events to metadata output

### `gpu-server/requirements.txt`
- Already has `filterpy` and `scipy` — no changes needed

### No frontend or edge function changes
All changes are in `gpu-server/` only.

## Processing loop becomes

```text
Frame
  ↓
YOLO detection (every 2nd frame)
  ↓ if miss
Motion detection (frame diff)
  ↓ if miss
Kalman prediction
  ↓
Ball position (with confidence score)
  ↓
Play-switch check (velocity + direction)
  ↓
Dynamic zoom calculation
  ↓
Camera target (with lead distance)
  ↓
Smooth camera movement
  ↓
Crop panorama at dynamic zoom
  ↓
Render frame
```

