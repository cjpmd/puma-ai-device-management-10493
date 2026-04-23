

## Plan — Fix the false “Camera Access Denied” error by making the donor viewfinder layout reliable on iOS

### What’s actually wrong

This is no longer a real permissions problem.

Your log note matches the current code in `src/components/Matches/CameraRecorder.tsx`:

- camera permission can already be granted
- native plugin can already be loaded
- but the code aborts if the boxed preview area is still measuring as `0×0`

Right now this path is too fragile:

```ts
const rect = await waitForViewfinderRect(8);
if (!rect) {
  setHasPermission(false);
  onStatusChange('error', 'Camera viewfinder not ready');
  return;
}
```

That means a temporary layout-timing issue gets turned into:
- `hasPermission = false`
- the UI card that says **Camera access denied**
- even though iOS already granted camera access

So the bug is really:

1. **Viewfinder measurement is timing out too early on iOS**
2. **A layout/init failure is being mislabeled as a permission failure**

### Fix 1 — make viewfinder measurement much more tolerant

Update `src/components/Matches/CameraRecorder.tsx` so the preview rect wait is designed for iOS WebView timing instead of desktop timing.

#### Changes
- Increase `waitForViewfinderRect()` from a short animation-frame loop to a longer wait window
- Use around **20 attempts** with a **~50ms pause** between attempts
- Add measurement logging so we can see width/height progression on device
- Keep rejecting tiny rects (`< 10px`) so we never pass junk values into native preview start

Conceptually:

```ts
const waitForViewfinderRect = async (maxAttempts = 20) => {
  for (let i = 0; i < maxAttempts; i++) {
    const rect = measureViewfinderRect();
    if (rect) return rect;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
};
```

This gives the donor screen enough time for:
- route transition
- HTML transparency class application
- safe-area layout
- aspect-ratio sizing
- final WebView reflow

### Fix 2 — add a safe fallback rect instead of failing hard

If the viewfinder still isn’t measurable after the longer wait, don’t immediately fail the camera.

In `src/components/Matches/CameraRecorder.tsx`, change the rect resolution order to:

1. current measured rect
2. `lastRectRef.current` if available
3. a safe viewport-based fallback rect

Example fallback strategy:
- center horizontally
- use `window.innerWidth` capped to the same intended max width
- use 16:9 aspect ratio
- place it below the header area with a safe top inset

That prevents the app from dying just because layout settled a little late.

Expected result:
- native camera can still start
- resize/refit logic can correct it once the real box is measurable

### Fix 3 — stop turning layout failures into “permission denied”

Right now `hasPermission === false` always renders:

- **Camera access denied**
- “Allow camera access in your device settings…”

That is misleading.

Update `src/components/Matches/CameraRecorder.tsx` to separate:
- actual permission denial
- plugin load failure
- preview layout not ready
- native camera start failure

#### Changes
Add a dedicated error state, for example:
- `cameraError: string | null`

Then use:
- `setHasPermission(false)` only for genuine permission problems
- `setCameraError('Camera preview box not ready')` or similar for layout/start issues

UI states should become:

- real permission problem:
  - title: `Camera access denied`
  - helper: device settings guidance

- non-permission startup problem:
  - title: `Camera failed to start`
  - helper: actual error text like:
    - `Preview box not ready`
    - `Camera plugin failed to load`
    - `Camera in use, please try again`

This will stop sending everyone down the wrong troubleshooting path.

### Fix 4 — mount the recorder only after the page chrome is settled

The recorder currently mounts as soon as the capture page renders, while `CameraCapture.tsx` is still applying the `camera-preview-active` class and laying out the donor screen.

Add a small mount gate in `src/pages/CameraCapture.tsx`:

- once `tokenInfo` is loaded and the capture UI is about to show
- apply `camera-preview-active`
- wait briefly or for 1–2 animation frames
- then mount `<CameraRecorder />`

That ensures the boxed preview container exists at a stable size before `initNativeCamera()` runs.

Implementation options:
- `readyToMountRecorder` state
- flip to `true` after the class is applied and layout has settled

This should materially reduce the number of 0×0 measurements before they happen.

### Fix 5 — keep retrying preview start, then refit once layout becomes real

The existing retry logic for `CameraPreview.start()` is still useful, so keep it.

Add one more safety improvement in `src/components/Matches/CameraRecorder.tsx`:

- if startup used a fallback rect, schedule one post-start refit
- once the real viewfinder becomes measurable, stop/start preview with the true rect

That gives:
- reliable startup
- correct final alignment
- no crash from starting too early with invalid geometry

### Files to update

**Edit**
- `src/components/Matches/CameraRecorder.tsx`
  - strengthen `waitForViewfinderRect()`
  - add debug measurement logging
  - add fallback rect logic
  - separate permission errors from startup/layout errors
  - improve donor-facing error card copy
  - optionally refit after startup if fallback geometry was used

- `src/pages/CameraCapture.tsx`
  - gate `<CameraRecorder />` mount until the page layout and `camera-preview-active` class have settled

### Expected result after the fix

On the donor iPhone:

- scanning the QR no longer falls into a fake **Camera access denied** state
- the native preview starts even if the layout is slightly delayed
- if layout is slow, fallback geometry is used temporarily and corrected afterward
- if startup really fails, the donor sees an accurate error message instead of a permissions message

### Local verification after implementation

1. Rebuild and sync the iOS app.
2. Open donor flow and scan a QR.
3. Confirm the live boxed preview appears.
4. Confirm logs show rect measurements progressing rather than failing immediately.
5. Repeat on the second donor phone after donor one is already connected.
6. If anything still fails, master should receive a specific startup error rather than a generic denial state.

### Out of scope

- Reverting the QR scanner teardown delay
- Reworking the donor UI design again
- Changing the lens-selection logic unless startup still fails after the layout fix

