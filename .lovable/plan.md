

## Plan — Boxed landscape camera viewfinder + exit from Camera Closed + lens indicator

### Issues to fix

1. **Camera Closed screen has no way out.** Donor is stranded after closing — needs a button to return to the app (or close the tab on web/QR-flow).
2. **Native camera fills the whole screen.** `CameraPreview.start({ toBack: true })` ignores the size of the placeholder `<div>` and draws full-window, so all the white text and badges sit on top of the camera feed and are unreadable.
3. **Donor phones will be in landscape** — viewfinder needs a 16:9 landscape-friendly box, not the current portrait page layout.
4. **Lens indicator is ambiguous** — "4K Native" doesn't confirm the wide-angle lens is in use. Should default to wide-angle and clearly say so.

### Fix 1 — Exit button on the "Camera Closed" / "Disconnected" screen

In `src/pages/CameraCapture.tsx`, the `cancelled` state branch only shows text. Add two buttons inside the card:
- **"Scan new QR"** → navigates to `/scan-qr` (works in the native app where the donor came in via QR).
- **"Close"** → for native: navigates to `/` (Home); for web/non-native deep-link: attempts `window.close()`, falls back to `/`.

This same exit treatment is added to the **Upload Complete** screen too, since right now it just says "you can close this page" with nothing tappable.

### Fix 2 — Boxed camera, sized & positioned to match a real `<div>`

Native CameraPreview supports the `x`, `y`, `width`, `height` parameters in CSS pixels. We currently pass only `width`/`height` as the *capture* resolution (3840×2160), not the preview rectangle on screen. Switch to passing **both**: the recording resolution stays 4K, but the on-screen preview rectangle is positioned to match a measured DOM placeholder.

In `src/components/Matches/CameraRecorder.tsx`:
- Add a `ref` on the viewfinder `<div id="camera-preview-container">`.
- After mount, measure `getBoundingClientRect()` of that div and pass `x`, `y`, `width`, `height` to `CameraPreview.start()` so the camera draws **inside that box only**.
- Re-measure and call `CameraPreview.stop()` then `start()` (or use `setSize`/`flip` if available) on `window.resize` and `orientationchange`, so rotating the phone re-fits.
- The viewfinder div itself becomes a 16:9 box: `aspect-video w-full max-w-[min(95vw,_calc(95vh*16/9))]` — fills available space but caps at the screen, supporting both portrait and landscape. In landscape on a typical phone it'll occupy ~90% of the screen height; in portrait it sits as a wide letterbox in the middle.

Importantly, since the preview is now boxed, the **rest of the UI no longer needs the page transparency hack** — the camera doesn't bleed outside the box. We can keep `wallpaper-twilight` solid on the page and remove the global `.camera-preview-active` body-level transparency, leaving just the viewfinder div transparent. This restores readable text for badges/title/storage-warning.

### Fix 3 — Landscape-aware donor page layout

In `src/pages/CameraCapture.tsx`:
- Use a flex layout that adapts: in portrait, header on top, viewfinder centered, controls below; in landscape, header collapses to a thin top bar (camera-side badge + close button + connection chips on a single row), viewfinder fills the middle, "Choose Existing Video" + waiting-for-start badge tucked to the side.
- Add CSS via Tailwind `landscape:` and `portrait:` variants — e.g. header text shrinks to `landscape:text-sm`, badges become smaller, and the page uses `landscape:flex-row landscape:gap-3` so the viewfinder sits next to the meta panel rather than below.

### Fix 4 — Confirm wide-angle, default to it

`initNativeCamera` already tries `setZoom({ zoom: 0.5 })` first — that IS the ultra-wide path on iPhones with a 0.5× lens. We just need to surface it clearly:
- Replace the ambiguous **"4K Native"** badge in the top-right of the viewfinder with a **lens badge**:
  - `🟢 Wide 0.5×` (green) when `ultraWide === true`
  - `🟡 Standard 1×` (amber) when fallback to 1× — with a small tooltip/caption below: *"Ultra-wide unavailable on this device"*
- The `appliedSettings` chip in the controls row also gets reworded: instead of `"4K • 30fps • 0.5x ultra-wide"` use `"4K · 30fps · Wide-angle"` / `"4K · 30fps · Standard lens"`.
- Wide-angle is already the default attempt — keep that. Add a comment in the code making the fallback chain explicit (`0.5× → 1× → unzoomed`).

### Files

**Edit**
- `src/pages/CameraCapture.tsx` — add Scan-new-QR + Close buttons to Camera Closed and Upload Complete screens; rework page layout for landscape; remove the global `.camera-preview-active` body class toggle (no longer needed because camera is boxed).
- `src/components/Matches/CameraRecorder.tsx` — measure viewfinder div, pass `x/y/width/height` to `CameraPreview.start`, re-measure on resize/orientation; replace "4K Native" badge with lens badge (Wide 0.5× / Standard 1×); reword `appliedSettings` text; make viewfinder a centered 16:9 box that adapts to landscape.
- `src/index.css` — keep `.camera-viewfinder-native { background: transparent }` rule; remove the now-unneeded body/html `.camera-preview-active` rules.

### After the change — local steps
1. `git pull && npm run build && npx cap sync ios`
2. Xcode → Clean Build Folder → Run on donor phone.
3. Rotate phone to landscape — viewfinder should fill the middle, header/controls stay readable around it.
4. Top-right of viewfinder shows green **"Wide 0.5×"** badge.
5. Tap X to close → "Camera closed" screen now has **Scan new QR** and **Close** buttons.

### Out of scope
- Letting the user manually pick the lens on the donor (we keep auto-default to wide-angle).
- Picture-in-picture / floating viewfinder.
- Master-side preview layout changes (master already uses a different component).

