

## Plan — Native-only deep link QR capture (no web fallback)

### Problem
QR codes encode `https://…/capture/<token>` → iOS opens Safari. We need scanning to open the installed Capacitor app directly via custom URL scheme `playeranalysis://capture/<token>`. No `server.url`, no web fallback — fully native, offline-capable.

Current `capacitor.config.ts` is also broken: `appId: 'com.pumaai.devicemanagement,` has an unterminated quote and a stray `}` after the comment block. The file won't compile.

### Fix

**1. Repair `capacitor.config.ts` and register URL scheme**
```ts
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pumaai.devicemanagement",
  appName: "Player Analysis",
  webDir: "dist",
  ios: {
    contentInset: "always",
    scheme: "playeranalysis",
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
- Fix syntax (close the string, remove stray `}`).
- Keep `appId: "com.pumaai.devicemanagement"` to match what you've already built in Xcode (changing it forces a project rebuild).
- Remove `server.url` entirely — app loads from bundled `dist/`.
- Set `ios.scheme: "playeranalysis"` so Capacitor registers `playeranalysis://` as a URL Type on next `cap sync`.

**2. Change QR encoding — `src/components/Matches/CameraQRSetup.tsx`**
Replace:
```ts
const captureUrl = token ? `${window.location.origin}/capture/${token}` : null;
```
with:
```ts
const captureUrl = token ? `playeranalysis://capture/${token}` : null;
```
The "Copy Link" button copies the same `playeranalysis://…` URL.

**3. Add `@capacitor/app` deep link handler**
- Install `@capacitor/app`.
- New file `src/hooks/useDeepLinkHandler.ts`:
  ```ts
  import { useEffect } from "react";
  import { App } from "@capacitor/app";
  import { useNavigate } from "react-router-dom";

  export const useDeepLinkHandler = () => {
    const navigate = useNavigate();
    useEffect(() => {
      const sub = App.addListener("appUrlOpen", (event) => {
        const url = event.url;
        if (url.startsWith("playeranalysis://capture/")) {
          const token = url.split("capture/")[1];
          navigate(`/capture/${token}`);
        }
      });
      return () => { sub.then(s => s.remove()); };
    }, [navigate]);
  };
  ```
- Mount inside `App.tsx`. Because the hook calls `useNavigate()`, it must live **inside** `<BrowserRouter>`. Wrap the existing `<Routes>` block in a tiny `<AppShell>` component that calls `useDeepLinkHandler()` then renders `<Routes>…</Routes>` unchanged.

**4. Build production bundle**
Since we're removing `server.url`, the native app now loads `dist/`. The bundled assets must be current before each `cap sync`. No code change needed — just a reminder in the post-fix steps below.

### After the change — what you do locally
1. `git pull`
2. `npm install` (picks up `@capacitor/app`)
3. `npm run build` (produces fresh `dist/` since we no longer hot-load from a server URL)
4. `npx cap sync ios`
5. Open Xcode → confirm **Target → Info → URL Types** lists `playeranalysis` (Capacitor writes this from `ios.scheme` on sync).
6. `npx cap run ios` on both phones.
7. Master phone → generate QR → donor phone scans → iOS prompts "Open in Player Analysis?" → app opens on the capture screen.

### Files

**Edit**
- `capacitor.config.ts` — fix syntax, set `ios.scheme: "playeranalysis"`, ensure no `server.url`.
- `src/components/Matches/CameraQRSetup.tsx` — encode `playeranalysis://capture/<token>`.
- `src/App.tsx` — wrap `<Routes>` so `useDeepLinkHandler()` runs inside `<BrowserRouter>`.
- `package.json` — add `@capacitor/app`.

**New**
- `src/hooks/useDeepLinkHandler.ts` — listens for `appUrlOpen`, navigates to `/capture/:token`.

### Out of scope
- Universal Links / web fallback (explicitly not wanted).
- Android intent filter (iOS only for this pass).
- Role-based gating for QR generation (coach vs parent).

