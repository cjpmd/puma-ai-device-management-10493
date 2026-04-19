
## iOS / Capacitor status + Match-day mobile optimisation

### Current state
- **Capacitor packages installed** (`@capacitor/core`, `cli`, `ios`, `device`, `filesystem`, `camera-preview`) and `capacitor.config.ts` is configured with the right appId, hot-reload URL, iOS scheme, CameraPreview audio enabled.
- **No `/ios` folder yet** — the native Xcode project hasn't been generated. That's a one-time local step (`npx cap add ios`) that has to be done outside Lovable, on a Mac with Xcode.
- **Viewport meta tag** already present in `index.html`, but missing iOS-specific tags (safe-area, web-app-capable, status bar style).
- **Match-day screens** (`Matches.tsx` list, `MatchDetail.tsx` setup, `CameraQRSetup.tsx`, `RecordingControls.tsx`, `CameraCapture.tsx` guest page) use `md:` breakpoints but several layouts are not optimised for narrow iPhone widths (390px and below):
  - `Matches.tsx` header has Sync + Create buttons that wrap awkwardly on mobile.
  - `MatchDetail.tsx` developer controls and dev cards still showing in production view.
  - `RecordingControls.tsx` uses `grid-cols-2` for camera previews — fine at 390px but `gap-4` + battery/storage rows can overflow.
  - Camera QR card QR is fixed `size={180}` — fine, but Copy/Regenerate buttons stack OK.
  - Buttons in headers don't use a hamburger pattern; horizontal scroll possible if labels are long.
  - No `safe-area-inset` padding so iPhone notch / home indicator can clip content.

---

### Plan

**1. Confirm iOS readiness (no code changes — instructions for you)**
Add a short README section describing the Mac-side steps once and direct the user there:
```
git pull → npm install → npx cap add ios → npm run build → npx cap sync → npx cap run ios
```
Tell user nothing more to install in Lovable — Capacitor is already wired.

**2. Add iOS-friendly meta + safe-area support**
- `index.html`: add `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, theme-color, proper title.
- `src/index.css`: add `env(safe-area-inset-*)` utility classes (`.safe-top`, `.safe-bottom`, `.safe-x`).

**3. Rename "Match Analysis" → "Match Day"**
The screens in question are about *setting up* and *running* a match day, not analysing one. Rename:
- `Matches.tsx` page header: "Match Analysis" → **"Match Day"**
- Sidebar / `Index.tsx` link label: same rename
- Keep route `/matches` (no breaking changes)

**4. Mobile-optimise the match-day setup screens**

| Screen | Fix |
|---|---|
| `Matches.tsx` | Stack header vertically on `<sm` (title row, then action buttons full-width). Make "Sync Events" / "Create Match" icons-only on mobile with sr-only labels. Add `safe-top` to the page. |
| `MatchDetail.tsx` | Stack header (back + title on row 1, status badge + actions on row 2). Reduce horizontal padding on mobile (`p-3 md:p-8`). Hide Developer Controls behind a collapsible. Add safe-area padding. |
| `CameraQRSetup.tsx` | Already mostly fine — shrink QR to `min(180, calc(100vw - 96px))` so it never overflows; tighten card padding on mobile. |
| `RecordingControls.tsx` | Switch camera preview grid to `grid-cols-1 sm:grid-cols-2` on very narrow screens, OR keep 2 cols but reduce gap/padding so battery+storage rows fit. Make Start/Stop button sticky-bottom on mobile so it's always reachable while previews scroll. |
| `CameraCapture.tsx` | Already mobile-first (uses `max-w-sm`). Add safe-area padding top/bottom and keep Upload button visible above home-indicator. |

**5. Tap-target & no-horizontal-scroll guarantees**
- Audit every `Button` in those screens to ensure `min-h-11` (44px Apple tap target).
- Add `overflow-x-hidden` on page roots; replace any fixed-width inner content with `w-full max-w-*` patterns.
- Use `truncate` on long match titles and team names.

---

### Files to change
- `index.html` — iOS meta tags
- `src/index.css` — safe-area utilities
- `src/pages/Matches.tsx` — rename + mobile header
- `src/pages/MatchDetail.tsx` — mobile header, padding, collapse dev controls
- `src/pages/CameraCapture.tsx` — safe-area padding
- `src/pages/Index.tsx` — sidebar label rename (verify)
- `src/components/Matches/RecordingControls.tsx` — sticky bottom button, tighter mobile layout
- `src/components/Matches/CameraQRSetup.tsx` — responsive QR sizing

### Out of scope (can do next)
- Splash screen + app icons (`@capacitor/splash-screen`, `@capacitor/status-bar`) — recommend after first `npx cap add ios`.
- Full PWA fallback (vite-plugin-pwa) if you want non-native install on Android.
