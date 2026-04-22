

## Plan — Get the new "Scan Camera QR" tile onto the iOS device

### Diagnosis
- Code is correct: the tile exists in `src/pages/ios/HomeScreen.tsx` (lines 260–278), the `/scan-qr` route is registered, and `ScanQR.tsx` is in place. The Lovable desktop preview shows it (image-22), and tapping it correctly shows the "needs the native app" fallback (image-23) because Capacitor only goes "native" inside the actual installed iOS app.
- The phone isn't showing the tile, which means **the iOS app is still running an old `dist/` bundle**. Capacitor apps embed a snapshot of `dist/` at build time — if `npm run build` didn't run before `npx cap sync ios`, or Xcode's "Clean Build Folder" wiped the staged web assets, the new HomeScreen never made it into the `.ipa` installed on the phone.
- A secondary suspect: there's no `server.url` (correct, you wanted that), so the phone has **no way** to pick up new code except by re‑bundling and re‑installing. There's no live reload safety net here.

### Fix — verification step inside the app
Add a tiny build-stamp badge to the iOS Home screen so we can tell at a glance which bundle is running on the phone. This is the fastest way to diagnose stale bundles in the future and confirm the new build actually landed.

**Edit `src/pages/ios/HomeScreen.tsx`** — add a 1-line build stamp under the existing "Scan Camera QR" tile:
```tsx
<div style={{ ...tType('caption2'), color: T.fg2, opacity: 0.4, textAlign: 'center', padding: '4px 16px 0' }}>
  build {import.meta.env.VITE_BUILD_ID ?? new Date().toISOString().slice(0,16)}
</div>
```
Vite stamps `new Date()` at build time (it's evaluated when the bundle is built, not at runtime), so the timestamp on the phone will tell you exactly when the bundle on it was built. If after rebuilding the stamp on the phone is still old, you know the bundle didn't sync.

### What to run locally (the order matters)
1. `git pull`
2. `npm install`
3. `rm -rf dist ios/App/App/public` ← **this is the key step you may be missing**. Xcode "Clean Build Folder" doesn't wipe the Capacitor web assets that live at `ios/App/App/public/`. If you skip this, the old `index.html` + JS bundle stays embedded in the app even after a fresh `npm run build`.
4. `npm run build`
5. `npx cap sync ios` (this copies the fresh `dist/` into `ios/App/App/public/` and re-installs CocoaPods for the new `@capacitor-mlkit/barcode-scanning` and `@capacitor/app` plugins)
6. In Xcode: Product → Clean Build Folder, then Run on the device.
7. On the phone, confirm the new build stamp appears under the Scan tile, and the tile itself is visible just under the "Next Friendly" card on the Home screen.

### If after step 7 the tile still isn't there
Then the bundle truly isn't updating. Send back a screenshot of the iOS Home screen — the missing/old build stamp will tell us whether it's a Capacitor sync issue (stamp matches an older build) or a rendering issue (stamp is fresh but tile missing, which would point to a runtime error we can chase via Safari → Develop → your iPhone → Console).

### Files
**Edit**
- `src/pages/ios/HomeScreen.tsx` — add the build-stamp line under the Scan Camera QR tile.

### Out of scope
- Adding `server.url` back in for live reload — explicitly not wanted.
- Universal Links.

