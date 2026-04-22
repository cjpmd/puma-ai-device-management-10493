

## Plan — Make the boxed camera actually visible + enable real ultra-wide lens

### What's broken right now (confirmed from code + your screenshot)

1. **Camera box is empty / invisible.** The native preview is rendered with `toBack: true` (behind the WKWebView). We made the viewfinder `<div>` transparent, but its **parent** `<div class="wallpaper-twilight">` paints an opaque purple gradient over the entire page — including the rectangle where the camera should show through. There's no actual hole in the WebView for the camera to peek through. That's why you see the gap with nothing in it.
2. **Ultra-wide is reported "unavailable" even though your iPhone has it.** I read the iOS Swift source of `@capacitor-community/camera-preview@7.0.5`: it discovers cameras with `AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera], …)` (line 49 of `CameraController.swift`). It only uses the **single wide-angle lens**. `setZoom({zoom: 0.5})` then hits `videoZoomFactor = 0.5`, which iOS clamps to a minimum of 1.0 — so we silently fall to "Standard 1×". The plugin has no concept of `.builtInUltraWideCamera` at all.
3. **No "REC" placeholder when recording starts.** Today, while `startRecordVideo` runs, the page just shows the same viewfinder. You asked for an explicit black-screen + red REC circle + close button.

### Fix 1 — Punch a hole in the WebView so the native camera shows through

Strategy: instead of trying to make a single `<div>` transparent, switch the donor capture page into a **"camera-active"** mode where the WebView root is fully transparent EXCEPT the UI chrome (badges, header, controls, REC overlay), which remain solid via their own backgrounds.

In `src/index.css` add:
```css
/* When the donor capture screen is showing the live preview, the WebView
   itself must be transparent so the AVCaptureVideoPreviewLayer (rendered
   behind the WebView via toBack:true) is visible inside the viewfinder rect. */
html.camera-preview-active,
html.camera-preview-active body,
html.camera-preview-active #root,
html.camera-preview-active .ios-app-shell,
html.camera-preview-active .wallpaper-twilight {
  background: transparent !important;
}
/* The viewfinder hole stays explicitly transparent. */
.camera-viewfinder-native { background: transparent !important; }
```

In `src/pages/CameraCapture.tsx`:
- When the recorder mounts in native mode, add `camera-preview-active` to `document.documentElement` (and remove on unmount / `cancelled` / `uploadDone`).
- Wrap header / status badges / "Choose Existing Video" button / Cancel X button in a small wrapper with its own `bg-black/40 backdrop-blur` so they remain readable on top of the live camera. They no longer rely on the page background.
- Restore the page background only when we leave the recording UI (cancelled / uploaded / file-selected states).

Net effect: in landscape, the donor sees the live camera filling the centre 16:9 box, with floating dark glass chips for badges/header above and below it, and the X close button top-right.

### Fix 2 — Enable the real ultra-wide (0.5×) lens

The plugin doesn't expose ultra-wide, so we patch it. Two parts:

**Part A — patch the iOS plugin Swift** (`patch-package` post-install patch so it survives `npm install`):
- Change line 49 of `CameraController.swift` from
  `[.builtInWideAngleCamera]` → `[.builtInUltraWideCamera, .builtInWideAngleCamera, .builtInDualWideCamera]`
- Where `rearCamera` is selected, prefer `.builtInUltraWideCamera` first, then fall back.
- Add a new public method `setLens(lens: "ultraWide" | "wide")` that swaps the rear `AVCaptureDeviceInput` at runtime. (We actually only need to choose at start, so a simpler approach: read a new `lens` option in `start({ lens: "ultraWide" })` and pick the device on init.)
- Expose a getter `isUltraWideAvailable` returning bool.

**Part B — TypeScript wrapper update** in `CameraRecorder.tsx`:
- After resolving the plugin, call the new `isUltraWideAvailable()` check.
- Pass `lens: 'ultraWide'` to `CameraPreview.start()` when supported. Set `appliedZoom = 0.5` and `isUltraWide = true` accordingly.
- Drop the `setZoom({zoom: 0.5})` hack — that was never working; the actual switch is at the device-input level.

Add a `patches/@capacitor-community+camera-preview+7.0.5.patch` file and add `"postinstall": "patch-package"` to `package.json`. After `npm install && npx cap sync ios`, the patched Swift compiles into your app.

### Fix 3 — REC placeholder screen

In `CameraRecorder.tsx`, when `isRecording === true`, replace the viewfinder content (still keep the same outer div so the native preview rect doesn't move — we just paint over it) with a full-rect overlay:
- Solid black `bg-black` covering the viewfinder box.
- Centered: large pulsing red `Circle` icon (h-24 w-24) + "REC" text + elapsed timer (mm:ss).
- Top-right inside the box: an X button that calls `stopRecording()` AND triggers the page's `handleCancel()` to go back to the previous screen / Camera-closed state.
- Outside the box, the floating REC badge (top-left of the page) stays as-is for at-a-glance status.

Why we paint over instead of stopping the camera: the native preview layer is behind, and the recording is being captured from the same input. A black overlay in the WebView simply hides the live feed without interrupting capture — exactly what you asked for.

### Fix 4 — Polish

- Update the lens badge logic to reflect the patched plugin: green `Wide 0.5×` when ultra-wide is the active input, amber `Standard 1×` otherwise (true fallback for older iPhones without ultra-wide, e.g. SE, iPhone 8).
- `appliedSettings` text becomes `4K · 30fps · Ultra-wide 0.5×` or `4K · 30fps · Wide 1×`.

### Files

**Edit**
- `src/index.css` — add `.camera-preview-active` body/root/wallpaper transparency rules.
- `src/pages/CameraCapture.tsx` — toggle `camera-preview-active` on `<html>` while recorder is mounted; give floating chrome elements their own dark glass background.
- `src/components/Matches/CameraRecorder.tsx` — pass `lens: 'ultraWide'` to plugin, read `isUltraWideAvailable()`, drop `setZoom(0.5)` hack, render black/REC overlay over the viewfinder box while recording (with X to stop+exit).
- `package.json` — add `patch-package` dependency + `postinstall` script.

**Create**
- `patches/@capacitor-community+camera-preview+7.0.5.patch` — Swift patch to add `.builtInUltraWideCamera` to discovery, prefer it as rear camera, expose `lens` start option + `isUltraWideAvailable` method.

### After the change — local steps
1. `git pull && npm install` (runs `patch-package` automatically and applies the Swift patch).
2. `npm run build && npx cap sync ios`.
3. Xcode → **Product → Clean Build Folder** → Run on the donor iPhone.
4. Rotate to landscape: viewfinder now shows the live ultra-wide feed in a 16:9 box with floating dark badges above/below.
5. Top-right of viewfinder shows green **Wide 0.5×**.
6. Hit start (from master) → donor screen turns black with pulsing red REC circle + timer + X to stop.
7. Hit X on the REC screen → stops + returns to "Camera closed" with Scan QR / Close buttons.

### Out of scope
- iPad-style picture-in-picture floating preview.
- Per-camera lens picker on the master phone (we always default to ultra-wide when available).
- Patching the Android side (you're on iPhone-only for donor recording per your spec).

