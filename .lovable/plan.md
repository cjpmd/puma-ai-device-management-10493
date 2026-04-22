

## Plan — Stop the second donor phone crashing right after it scans the QR

### What's actually going wrong

You said: same app on both donor phones, same account, both use the in-app **Scan Camera QR** flow, and the crash happens right after the QR is read and the camera "briefly opens". That rules out the things ChatGPT guessed:

- **Not token reuse.** Master generates a unique token for *left* and another for *right* — they're different tokens.
- **Not multi-session auth.** Supabase happily handles the same account on two devices; that doesn't crash native code.
- **Not "first camera locked".** Each phone has its own camera; donor 1's camera is irrelevant to donor 2.

What's actually happening on donor 2 is a **native iOS AVCaptureSession collision and a 0×0 preview rectangle**, all triggered by the QR-scan → capture-screen handoff. Three concrete bugs:

### Bug 1 — MLKit scanner isn't fully released before `CameraPreview.start()` grabs the camera

In `src/pages/ScanQR.tsx`, when a QR is read we call:
```
await stopScan();
…
navigate(`/capture/${token}`);
```

`stopScan()` calls `BarcodeScanner.stopScan()` and removes the body class, but on iOS the underlying `AVCaptureSession` from MLKit is torn down **asynchronously** on the camera queue. We then immediately mount `CameraCapture` → `CameraRecorder` → `CameraPreview.start({ position:'rear', toBack:true })` typically within ~300 ms. On the second donor phone that race fires more reliably (cold caches, slower init), and AVFoundation throws `AVErrorDomain -11852 / -11819` ("camera in use by another client"), which the plugin re-throws as an unhandled native exception → app crash.

**Fix:** in `ScanQR.tsx`, `stopScan()` becomes a real teardown and waits for it:
- await `BarcodeScanner.removeAllListeners()`
- await `BarcodeScanner.stopScan()`
- remove the body/html `barcode-scanner-active` classes
- then `await new Promise(r => setTimeout(r, 250))` to let the AVCaptureSession queue actually release

Only then call `navigate(`/capture/${token}`)`. The settle delay is the standard iOS workaround for the well-known `BarcodeScanner ↔ CameraPreview` handoff race.

### Bug 2 — Defensive guard if AVCaptureSession is *still* busy

In `src/components/Matches/CameraRecorder.tsx`'s `initNativeCamera()`, wrap `CameraPreview.start()` in a retry-with-backoff (3 attempts, 400ms apart). If the camera is briefly busy from MLKit's teardown, we recover instead of crashing. After the final failure, surface a friendly error in the existing `hasPermission === false` card with a **Try Again** button (already present) — the donor can retry without the page becoming unresponsive.

We also wrap the existing two `try { await CameraPreview.start(startOpts) }` calls in a top-level try/catch and never let the promise rejection escape to the React error boundary.

### Bug 3 — Zero-size viewfinder rectangle when measured too early

In `initNativeCamera()` we already do one `requestAnimationFrame` then `measureViewfinderRect()`. That's not enough on the second device because the `camera-preview-active` html class is being added in `CameraCapture.tsx` *concurrently* (a parallel `useEffect`), which forces a re-layout. The first measurement can come back with `width:0` / `height:0` if the viewfinder div hasn't taken its final size yet. Passing `width:0,height:0` to `CameraPreview.start()` is what reliably crashes the AVFoundation pipeline on iPhone.

**Fix:** in `measureViewfinderRect()`, if `width<10 || height<10` return `null`. In `initNativeCamera()`, if the rect is null/zero-sized, retry up to 5 times with `requestAnimationFrame` before giving up. Also defer the call until **after** `camera-preview-active` is on `<html>`. Easiest way: `CameraCapture.tsx` already sets the class in a `useEffect`; we just add a small `await new Promise(r => setTimeout(r, 50))` at the start of `initNativeCamera` so layout has settled.

### Bug 4 — Realtime broadcast cross-talk on master and both donors

Both donor phones subscribe to `recording-${match_id}`. Today, when master sends `live_preview_on/off` or `disconnect` without a `camera_side` filter, both donors react. That isn't the crash, but it is the source of the "behaves weirdly when two phones are connected" reports you'll get after this fix. Tighten it:

- In the donor's broadcast handler in `CameraCapture.tsx`, ignore any payload whose `camera_side` is set and doesn't match this donor's side. Already done for `disconnect`; do the same for `live_preview_on / live_preview_off / start / stop`. Master can still address "all" by omitting `camera_side`.

### Bug 5 — No diagnostics when it does crash

The current `catch` in `initNativeCamera` only does `console.error`. Add `Logger.error('camera-init', err)` style logging that ALSO sends a `status: 'error'` broadcast with the error message back to the master via `onStatusChange('error', err.message)`. That way next time we'll see it on the master device's panel instead of guessing.

### Files

**Edit**
- `src/pages/ScanQR.tsx` — robust teardown of MLKit scanner with `removeAllListeners` + a 250 ms settle delay before `navigate()`.
- `src/components/Matches/CameraRecorder.tsx` — retry `CameraPreview.start()` up to 3× on transient AVFoundation failures; reject 0-size rects and re-measure with `requestAnimationFrame` up to 5×; better error reporting to master via `onStatusChange`.
- `src/pages/CameraCapture.tsx` — small settle delay before mounting `<CameraRecorder>` (or a `useState` gate that flips true after the `camera-preview-active` class is applied) and per-side filtering on `live_preview_on/off / start / stop` broadcasts.

**No DB changes. No schema changes. No new packages.**

### After the change — local steps
1. `git pull && npm install`
2. `npm run build && npx cap sync ios`
3. Xcode → **Product → Clean Build Folder** → Run on **donor phone 2** (the one that was crashing).
4. Donor 1 scans left QR → records.
5. While donor 1 is on the capture screen, donor 2 opens the app → **Scan Camera QR** → scans the right QR. The MLKit scanner now waits for AVCaptureSession to release; if it's still busy, we retry; if the viewfinder isn't laid out, we retry — no crash.
6. If anything still goes wrong, check master's connection panel — donor 2's tile will show a red **error** badge with the actual native error message, instead of the donor app silently dying.

### Out of scope
- Switching off MLKit for a different scanner.
- Generating one shared QR code (you correctly use one per side).
- Auto-reconnect after a crash (donor will still need to scan again — but at least it won't crash).

