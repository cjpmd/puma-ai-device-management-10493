# Plan

## What I’ll fix
1. **Auto-load the match video when it exists** so the cinema player doesn’t open in a half-ready state with a separate hidden/manual load step.
2. **Block or hide playback controls until the video element has a real source and is ready** so users can’t click transport controls against an unloaded player shell.
3. **Add explicit media load/play error handling** so failed `play()` or bad media sources show a visible message instead of silently doing nothing.
4. **Re-verify the cinema controls against the loaded player state** so Play/Pause, seek, skip, mute, speed, and fullscreen only activate when the video is actually ready.

## Why this is the likely issue
- The match page is still rendering the cinema timeline and control surface even when the main video area is showing **Load Match Video**.
- That means the user can interact with a player UI before the underlying `<video>` has been loaded.
- The previous bubbling fix likely solved one problem, but only **after** a real video element is ready to play.

## Files to update
- `src/components/Matches/Cinema/CinemaVideoPlayer.tsx`
- `src/components/Matches/Cinema/VeoVideoControls.tsx`
- `src/components/Matches/Cinema/MatchCinemaLayout.tsx`

## Technical details
- Trigger `loadVideo()` automatically when `outputVideoPath` or `stitchedVideoPath` is present.
- Track media readiness with native video events like `loadedmetadata`, `canplay`, `play`, `pause`, and `error`.
- Use the `play()` promise result to catch and surface `NotAllowedError`, unsupported-source, or other media failures.
- Pass a `ready/loaded` state into `VeoVideoControls` so controls can be disabled or hidden until the video is actually playable.
- Keep the previous click-bubbling protection in place.

## Validation
- Confirm the match opens with the video loaded automatically when a URL is available.
- Confirm Play/Pause advances time and toggles icon state.
- Confirm skip, seek bar, event-jump, mute, speed, and fullscreen work only after readiness.
- Confirm a failed media source produces a visible error instead of a dead play button.