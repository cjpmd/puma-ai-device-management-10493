

## Plan — Make QR codes scannable by iOS Camera (in‑app QR scanner)

### Why "No usable data found" appears
The QR currently encodes `playeranalysis://capture/<token>`. iOS Camera (and most third‑party scanners) deliberately refuse to surface custom URL schemes — only `http(s)` URLs and a small allow‑list (mailto:, tel:, geo:) get a tappable banner. The QR data is fine; iOS is just ignoring custom schemes for security.

We have two ways to fix this without going back to a hosted web page:

- **Option A (recommended for testing now): in‑app QR scanner.** The donor phone opens the installed Player Analysis app, taps "Scan QR", points it at the master phone, and the app jumps straight to `/capture/:token`. No iOS Camera involvement, no Universal Links, fully native, fully offline-capable.
- **Option B (later, for production "scan with iOS Camera" UX): Universal Links** — needs an Apple Team ID + a hosted `apple-app-site-association` file. You explicitly said this is out of scope for this phase, so we're not doing it now.

This plan implements Option A, plus keeps the deep link working so that *if someone does get the URL another way* (iMessage, AirDrop, Notes), tapping it still opens the app.

### Fix

**1. Add an in‑app QR scanner using the existing camera plugin**
- Install `@capacitor-mlkit/barcode-scanning` (Capacitor's official barcode scanner; fully native, works offline, no API keys).
- New page `src/pages/ScanQR.tsx`:
  - Full‑screen camera preview with a centred reticle + "Cancel" button.
  - On scan, if the value starts with `playeranalysis://capture/`, extract the token and `navigate('/capture/<token>')`.
  - If it starts with `https://…/capture/<token>` (back‑compat for old QRs already generated), strip and route the same way.
  - Otherwise show a toast "Not a valid camera QR".
- Route: add `<Route path="/scan-qr" element={<ScanQR />} />` in `App.tsx`.

**2. Add a "Scan QR" entry point on the donor phone**
- On the iOS home screen (`src/pages/ios/HomeScreen.tsx`), add a prominent "Scan Camera QR" tile/button → navigates to `/scan-qr`.
- Also add a small "Scan QR" link on the Match Day Setup screen for convenience.

**3. Keep the QR generator producing the deep link, but make the human‑readable label clear**
- `src/components/Matches/CameraQRSetup.tsx`: keep `playeranalysis://capture/<token>` as the QR payload (the in‑app scanner handles it perfectly).
- Replace the helper text under the QR with: *"Open Player Analysis on the donor phone → tap **Scan QR** → point at this code."* So the user knows not to use the iOS Camera app.
- Remove the "Copy Link" button's "Share via iMessage or WhatsApp" wording — that path won't work for non‑installed phones and we said no web fallback. Replace with "Copy deep link" (still useful for AirDrop/Notes paste on a phone that already has the app).

### Files

**Edit**
- `src/App.tsx` — register `/scan-qr` route.
- `src/components/Matches/CameraQRSetup.tsx` — update helper copy + button label.
- `src/pages/ios/HomeScreen.tsx` — add "Scan Camera QR" tile.
- `package.json` — add `@capacitor-mlkit/barcode-scanning`.

**New**
- `src/pages/ScanQR.tsx` — native QR scanner page using `@capacitor-mlkit/barcode-scanning`, parses `playeranalysis://capture/<token>` and navigates.

### After the change — what you do locally
1. `git pull`
2. `npm install` (picks up `@capacitor-mlkit/barcode-scanning`)
3. `npm run build`
4. `npx cap sync ios`
5. Re‑deploy to both phones via Xcode.
6. Master phone → generate QR. Donor phone → open Player Analysis → tap **Scan Camera QR** → point at the master phone. App jumps to `/capture/<token>`.

### Out of scope
- Universal Links (later, when moving past testing).
- Android scanner UI (iOS only this pass).
- Role‑gating who can see the "Scan QR" tile (coach vs parent) — surface for everyone for now.

