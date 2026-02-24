

# Synchronized Recording via Control Phone

## Overview

The control phone will be able to remotely start and stop recording on both camera phones simultaneously. This uses Realtime broadcast channels -- no database tables needed for the signaling, just pub/sub messages between the 3 phones.

## How It Works

```text
Control Phone (Match Detail page)
  |
  |--> Both camera phones scan QR and land on /capture/:token
  |--> Camera phones subscribe to a Realtime channel: "match-{match_id}"
  |--> Camera phones report their "ready" status back via broadcast
  |
  |--> Control phone sees: "Left: Ready | Right: Ready"
  |--> Control phone taps "START RECORDING" 
  |      --> Broadcasts { command: "start", timestamp: Date.now() }
  |      --> Both camera phones receive it simultaneously
  |      --> Both phones open the native camera via MediaRecorder API
  |
  |--> Control phone taps "STOP RECORDING"
  |      --> Broadcasts { command: "stop" }
  |      --> Both phones stop recording, save file locally
  |      --> Phones show "Upload when ready" button
  |
  |--> Camera operators upload when on WiFi (existing flow)
```

## Key Design Decisions

**MediaRecorder API instead of `<input capture>`**: The current flow uses a file input which hands control to the native camera app. To support remote start/stop, we need to use the browser's MediaRecorder API which gives us programmatic control over recording. This works in Safari on iOS 14.3+ and all modern Android browsers.

**Realtime Broadcast (not database)**: Broadcast channels are fire-and-forget messages -- no database writes, no RLS concerns, sub-millisecond delivery. Perfect for signaling commands.

**Timestamp synchronization**: The start command includes a server timestamp so both recordings can be aligned in post-processing even if there's slight network delay.

## Changes

### 1. New Component: `RecordingControls.tsx`
Added to the Match Detail page (control phone). Shows:
- Connection status for each camera phone (disconnected / ready / recording)
- A large "START RECORDING" button (enabled only when both cameras are ready)
- A "STOP RECORDING" button (enabled during recording)
- A recording timer showing elapsed time
- Uses Realtime broadcast to send commands and receive status updates

### 2. Updated: `CameraCapture.tsx` (guest capture page)
Major changes to support remote-controlled recording:
- On load, subscribes to the Realtime broadcast channel `match-{match_id}`
- Sends a "ready" presence message so the control phone knows it's connected
- Listens for "start" command: opens rear camera via `navigator.mediaDevices.getUserMedia()`, begins recording with MediaRecorder
- Listens for "stop" command: stops recording, converts to blob/file
- Shows a live camera preview while recording (small viewfinder)
- After recording stops, shows the recorded file with option to upload (existing upload flow)
- Falls back to manual record button if Realtime connection fails
- Requests camera permission on page load so it's ready for the start command

### 3. Updated: `MatchDetail.tsx`
- Adds the `RecordingControls` component between the Camera QR Setup section and the upload cards
- Passes the match ID for channel naming

### 4. Updated: `CameraQRSetup.tsx`
- Shows camera connection status (connected/disconnected) received via a callback from the parent

## Realtime Channel Design

Channel name: `recording-{match_id}`

**Control phone broadcasts:**
- `{ type: "command", command: "start", timestamp: number }`
- `{ type: "command", command: "stop" }`

**Camera phones broadcast:**
- `{ type: "status", camera_side: "left"|"right", status: "ready"|"recording"|"stopped"|"error", error?: string }`

Both sides use `.on('broadcast', { event: 'recording' }, callback)` to listen.

## Technical Notes

- **No database migration needed** -- Realtime broadcast doesn't persist data
- **No new edge functions needed** -- all signaling is client-side via the existing Realtime connection
- **Camera permissions**: The capture page will request camera access when the user first lands, with a clear prompt explaining why
- **Fallback**: If Realtime connection drops, camera phones can still manually record and upload using the existing file-pick flow
- **iOS Safari compatibility**: MediaRecorder is supported on iOS 14.3+. For older devices, the manual record fallback remains available
- **Recording format**: Uses `video/mp4` where supported, falls back to `video/webm`

## Files to Create
1. `src/components/Matches/RecordingControls.tsx` -- Control phone recording UI with start/stop and status

## Files to Modify
1. `src/pages/CameraCapture.tsx` -- Add Realtime subscription, MediaRecorder integration, remote start/stop handling
2. `src/pages/MatchDetail.tsx` -- Add RecordingControls component
3. `src/components/Matches/CameraQRSetup.tsx` -- Show camera connection status

