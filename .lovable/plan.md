

# Claude Review Upgrades

## Summary of Issues and Fixes

### GPU Pipeline (`gpu-server/`)

**1. Periodic homography recalibration**
`PanoramaStitcher.stitch()` computes homography once and caches forever. Add `frame_idx` parameter; recalibrate every 500 frames.

**2. Remove broken sync offset loop**
Lines 830-833 read frames in a loop to skip offsets, then lines 849-850 do `cap.set(CAP_PROP_POS_FRAMES)` which resets position anyway. Remove the loop; keep only the `set()` calls.

**3. Audio bandpass filter before cross-correlation**
Add `scipy.signal.butter` + `sosfilt` bandpass (800-3000 Hz) to isolate sharp sounds (whistle, kick) before correlating. Dramatically improves sync accuracy.

**4. Run YOLO every frame for ball, every 2nd for players**
Currently both ball and player detection skip odd frames. Split: run YOLO every frame, but only feed person detections to ByteTrack on even frames.

**5. DynamicZoom smooth_factor 0.92 → 0.85**
Current value takes ~3s to reach target zoom. Reduce to 0.85 for more responsive zooming.

**6. Adaptive overlap in `_stitch_blend`**
Hardcoded 10% overlap. Make it configurable or measure from feature matches when homography fails.

**7. Frame drift guard**
After each stitch, verify `cap_left` and `cap_right` frame positions are within 2 frames of each other; resync the lagging one if not.

**8. Real highlights from play-switch events**
Replace the "copy first 30s" placeholder with actual highlight clips: extract +/- 3 second windows around each play-switch event.

**9. ffmpeg re-encode step**
OpenCV's `mp4v` codec produces large, poorly compatible files. Add an ffmpeg post-process to re-encode with `libx264 -crf 22 -preset fast -movflags +faststart`.

**10. Wasabi credentials from env vars, not job payload**
Move `wasabi_access_key`, `wasabi_secret_key`, `wasabi_endpoint`, `wasabi_region`, `wasabi_bucket` to RunPod environment variables instead of passing in job input. Update `get_s3_client()` to read from `os.environ`.

**11. Pre-download YOLO weights in Dockerfile**
Add `RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"` to avoid cold-start download latency.

**12. Pin CUDA-matched torch in Dockerfile**
Add `--index-url https://download.pytorch.org/whl/cu118` to ensure GPU-enabled torch.

**13. Fix docker-compose volume mount**
Remove `volumes: ./app:/app` which overwrites the built image.

**14. Progress reporting**
Every 100 frames, POST a progress update to the webhook endpoint so the frontend can show a percentage.

### Frontend

**15. Fix `removeAllChannels()` in PlayerMovementMap.tsx (line 322)**
Replace `supabase.removeAllChannels()` with `supabase.removeChannel(channelRef)` using the stored channel reference, so it doesn't destroy other components' subscriptions.

**16. Stabilize random biometric data**
In `BiometricsTab.tsx`, `PlayerPerformanceCard.tsx`, and `GroupAnalysisCard.tsx`: wrap `Math.random()` initial values in `useMemo` with stable seeds, or better yet move them to `useRef` so they don't re-randomize on every render.

### Files to Change

| File | Changes |
|------|---------|
| `gpu-server/handler.py` | Items 1-10, 14 |
| `gpu-server/Dockerfile` | Items 11-12 |
| `gpu-server/docker-compose.yml` | Item 13 |
| `gpu-server/requirements.txt` | No changes needed |
| `src/components/PlayerMovementMap.tsx` | Item 15 |
| `src/components/Analysis/BiometricsTab.tsx` | Item 16 |
| `src/components/Analysis/PlayerPerformanceCard.tsx` | Item 16 |
| `src/components/Analysis/GroupAnalysisCard.tsx` | Item 16 |

### Not actioning (deferred)

- Error boundaries around video components (low risk, can add later)
- Web Worker for hyperparameter tuning (ML training is dev-only)
- Storage check before recording (Capacitor-specific, separate task)
- `movementAnalytics.ts` cumulative distance fix (requires session redesign)
- Auth provider refactor (works correctly, just not optimal)

