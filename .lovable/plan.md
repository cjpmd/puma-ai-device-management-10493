

## Two things to fix

### A. Build errors in edge functions
14 TS errors in 8 edge functions. Two categories, both pre-existing (not caused by rebrand) but blocking the build now:

1. **`error.message` on `unknown`** (8 files) — Deno's stricter TS now requires narrowing `catch (error)`. Fix: cast as `error instanceof Error ? error.message : String(error)`.
2. **`Uint8Array`/`Buffer` type mismatches in AWS SigV4 signing** (`generate-upload-url`, `get-output-url`, `runpod-webhook`) — caused by ambient Node types leaking in. Fix:
   - For `crypto.subtle.importKey("raw", key, …)`: cast `key` to `BufferSource` (`key as BufferSource`) or use `key.buffer as ArrayBuffer`.
   - In `runpod-webhook`, the file uses Node's `createHmac` which returns `Buffer`. Replace that whole helper with the pure-WebCrypto version already used in `generate-upload-url` (the `hmacSha256` + `getSignatureKey` pattern) so we drop the Node crypto import entirely.

### B. Apply Origin Sports design scheme to all pages
The new purple/glass design is only on the iOS shell (`/`). Every other route is still on legacy emerald/green/gray backgrounds. Fix each page root to use the wallpaper + dark surface tokens.

| Page | Current | New |
|---|---|---|
| `Matches.tsx` | `bg-gradient-to-b from-emerald-50 to-green-50` | `wallpaper-dawn` + dark text |
| `MatchDetail.tsx` | same emerald | `wallpaper-twilight` |
| `Analysis.tsx` | `bg-gray-50` | `wallpaper-aurora` |
| `MLTraining.tsx` | `bg-gray-50` | `wallpaper-dawn` |
| `Devices.tsx` | `bg-background` | `wallpaper-twilight` |
| `PitchCalibration.tsx` | `bg-background` | `wallpaper-twilight` |
| `Auth.tsx` | emerald gradient + emerald buttons | `wallpaper-dawn`, purple primary buttons, glass card |
| `CameraCapture.tsx` | `bg-background` | `wallpaper-twilight` (keep mobile layout) |
| `NotFound.tsx` | `bg-gray-100` | `wallpaper-dawn` |
| `Index.tsx` (legacy `/legacy` route) | emerald gradient + emerald cards | `wallpaper-dawn` + glass cards, purple icons |

Also:
- Switch any remaining `text-emerald-*` / `text-green-*` / hard-coded `text-gray-*` headings on those pages to `text-white` / `text-white/70`.
- Card backgrounds on dark wallpapers: replace `bg-white` with `glass` utility (already defined in `index.css`) or `bg-card` (which is dark-purple via the existing tokens).
- Auth page: replace `bg-emerald-600` button colors with the default Button (which uses purple primary).

### Files to edit
**Edge functions (build fix):**
- `supabase/functions/confirm-guest-upload/index.ts`
- `supabase/functions/generate-camera-token/index.ts`
- `supabase/functions/generate-upload-url/index.ts`
- `supabase/functions/get-output-url/index.ts`
- `supabase/functions/runpod-webhook/index.ts` (bigger rewrite of signing helper)
- `supabase/functions/trigger-processing/index.ts`
- `supabase/functions/validate-camera-token/index.ts`

**Pages (rebrand backgrounds):**
- `src/pages/Matches.tsx`
- `src/pages/MatchDetail.tsx`
- `src/pages/Analysis.tsx`
- `src/pages/MLTraining.tsx`
- `src/pages/Devices.tsx`
- `src/pages/PitchCalibration.tsx`
- `src/pages/Auth.tsx`
- `src/pages/CameraCapture.tsx`
- `src/pages/NotFound.tsx`
- `src/pages/Index.tsx`

### Out of scope (call out next)
- Restyling individual cards/buttons inside MLTraining tabs, Analysis charts, Device manager — these have many legacy emerald accents in deeply nested components. Worth a follow-up pass once the page shells are correct.
- Updating chart colors (recharts) to purple palette.

