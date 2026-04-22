

## Plan — Force the iOS app to load the latest bundle

### Diagnosis (confirmed by the screenshot)
- iPhone screenshot shows the **old HomeScreen layout** — no Scan Camera QR tile, no build stamp under it. Both were added in the same commit, and both render correctly in the desktop preview.
- That means: the JS/HTML bundle inside the installed `.ipa` is stale. It hasn't been replaced since before those edits. So the issue isn't React/runtime — it's that `ios/App/App/public/` on disk still contains an old `index.html` + old hashed JS chunk.
- Most common causes (in order of likelihood):
  1. `ios/App/App/public/` was added to `.gitignore` long ago and `npx cap sync` is silently writing to a path that the Xcode project doesn't actually bundle (rare, but worth checking).
  2. The Xcode project is being archived/run from a **derived data cache** that still has the old `public/` baked in. Xcode "Clean Build Folder" empties Derived Data for code, but the `public/` folder inside the App target is treated as a *folder reference* and is re-copied from disk on every build — so if the on-disk `public/` is fresh, the device should get it. If the device still shows the old version, the on-disk `public/` is itself stale.
  3. The local `git pull` is pulling from the wrong branch / hasn't pulled the latest commits.

### What we'll add to make this self-diagnosing

**1. A loud, impossible-to-miss build banner (not a 4‑pixel grey caption)**

Edit `src/pages/ios/HomeScreen.tsx` — replace the current tiny stamp with a **bright purple chip pinned to the top-right of the header**, plus a Vite-defined constant so we know the value is baked in at build time, not produced at runtime in the browser:

```tsx
// near the top
const BUILD_STAMP = (import.meta as any).env.VITE_BUILD_STAMP
  ?? new Date().toISOString().slice(0,16);

// inside the header, next to the avatar
<div style={{
  position: 'fixed', top: 6, right: 6, zIndex: 100,
  background: '#a855f7', color: '#fff',
  padding: '3px 8px', borderRadius: 8,
  fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
  letterSpacing: 0.5,
}}>
  v {BUILD_STAMP}
</div>
```

`position: fixed` + `zIndex: 100` ensures it cannot be hidden by the iOS safe area, IOSStatusBar, or scroll containers.

**2. Inject the stamp at build time so the value is unambiguous**

Edit `vite.config.ts` to define `VITE_BUILD_STAMP` from `process.env` or fall back to current time at build:

```ts
export default defineConfig(({ mode }) => ({
  // ...
  define: {
    'import.meta.env.VITE_BUILD_STAMP': JSON.stringify(
      process.env.VITE_BUILD_STAMP ?? new Date().toISOString().replace('T',' ').slice(0,16)
    ),
  },
}));
```

That way, every `npm run build` bakes the build moment into the JS bundle as a string literal. There's no React render-time guessing — the stamp on the phone is the timestamp of the bundle, full stop.

### What you do locally — exact, no-skip sequence

Run these one at a time and watch the output of each:

1. `git pull` → expect to see commits referencing "Scan Camera QR" / build stamp landing.
2. `git log -1 --name-only` → confirm `src/pages/ios/HomeScreen.tsx` and `vite.config.ts` are in the latest commit.
3. `rm -rf dist node_modules/.vite ios/App/App/public ios/App/App/public.bak` (extra safe wipe).
4. `npm install`
5. `npm run build` → at the end you'll see `dist/` rebuilt. Confirm `ls dist/index.html` works.
6. `grep -c "Scan Camera QR" dist/assets/*.js` → must return ≥ 1. If it returns 0, the source on disk is stale (your `git pull` didn't actually update the file — check `git status` and `git branch`).
7. `npx cap sync ios` → look for a line `√ copy ios in N.NNs` — that's the step writing into `ios/App/App/public/`.
8. `grep -c "Scan Camera QR" ios/App/App/public/assets/*.js` → must return ≥ 1. If 0 here but ≥ 1 in step 6, Capacitor isn't copying — re-run `npx cap copy ios` directly.
9. In Xcode: **Product → Clean Build Folder** (Shift+Cmd+K), then **uninstall the app from the iPhone** (long-press the icon → Remove App → Delete App). This forces a fresh install with no leftover WebKit cache.
10. **Run** on device.
11. Top-right corner of the home screen should now show a purple `v 2026-04-22 …` chip, AND the Scan Camera QR tile should be visible just below the next-event hero.

### If after step 11 the chip is **still** missing
The on-device bundle is definitely stale and the only remaining culprit is the Xcode project itself not pointing at `ios/App/App/public/`. In that case open `ios/App/App.xcodeproj` → click the `App` folder in the navigator → check that `public` shows as a **blue folder** (folder reference) and is in **Build Phases → Copy Bundle Resources**. If it isn't, we'll need to re-add it — send back a screenshot of Build Phases and I'll walk you through it.

### Files

**Edit**
- `src/pages/ios/HomeScreen.tsx` — replace tiny grey caption with a fixed-position purple build chip using `import.meta.env.VITE_BUILD_STAMP`.
- `vite.config.ts` — `define` block to bake `VITE_BUILD_STAMP` into the bundle at build time.

### Out of scope
- Re-introducing `server.url` for live reload (you've explicitly ruled it out).
- Universal Links.

