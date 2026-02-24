

# Native App with Synchronized Recording + Live Preview + Battery Monitoring

## Overview

Redesign the camera capture system as a native iOS app using Capacitor with native plugins. The control phone will see live preview thumbnails from both camera phones plus their battery levels, and can start/stop 4K ultra-wide recording with exact synchronisation.

## Architecture

```text
All 3 phones run the SAME native app (built with Capacitor)

Control Phone (logged in)                 Camera Phones (guest via QR token)
+---------------------------+             +---------------------------+
| Match Detail Page         |             | /capture/:token           |
|                           |             |                           |
| [Left Camera Preview]    |<-- frame -->| Native 4K camera via      |
| Battery: 87% [charging]  |   snapshots | @capacitor-community/     |
|                           |             | camera-preview            |
| [Right Camera Preview]   |<-- frame -->|                           |
| Battery: 62%             |   snapshots | Records with              |
|                           |             | startRecordVideo()        |
| [=== START RECORDING ===]|-- command ->| at scheduled startAt time |
| [=== STOP RECORDING  ===]|-- command ->| stopRecordVideo()         |
+---------------------------+             +---------------------------+

Communication: Supabase Realtime broadcast channel
Preview: Camera phones capture low-res snapshots every 2s, send as base64 via broadcast
Battery: Camera phones read battery via @capacitor/device, send every 10s via broadcast
```

## Key Plugins

| Plugin | Purpose |
|--------|---------|
| `@capacitor-community/camera-preview` | Native camera viewfinder + programmatic start/stop video recording + frame capture for live preview |
| `@capacitor/device` | Battery level and charging status |
| `@capacitor/filesystem` | Access recorded video file for upload |

**Why `camera-preview` over `video-recorder`?** `camera-preview` supports both `startRecordVideo()` for recording AND `captureSample()` for grabbing preview frames from the live feed -- exactly what we need for both recording and sending thumbnails to the control phone.

## Synchronized Start (Countdown Method)

Same approach as the approved plan, but now using native recording:

1. Control phone taps "Start" --> broadcasts `{ command: "start", startAt: Date.now() + 3000 }`
2. Camera phones run a ping-pong exchange on connection to calculate clock offset
3. On receiving the start command, each camera phone:
   - Shows a 3-2-1 countdown overlay
   - Calls `CameraPreview.startRecordVideo()` at the precise scheduled millisecond via `setTimeout`
4. Control phone taps "Stop" --> broadcasts `{ command: "stop" }`
5. Camera phones call `CameraPreview.stopRecordVideo()` --> returns the local file path
6. File stays on device until operator taps "Upload"

## Live Preview Streaming

Camera phones will use `CameraPreview.captureSample({ quality: 15 })` every 2 seconds to grab a low-resolution JPEG snapshot from the live camera feed, then broadcast it as a base64 string over the Realtime channel. The control phone renders these as `<img>` elements.

- Quality is set very low (15%) to keep the base64 payload small (~10-20KB per frame)
- 2-second interval is enough for the control phone operator to verify framing
- Streaming stops during recording to avoid performance impact on the 4K capture

## Battery Monitoring

Camera phones will call `Device.getBatteryInfo()` every 10 seconds and broadcast:
```text
{ type: "telemetry", camera_side: "left", batteryLevel: 0.87, isCharging: false }
```

The control phone displays this alongside each camera preview.

## Changes

### 1. Update `capacitor.config.ts`
- Update appId to use the correct Lovable format: `app.lovable.cb1a7443dfe74413bc7a813cf6770aa3`
- Update server URL to the correct preview URL

### 2. Install new dependencies
- `@capacitor-community/camera-preview` -- native camera control with recording and frame capture
- `@capacitor/device` -- battery info
- `@capacitor/filesystem` -- file access for upload

### 3. Rewrite `CameraRecorder.tsx`
Replace the MediaRecorder/getUserMedia approach with native Capacitor calls:
- Use `CameraPreview.start()` to initialize the native camera with rear-facing, 4K settings
- Use `CameraPreview.captureSample()` every 2s to send preview frames to the control phone
- Use `CameraPreview.startRecordVideo()` / `stopRecordVideo()` for synchronized recording
- Read battery via `Device.getBatteryInfo()` and broadcast every 10s
- Implement ping-pong clock offset calculation for sync
- Show a countdown overlay (3-2-1) before recording starts
- On web (development), fall back to the existing MediaRecorder approach so the app still works in the browser

### 4. Update `CameraCapture.tsx`
- Pass countdown state and preview frame callback to CameraRecorder
- Handle the native file path returned by `stopRecordVideo()` -- convert to a File for upload using `Filesystem.readFile()`

### 5. Rewrite `RecordingControls.tsx`
Add to the control phone UI:
- Two live preview panels showing the latest snapshot from each camera (rendered as base64 images)
- Battery level indicator for each camera (percentage bar + charging icon)
- Sync quality indicator (estimated clock offset from ping-pong)
- 3-2-1 countdown display before recording starts
- Scheduled start logic: compute `startAt = Date.now() + 3000` and broadcast

### 6. Update `MatchDetail.tsx`
- Give RecordingControls more screen space to show the two preview panels side by side

### 7. Fix existing build error
- Add `skipLibCheck: true` to `tsconfig.app.json` to resolve the `gl-matrix` type errors (these are from a third-party dependency and not fixable in our code)

## Camera Settings (4K + Ultra-Wide)

The `camera-preview` plugin initializes with width/height that map to the highest available resolution. For ultra-wide:
- On iOS, `camera-preview` uses AVFoundation which selects the default back camera
- To get the ultra-wide lens, we set the camera preview dimensions to match 4K (3840x2160) and use the `CameraPreview.setZoom()` method if available, or rely on iOS selecting the appropriate lens for the field of view

## Realtime Channel Messages (Updated)

```text
Channel: recording-{match_id}

Camera phones send:
- { type: "status", camera_side, status: "ready"|"recording"|"stopped"|"error" }
- { type: "preview", camera_side, frame: "<base64 jpeg>" }
- { type: "telemetry", camera_side, batteryLevel: 0.87, isCharging: false }
- { type: "pong", camera_side, sentAt, receivedAt }

Control phone sends:
- { type: "command", command: "start", startAt: number }
- { type: "command", command: "stop" }
- { type: "ping", sentAt: number }
```

## File Summary

### Files to modify:
1. `capacitor.config.ts` -- Update appId and server URL
2. `tsconfig.app.json` -- Add skipLibCheck to fix gl-matrix errors
3. `src/components/Matches/CameraRecorder.tsx` -- Full rewrite for native camera-preview plugin
4. `src/pages/CameraCapture.tsx` -- Handle native file paths and countdown state
5. `src/components/Matches/RecordingControls.tsx` -- Add live preview panels, battery display, countdown
6. `src/pages/MatchDetail.tsx` -- Layout updates for preview panels

### New dependencies:
- `@capacitor-community/camera-preview`
- `@capacitor/device`
- `@capacitor/filesystem`

### Post-implementation steps (for the user):
1. Export to GitHub and git pull
2. Run `npm install`
3. Run `npx cap sync ios`
4. Open in Xcode: `npx cap open ios`
5. Add camera and microphone usage descriptions in Info.plist
6. Build and run on physical iOS devices

