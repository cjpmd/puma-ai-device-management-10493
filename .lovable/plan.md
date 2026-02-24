
# Dual-Camera Football AI Video Processing Platform

## Overview

This is a major pivot of the existing Puma-AI app into a video-first AI processing platform. The app will orchestrate video capture from 2 iPhones, upload to Wasabi (S3-compatible storage), trigger GPU processing on RunPod, and display results -- all while preserving existing player metrics, filtering, and analysis features.

## What We Keep

- Authentication system (already working)
- Clubs, Teams, Players tables and sync from Football Central
- Club/Team cascading filters on the Analysis page
- Player metrics (distance, sprints, speed, shots, goals, heatmaps)
- Existing UI components (Card, Badge, Tabs, etc.)

## What We Build

### Phase 1: Database Schema

New tables via migrations:

**matches**
- id (uuid, PK)
- user_id (uuid, references auth.users, NOT NULL)
- title (text)
- match_date (timestamptz)
- location (text)
- team_id (uuid, nullable, FK to teams)
- club_id (uuid, nullable, FK to clubs)
- status (text: draft / uploading / processing / complete / failed)
- created_at, updated_at

**match_videos**
- id (uuid, PK)
- match_id (uuid, FK to matches)
- camera_side (text: left / right)
- wasabi_path (text)
- upload_status (text: pending / uploaded / failed)
- duration_seconds (numeric)
- resolution (text)
- file_size (bigint)
- created_at

**processing_jobs**
- id (uuid, PK)
- match_id (uuid, FK to matches)
- runpod_job_id (text)
- status (text: queued / running / complete / failed)
- started_at, completed_at (timestamptz)
- gpu_type (text)
- processing_logs (text)
- output_video_path (text)
- output_highlights_path (text)
- output_metadata_path (text)
- created_at

RLS policies: Users can only access their own matches and related records (via user_id on matches, joined for child tables).

### Phase 2: Edge Functions (3 new functions)

**1. `generate-upload-url`**
- Accepts: match_id, camera_side, filename, content_type
- Generates presigned PUT URL using Wasabi S3 API
- Returns: presigned URL + final storage path
- Inserts/updates match_videos record with pending status

**2. `trigger-processing`**
- Called when both camera uploads complete
- Fetches left + right video paths from match_videos
- Calls RunPod serverless API to start a job
- Creates processing_jobs record
- Updates match status to "processing"

**3. `runpod-webhook`**
- Receives completion callback from RunPod
- Updates processing_jobs status + output paths
- Updates match status to "complete" or "failed"
- JWT verification disabled (external webhook)

### Phase 3: Secrets Required

The following secrets will be needed (we'll request them as you have them ready):

- WASABI_ACCESS_KEY
- WASABI_SECRET_KEY
- WASABI_BUCKET
- WASABI_REGION
- WASABI_ENDPOINT
- RUNPOD_API_KEY
- RUNPOD_ENDPOINT_ID

You said to let the build happen and come back with APIs later, so we'll scaffold the edge functions with the secret references and you can provide the values when ready.

### Phase 4: Frontend Pages

**New route: `/matches`** -- Match Management Dashboard
- List of all matches with status badges (draft, uploading, processing, complete, failed)
- "New Match" button to create a match
- Real-time status polling (every 15s) for active jobs
- Filter by club/team using existing selectors

**New route: `/matches/:id`** -- Match Detail Page
- Match info (title, date, location, team)
- Two upload cards: Left Camera + Right Camera
  - Each shows upload progress bar
  - Direct browser upload to Wasabi via presigned URL
  - Mobile-optimized (designed for iPhone Safari)
- Processing status section with progress indicator
- Output section: view final video, highlights, download metadata
- Developer controls: re-trigger processing, mark as failed, view logs, GPU override

**Updated: `/` (Index page)**
- Add "Match Analysis" card linking to `/matches`
- Keep existing ML Training and Performance Analysis cards

**Updated: `/analysis`**
- Keep all existing tabs and functionality
- Add ability to link analysis sessions to a match
- Player metrics remain fully intact

### Phase 5: Upload Flow (Client-Side)

```text
iPhone browser --> Match Detail Page
  --> Click "Upload Left Camera"
  --> Call generate-upload-url edge function
  --> Direct PUT to Wasabi presigned URL
  --> Progress tracking via XMLHttpRequest
  --> On complete: update match_videos status
  --> Check if both cameras uploaded
  --> If yes: call trigger-processing edge function
```

File validation: mp4/mov only, max 150GB, with client-side checks before upload.

### Phase 6: Processing Flow

```text
trigger-processing edge function
  --> POST to RunPod serverless API
      {
        input: {
          left_video: wasabi_path,
          right_video: wasabi_path,
          output_bucket: WASABI_BUCKET,
          match_id: uuid,
          webhook_url: <project-url>/functions/v1/runpod-webhook
        }
      }
  --> Store runpod_job_id
  --> Poll or receive webhook for completion
```

Expected outputs stored in Wasabi at `/matches/{match_id}/outputs/`:
- final_follow_cam_video.mp4
- highlights.mp4
- metadata.json

## Technical Details

### Files to create:
1. `supabase/functions/generate-upload-url/index.ts` -- S3 presigned URL generation
2. `supabase/functions/trigger-processing/index.ts` -- RunPod job submission
3. `supabase/functions/runpod-webhook/index.ts` -- Webhook receiver
4. `src/pages/Matches.tsx` -- Match list dashboard
5. `src/pages/MatchDetail.tsx` -- Individual match with upload + status
6. `src/components/Matches/MatchCard.tsx` -- Match list item component
7. `src/components/Matches/VideoUploadCard.tsx` -- Camera upload card with progress
8. `src/components/Matches/ProcessingStatus.tsx` -- Job status display
9. `src/components/Matches/MatchOutputViewer.tsx` -- Final video + highlights viewer
10. `src/components/Matches/CreateMatchDialog.tsx` -- New match form
11. `src/hooks/useMatchPolling.ts` -- Status polling hook

### Files to modify:
1. `src/App.tsx` -- Add /matches and /matches/:id routes
2. `src/pages/Index.tsx` -- Add Match Analysis navigation card
3. `supabase/config.toml` -- Add verify_jwt=false for runpod-webhook

### Database migration:
- One migration creating matches, match_videos, processing_jobs tables with RLS policies
- Enable realtime on matches and processing_jobs for live status updates

### Architecture Summary

```text
+------------------+       +------------------+       +------------------+
|   iPhone Left    | ----> |     Wasabi S3     | ----> |     RunPod       |
|   iPhone Right   | ----> |   (Raw Videos)    |       |   (GPU Compute)  |
+------------------+       +------------------+       +------------------+
        |                         |                           |
        v                         v                           v
+------------------------------------------------------------------+
|                    Lovable App (Control Layer)                     |
|  - Match management       - Upload orchestration                  |
|  - Status dashboard       - Webhook receiver                     |
|  - Player analytics       - Club/Team filtering                  |
+------------------------------------------------------------------+
        |
        v
+------------------+
|  Lovable Cloud   |
|  (Database)      |
+------------------+
```

## Implementation Order

1. Database migration (tables + RLS)
2. Edge functions (generate-upload-url, trigger-processing, runpod-webhook)
3. Match dashboard page + routing
4. Match detail page with upload UI
5. Processing status + output viewer
6. Update Index page navigation
7. Request secrets as you provide API keys

This approach keeps all existing functionality intact while adding the video processing pipeline as a new, cleanly separated feature area.
