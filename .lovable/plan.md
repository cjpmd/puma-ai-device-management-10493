
The user wants Veo-style video player controls and an inline event-dot progress bar. Looking at the screenshot:

**Bottom control bar (left to right):**
- Play/Pause
- Previous clip / Next clip (skip to prev/next event)
- Back 5s / Forward 5s
- Time display (current / total) — center
- "Interactive player" toggle (the move/arrows icon)
- Playback speed (gauge icon)
- Settings (gear)
- Volume / mute
- Fullscreen

**Above progress bar:**
- Color-coded event dots positioned by time
- Hover/click shows label ("Shot on goal") + timestamp tooltip
- Click dot → seek to event

Current state — `CinemaVideoPlayer.tsx` likely uses the native `<video controls>` attribute (default browser controls). I need to confirm this.
