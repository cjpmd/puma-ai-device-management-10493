

## Plan — Restore Capacitor config so QR capture page loads

### Diagnosis
- `capacitor.config.ts` was overwritten on commit `9bcb546` ("Remove server configuration from capacitor.config.ts"). It now has no `server.url`, so the installed iOS native app loads the bundled `dist/` (stale/empty) instead of the live Lovable preview.
- The `/capture/:token` route + the `validate-camera-token` edge function both exist and look correct in the codebase.
- When you scan the QR code on your iPhone, iOS opens the link in the Capacitor app (because of the `player-analysis://` scheme + Universal Links), and the native app has no live bundle to render → **blank screen**.
- In a regular mobile browser (Safari without the app installed), the same URL would actually work — so this is specifically a "native app shell is empty" problem, not a routing or backend bug.

### Fix
Restore `capacitor.config.ts` to the version you provided, with the small tweaks needed for it to actually compile and behave correctly:

```ts
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.cb1a7443dfe74413bc7a813cf6770aa3",
  appName: "Player Analysis",
  webDir: "dist",
  server: {
    url: "https://cb1a7443-dfe7-4413-bc7a-813cf6770aa3.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    scheme: "Player Analysis",
    backgroundColor: "#ffffff",
  },
  plugins: {
    CameraPreview: {
      iosDisableAudio: false,
    },
  },
};

export default config;
```

Notes on what I'm doing differently from the JSON you pasted:
- `packageClassList` is **not a valid CapacitorConfig field** in TypeScript — Capacitor auto-registers plugins that are installed via npm. Including it would cause a TypeScript build error. It is safe to leave out.
- Everything else (server.url, scheme `Player Analysis`, appName `Player Analysis`, CameraPreview plugin) matches your provided config.

### What you need to do after the change
The `capacitor.config.ts` is read at native build/sync time, not at runtime. So after I save the file:

1. `git pull` your repo locally
2. `npm install` (just in case)
3. `npx cap sync ios`
4. Re-run the app from Xcode (or `npx cap run ios`)

Once that's done, the iOS app will load the live Lovable preview, which contains the `/capture/:token` route, and scanning either QR code will open the camera capture page correctly.

### Files
**Edit**
- `capacitor.config.ts` — restore `server.url`, `cleartext`, restore `appName` / `ios.scheme` to "Player Analysis"

**No backend, route, or component changes needed** — the capture flow itself is intact.

### Out of scope
- Universal Links setup so QR codes scanned by iOS Camera open in Safari instead of the Capacitor app (separate decision — current behaviour of opening in the app is fine once the app loads the live preview)
- Restoring `appName` to Capitalised "Player Analysis" anywhere else (only affects the iOS app shell name on the home screen)

