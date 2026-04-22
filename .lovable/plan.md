

## Plan — Fix donor camera black screen + show lens/storage/battery on master + master can cancel donor

### Issue 1 — Donor camera viewfinder is black
Same root cause as the QR scanner. `@capacitor-community/camera-preview` is started with `toBack: true`, which renders the live feed at the **native layer behind the WebView**. The current viewfinder `<div>` has `bg-black`, the page wrapper has `wallpaper-twilight` (a solid background), and Card components paint solid surfaces — all of which cover the camera feed.

**Fix in `src/components/Matches/CameraRecorder.tsx`:**
- Replace `bg-black` on the viewfinder wrapper with `bg-transparent` and add `style={{ background: 'transparent' }}` for safety, but only when running native + camera preview is active. Web fallback (`<video>`) keeps `bg-black`.
- Wrap the native preview container in a class `camera-preview-active` that we toggle on the body when the recorder is mounted in native mode.

**Fix in `src/pages/CameraCapture.tsx`:**
- When in native mode and the recorder is shown, the page wrapper (`wallpaper-twilight`) must be transparent. Add a `camera-page-transparent` class to `<html>`, `<body>`, and `#root` while the recorder is mounted, then remove on unmount/upload-complete.

**Fix in `src/index.css`:**
- Add the matching CSS:
```css
html.camera-preview-active,
body.camera-preview-active,
body.camera-preview-active #root,
body.camera-preview-active .ios-app-shell,
body.camera-preview-active .wallpaper-twilight {
  background: transparent !important;
}
/* The viewfinder hole — actively transparent */
.camera-viewfinder-native {
  background: transparent !important;
}
```
We do **not** use the `visibility: hidden` trick this time, because unlike the QR scanner we want the surrounding chrome (header, status badges, REC indicator, controls) to remain visible over the camera feed. We only need the **backgrounds** to be transparent.

### Issue 2 — Donor needs a "Cancel / Close" button
Currently the donor screen has no way to bail out before recording. Add to `src/pages/CameraCapture.tsx`:
- An **X** close button in the top-right corner of the donor page that:
  1. Sends a `{type: 'status', camera_side, status: 'cancelled'}` broadcast so the master sees it disappear.
  2. Stops the camera preview cleanly via `cleanup()`.
  3. Navigates back / closes the page (`window.history.back()` if there's history, else show a "You can close this tab" screen — same as upload-done state).

### Issue 3 — Master should see lens/storage/battery + ultra-wide confirmation
The donor already detects the lens (`appliedSettings` string like `"4K • 30fps • 0.5x ultra-wide"`) but never tells the master. The master already shows battery + storage but nothing about lens.

**Donor side (`CameraRecorder.tsx`):**
- New prop `onCapabilities?: (caps: { resolution: string; fps: number; zoom: number; ultraWide: boolean }) => void` invoked once after `initNativeCamera`/`initWebCamera` succeeds.
- In `CameraCapture.tsx`, wire `onCapabilities` to a new broadcast payload type `'capabilities'`:
```ts
{ type: 'capabilities', camera_side, resolution: '3840×2160', fps: 30, zoom: 0.5, ultraWide: true }
```

**Master side (`RecordingControls.tsx`):**
- Extend `CameraState` with `capabilities?: { resolution; fps; zoom; ultraWide }`.
- Listen for the new `'capabilities'` payload and store it.
- In each `CameraPanel`, render a small badge row under the preview thumbnail:
  - Resolution badge (e.g. `4K`)
  - FPS badge (e.g. `30fps`)
  - Lens badge — green check `Ultra-wide ✓` when `ultraWide === true`, otherwise neutral `1× lens` (with a small warning tone if zoom > 1, since narrow lens means less pitch coverage).

Battery and storage are already shown — no change needed there.

### Issue 4 — Master can reject/disconnect a donor
Add to each `CameraPanel` in `RecordingControls.tsx`:
- A small **X** "Disconnect" icon button in the panel header (next to the status badge).
- On click: confirm via a `window.confirm("Disconnect Left/Right camera? They'll need to scan a new QR.")`, then broadcast `{type: 'command', command: 'disconnect', camera_side}`.

Donor side handles `'disconnect'` in `CameraCapture.tsx`'s channel handler:
- Trigger the same close flow as the donor cancel button: stop camera, show a "Disconnected by match organiser" screen, allow them to close the page.

### Files

**Edit**
- `src/index.css` — add `.camera-preview-active` transparency rules + `.camera-viewfinder-native` rule.
- `src/components/Matches/CameraRecorder.tsx` — make viewfinder transparent in native mode, expose `onCapabilities` callback, broadcast applied lens/resolution/fps once on init.
- `src/pages/CameraCapture.tsx` — toggle `camera-preview-active` class on `html`/`body` while recorder mounted; add Cancel/Close button; handle `disconnect` command from master; wire new `onCapabilities` to a `capabilities` broadcast payload.
- `src/components/Matches/RecordingControls.tsx` — listen for `capabilities` payload, render lens/resolution/fps badges, add per-panel Disconnect (X) button that broadcasts `{command: 'disconnect'}`.

### After the change — local steps
1. `git pull && npm run build && npx cap sync ios`
2. Xcode → Clean Build Folder → Run on **donor** phone (this is where the black-screen fix takes effect).
3. On master phone: open match → see donor preview thumbnail with 4K • 30fps • Ultra-wide ✓ badges, plus an X to disconnect.
4. On donor: tap the X to cancel, or have master tap X — donor returns to a "Closed" screen.

### Out of scope
- Re-detecting the lens mid-recording (we capture it once at init).
- Allowing master to remotely change donor zoom / lens.
- Auto-reconnect after disconnect (donor scans a new QR to rejoin).

