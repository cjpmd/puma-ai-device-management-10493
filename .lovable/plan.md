

# Prep Work for RunPod Ball-Following Pipeline

## Current State

- **`trigger-processing`**: Still has the broken `getClaims()` auth bug. Will crash on any call.
- **`runpod-webhook`**: Works but has outdated CORS headers.
- **`gpu-server/`**: Empty scaffold -- Dockerfile and requirements.txt only, no `main.py` handler.
- **`MatchOutputViewer`**: View/Download buttons are non-functional (no presigned URL generation).
- **No RunPod handler**: There's no code defining what the GPU worker actually does with the two videos.

## What We Can Build Now (No RunPod Secrets Needed)

### 1. Fix `trigger-processing` edge function
Replace broken `getClaims()` with `getUser()` and update CORS headers. Same fix already applied to `generate-upload-url`.

### 2. Fix `runpod-webhook` CORS headers
Update to include full Supabase client header set.

### 3. Create the RunPod serverless handler (`gpu-server/handler.py`)
This is the actual code that will run on RunPod. It defines the ball-following + virtual pan/zoom pipeline:

```text
Input (from trigger-processing):
├── left_video: Wasabi path to left camera MP4
├── right_video: Wasabi path to right camera MP4
├── output_bucket: Wasabi bucket name
├── match_id: UUID
└── webhook_url: callback URL

Processing Pipeline:
1. Download both videos from Wasabi
2. Synchronize frames (using audio fingerprint or timecode)
3. Stitch into a wide panoramic frame
4. Run ball detection (YOLOv8 or similar)
5. Compute virtual camera crop that follows the ball
6. Apply smooth pan/zoom with easing
7. Render output video at target resolution
8. Upload output + highlights + metadata to Wasabi
9. POST webhook with output paths

Output (via webhook):
├── video_path: Wasabi path to follow-cam video
├── highlights_path: Wasabi path to key moments
└── metadata_path: Wasabi path to JSON (ball positions, events)
```

We'll write the full Python handler with all pipeline stages stubbed out so you can fill in the ML models on RunPod.

### 4. Create `get-output-url` edge function
New edge function that generates presigned Wasabi GET URLs for output videos, so the `MatchOutputViewer` can actually stream them.

### 5. Make `MatchOutputViewer` functional
Wire the View/Download buttons to call `get-output-url` and open the presigned URL in a video player or new tab.

### 6. Add processing config to trigger payload
Extend `trigger-processing` to pass processing parameters (output resolution, follow mode, zoom level) so the RunPod handler can use them.

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/trigger-processing/index.ts` | Fix auth + CORS + add config params |
| `supabase/functions/runpod-webhook/index.ts` | Update CORS |
| `gpu-server/handler.py` | Create -- RunPod serverless handler with full pipeline |
| `gpu-server/requirements.txt` | Update with RunPod SDK |
| `supabase/functions/get-output-url/index.ts` | Create -- presigned URL generator for outputs |
| `src/components/Matches/MatchOutputViewer.tsx` | Wire buttons to stream/download via presigned URLs |

## No database changes needed

