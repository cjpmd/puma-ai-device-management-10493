

## Plan — Fix the black screen over the QR scanner camera feed

### Root cause
`@capacitor-mlkit/barcode-scanning` renders the camera **behind** the WebView at the native layer. The WebView and every wrapping element must be transparent during the scan. Right now `html`, `body`, `#root`, and the iOS shell all have solid dark backgrounds, so the camera draws into a region that's completely covered. The class `barcode-scanner-active` is being toggled in `ScanQR.tsx` but there's no matching CSS rule, so nothing actually goes transparent.

### Fix

**1. `src/index.css` — add a global "scanner active" mode that strips backgrounds**

Add to the bottom of the file:

```css
/* When the native barcode scanner is running, the WebView must be transparent
   so the camera preview (rendered at the native layer behind it) is visible. */
body.barcode-scanner-active {
  background: transparent !important;
  visibility: hidden;
}
body.barcode-scanner-active .barcode-scanner-ui {
  visibility: visible;
}
body.barcode-scanner-active,
body.barcode-scanner-active #root,
body.barcode-scanner-active .ios-app-shell {
  background: transparent !important;
}
html.barcode-scanner-active {
  background: transparent !important;
}
```

The `visibility: hidden` + selective `visible` trick is the official MLKit pattern: it hides every page element except those we explicitly opt back in (the reticle + cancel button), so nothing accidentally paints over the camera. We then opt the scanner UI back in via the `.barcode-scanner-ui` class.

**2. `src/pages/ScanQR.tsx` — apply the class to `<html>` too, mark the overlay as scanner UI**

- When entering the scanner, also add `barcode-scanner-active` to `document.documentElement` (the `<html>` tag), and add it to the body — both, because both are painted by the WebView.
- Tag the visible overlay (`<div className="fixed inset-0 …">`) with an extra class `barcode-scanner-ui` so the CSS rule above keeps it visible.
- On unmount/cancel, remove both classes.

**3. `src/pages/ios/IOSApp.tsx` — give the iOS shell wrapper a known class**

Add `className="ios-app-shell"` to the outermost div of the iOS app shell so the CSS in step 1 can target and transparent-ize it during scanning. (This is a one-attribute addition.)

### Files

**Edit**
- `src/index.css` — add `.barcode-scanner-active` rules (transparency + visibility opt-in pattern).
- `src/pages/ScanQR.tsx` — toggle the class on both `<html>` and `<body>`; tag the overlay with `barcode-scanner-ui`.
- `src/pages/ios/IOSApp.tsx` — add `ios-app-shell` class to the root wrapper so it becomes transparent when scanning.

### After the change — what you do locally
1. `git pull && npm run build && npx cap sync ios`
2. Re-run on the device from Xcode (no need to uninstall this time, but Clean Build Folder once for safety).
3. Tap **Scan Camera QR** → you should now see the live camera feed with the purple reticle floating over it and the Cancel button at the bottom.

### Out of scope
- Replacing MLKit with a different scanner (current one is correct and offline-capable).
- Re-styling the reticle.

