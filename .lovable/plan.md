

## Plan — Fix false “Ultra-wide unavailable” on iPhone and make lens detection reflect the actual active lens

### What’s actually wrong

Your screenshot confirms the donor iPhone does have an ultra-wide rear lens: the native Camera app shows **0.5× / 13mm**. So this is not a hardware problem — it is an app/plugin integration problem.

There are two likely app-side bugs in the current implementation:

1. **The patched iOS plugin method is probably not exposed to JavaScript.**  
   The Swift patch adds `isUltraWideAvailable(_:)`, but the Capacitor plugin’s `pluginMethods` list still only exposes:
   `start`, `stop`, `capture`, `captureSample`, `flip`, `getSupportedFlashModes`, `setFlashMode`, `startRecordVideo`, `stopRecordVideo`, `isCameraStarted`.

   That means `CameraPreview.isUltraWideAvailable` may never exist on the JS side, so the React code falls back to `false` and shows:
   - `Standard 1×`
   - `Ultra-wide unavailable`

2. **The React code is checking the wrong field.**  
   The patched Swift returns:
   ```json
   { "value": available, "active": rearIsUltraWide }
   ```
   But the code currently uses `value`, which only means “this phone has an ultra-wide camera”, not “the ultra-wide lens is the one currently active”.

So even after the patch, the badge logic is not reliable yet.

### Fix 1 — properly export the new Capacitor plugin method

Update the iOS patch in:

- `patches/@capacitor-community+camera-preview+7.0.5.patch`

Add `isUltraWideAvailable` to the plugin’s exported method list in `CameraPreviewPlugin.swift`, e.g. alongside `isCameraStarted`.

That ensures the JS bridge actually exposes:
```ts
CameraPreview.isUltraWideAvailable()
```

Without this, the React layer can’t verify lens availability/active state at all.

### Fix 2 — use the plugin response correctly

In `src/components/Matches/CameraRecorder.tsx`:

Change the detection logic so it distinguishes between:
- `available` = the phone has an ultra-wide rear camera
- `active` = the ultra-wide lens is the one currently selected by the plugin

Use the response like this conceptually:
- `available = !!result.value`
- `active = !!result.active`

Then:
- if `active === true` → show `Ultra-wide 0.5×`
- if `available === true && active === false` → show a fallback state like `Ultra-wide available, fallback to 1×`
- if `available === false` → show `Ultra-wide unavailable`

Right now the UI collapses all non-success cases into the same “unavailable” message, which is misleading.

### Fix 3 — verify the plugin really selects the ultra-wide lens on start

Keep the patched `lens: 'ultraWide'` option in `CameraPreview.start(...)`, but tighten the logic in `CameraRecorder.tsx`:

- Start native camera with `lens: 'ultraWide'`
- Immediately query `isUltraWideAvailable()`
- Use `active` from the response to decide whether the plugin actually switched lenses
- Set `appliedSettings` and the master-device capability payload from the same source of truth

Target states:
- `4K · 30fps · Ultra-wide 0.5×`
- `4K · 30fps · Wide 1× (fallback)`

This makes the donor badge and the master telemetry consistent.

### Fix 4 — improve the fallback message so it’s honest

In `src/components/Matches/CameraRecorder.tsx`, replace the current fallback text:

- current:
  - `Standard 1×`
  - `Ultra-wide unavailable`

with something more accurate:

- if ultra-wide exists but is not active:
  - badge: `Wide 1×`
  - helper text: `Ultra-wide available, but not activated`
- if ultra-wide truly does not exist:
  - badge: `Wide 1×`
  - helper text: `Ultra-wide not supported on this device`

That way the UI stops falsely telling you the phone lacks the lens.

### Fix 5 — keep the REC placeholder behavior aligned with the current donor UX

The current code already has the black recording overlay with:
- black screen
- large red circle
- `REC`
- timer
- `X` button

I’ll keep that behavior and make sure the `X` action cleanly:
- stops recording
- returns the donor to the closed/exit state
- keeps the master informed through status updates

No redesign needed there unless you want it changed later.

### Files

**Edit**
- `patches/@capacitor-community+camera-preview+7.0.5.patch`
  - export `isUltraWideAvailable` in the plugin method list
  - keep the ultra-wide device-selection patch
- `src/components/Matches/CameraRecorder.tsx`
  - read `active` vs `value` correctly
  - separate “available” from “active”
  - update donor badge + applied settings text
  - send correct capability data to the master device

### Expected result after the fix

On a donor iPhone that supports 0.5×:
- the donor screen should show **Ultra-wide 0.5×** instead of `Standard 1×`
- the master device should receive `ultraWide: true`
- the capabilities badge on the master should show the ultra-wide status correctly

If the plugin still falls back after that, the UI will explicitly say it is a **fallback**, not that the hardware is missing.

### Local steps after implementation

1. `git pull`
2. `npm install`
3. `npm run build && npx cap sync ios`
4. In Xcode: **Product → Clean Build Folder**
5. Re-run on the donor iPhone

This clean rebuild matters because the lens logic lives in patched native Swift code.

### Out of scope
- Adding a manual lens picker on donor phones
- Android lens patching
- Reworking the donor layout again unless needed after the lens fix

