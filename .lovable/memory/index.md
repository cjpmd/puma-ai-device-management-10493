# Project Memory

## Core
iOS Capacitor native app. Backend: Supabase (Lovable Cloud). 
Video Pipeline: Wasabi S3 storage, RunPod GPU Serverless for YOLOv8 AI processing.
Avoid mobile OOM: fetch native file URIs as Blobs, NEVER use base64 for video.
GPU credentials MUST be RunPod env vars, never in job payloads.

## Memories
- [Backend Lovable Cloud](mem://architecture/backend-lovable-cloud) — Supabase tables for players/devices and edge functions overview
- [Football Central Sync](mem://integrations/football-central-sync) — External Supabase sync for squad data and calendar
- [AR Tracking](mem://features/augmented-reality-tracking) — Real-time player detection via camera using Hugging Face
- [GPS Pitch Calibration](mem://features/gps-pitch-calibration) — Corner coordinate calibration for relative pitch heatmaps
- [Movement Analytics](mem://features/movement-analytics) — Sprint detection and movement metrics from GPS wearables
- [Web Bluetooth Device Management](mem://features/device-management-bluetooth) — GATT services for sensors, smart bandages, and Apple Watch
- [Recovery Mode](mem://features/recovery-mode) — Integrates medical assessments with smart bandage data
- [Video Processing Orchestration](mem://architecture/video-processing-orchestration) — Supabase Edge Functions for Wasabi and RunPod orchestration
- [3-Phone Capture Workflow](mem://features/video-capture-3-phone-workflow) — Master phone and two guest cameras with Supabase Realtime sync
- [Video Capture Requirements](mem://constraints/video-capture-requirements) — 4K 0.5x ultra-wide, native file URIs as Blobs to avoid OOM
- [Capacitor Native App](mem://architecture/native-app-capacitor) — iOS native app using Capacitor camera, device, and filesystem plugins
- [Guest Camera Operator Access](mem://features/video-capture-guest-access) — QR code single-use upload tokens for guest Wasabi uploads
- [Match Analysis Dashboard UI](mem://ui/match-analysis-dashboard) — Upcoming/Recent event categorization with specific action buttons
- [Match Cinema Layout](mem://ui/match-cinema-layout) — Veo-inspired dark cinematic view with icon rail + Clips/Summary/Analytics/Team panels
- [GPU Analysis Pipeline Logic](mem://architecture/gpu-analysis-pipeline-logic) — YOLOv8, ByteTrack, homography stitching, audio sync on RunPod
- [Video Processing Configuration](mem://features/video-processing-configuration) — UI parameters for GPU processing (follow mode, zoom, smoothing)
- [Video Match Analytics UI](mem://features/video-match-analytics) — VideoTimeline and PlayerTracksSummary visualizations
