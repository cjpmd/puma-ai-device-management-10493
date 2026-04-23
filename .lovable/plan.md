

## Plan — Fix "Camera access denied" on the donor iPhone after QR scan

### What's actually broken

The screenshot shows the donor phone rendering the **web fallback** UI (no native preview rect, normal page background, "Camera access denied" card). On iOS, `navigator.mediaDevices.getUserMedia()` inside the WKWebView returns "denied" — that's expected, the native Capacitor plugin is what actually owns the camera. So the real question is: why is the donor phone running the web fallback at all on a native iOS build?

Root cause is in `src/components/Matches/CameraRecorder.tsx`, lines 9-25 and 178-185:

```ts
let CameraPreview: any = null;
if (isNative) {
  import('@capacitor-community/camera-preview').then((m) => { CameraPreview = m.CameraPreview; });
  …
}
…
const initNativeCamera = async () => {
  await new Promise((r) => setTimeout(r, 300));   // hope it's loaded
  if (!CameraPreview) {
    setUseNative(false);
    initWebCamera();                              // → getUserMedia → "denied"
    return;
  }
```

The lazy `import()` is fired but **never awaited**. The component then waits a fixed 300 ms and assumes the module has loaded. On a cold native start — exactly the situation we just made worse by adding the 250 ms `setTimeout` settle delay in `ScanQR.tsx` — the dynamic import for `@capacitor-community/camera-preview` (a native plugin module that includes a moderate amount of TS) hasn't resolved yet. `CameraPreview` is still `null`, the code falls into `initWebCamera()`, `getUserMedia` throws, and the catch on line 397 sets `"Camera access denied"`.

This was almost certainly triggered by the recent ScanQR change pushing the CameraRecorder mount earlier in the cold-start window, but the underlying race has always been there — it's just become reliable now.

### Fix

Replace the fire-and-forget lazy imports with a proper awaited loader, and have `initNativeCamera()` await it before deciding native-vs-web. No more 300 ms guess.

**`src/components/Matches/CameraRecorder.tsx`**

1. Replace the top-of-file block:
   ```ts
   if (isNative) {
     import('@capacitor-community/camera-preview').then(...);
     import('@capacitor/device').then(...);
     import('@capacitor/filesystem').then(...);
   }
   ```
   with a single shared promise:
   ```ts
   let nativePluginsReady: Promise<void> | null = null;
   const loadNativePlugins = () => {
     if (!isNative) return Promise.resolve();
     if (!nativePluginsReady) {
       nativePluginsReady = Promise.all([
         import('@capacitor-community/camera-preview').then(m => { CameraPreview = m.CameraPreview; }),
         import('@capacitor/device').then(m => { DevicePlugin = m.Device; }),
         import('@capacitor/filesystem').then(m => { Filesystem = m.Filesystem; }),
       ]).then(() => undefined);
     }
     return nativePluginsReady;
   };
   ```

2. In `initNativeCamera()`, replace the fixed 300 ms wait with:
   ```ts
   try {
     await loadNativePlugins();
   } catch (e) {
     console.error('[CameraRecorder] Native plugin import failed', e);
   }
   if (!CameraPreview) {
     // Real failure — module genuinely couldn't load. Show a clear message
     // instead of silently falling through to the web getUserMedia path,
     // which on iOS WKWebView always reports "denied".
     setHasPermission(false);
     onStatusChange('error', 'Camera plugin failed to load');
     return;
   }
   ```

3. Remove the silent `initWebCamera()` fallback when running natively. The web fallback is only correct for the actual web build; calling it inside an iOS shell is what produces the misleading "Camera access denied" card. Keep `initWebCamera()` in place for the `!isNative` path on lines 84-86.

4. Update the catch in `initWebCamera()` so the error message distinguishes "no permission" from "feature unavailable" — only set `"Camera access denied"` when the real `NotAllowedError` is thrown; otherwise show the actual error name. This prevents future confusion if the web path ever runs unexpectedly.

### Why this fixes it

- The donor phone will now wait for the native plugin to actually be loaded before deciding what to do, with no fixed timeout.
- If the plugin really can't load (e.g. truly missing on the build), the screen says "Camera plugin failed to load" instead of the misleading "Camera access denied" — which is what tricked us into hunting a permissions problem when the OS settings were already correct.
- The native preview will start on the first attempt because `CameraPreview` is guaranteed non-null when `initNativeCamera()` reaches the `start()` call.

### Files

**Edit**
- `src/components/Matches/CameraRecorder.tsx`
  - Replace fire-and-forget dynamic imports with an awaited `loadNativePlugins()` promise.
  - Remove the 300 ms `setTimeout` guess.
  - On native, never fall through to `initWebCamera()` — show a clear plugin-load error instead.
  - Tighten the web fallback's catch so only real `NotAllowedError` becomes "Camera access denied".

**No DB changes. No other files touched. No new packages. No native patch changes — the plugin is already installed and patched correctly.**

### After the change — local steps
1. `git pull && npm install`
2. `npm run build && npx cap sync ios`
3. Xcode → **Product → Clean Build Folder** → Run on the donor iPhone.
4. Open the app → **Scan Camera QR** → scan a donor QR.
5. The capture screen now shows the live ultra-wide preview in the boxed viewfinder. No "Camera access denied".

### Out of scope
- Reverting the ScanQR settle delay (it correctly fixes the donor-2 crash; we're keeping it).
- Changing the iOS `Info.plist` or permission prompts (those are already correct — the previous error was a false negative, not a real permission denial).
- Adding a manual lens picker on donor phones.

