## Goal
Restore `/matches/bd76f2a1-cf46-46d4-81e4-3cf9738c6336` so it renders reliably instead of going blank.

## What I’ll change
1. Isolate the failing UI import path
- Remove the route’s dependency on the module chain that currently breaks preview boot (`src/components/ui/switch.tsx` is the failing fetch in the browser session).
- Inspect the pages/components importing that switch and replace the fragile import path with a safer equivalent if needed.

2. Make the match route resilient
- Add a route-local error boundary or guarded loading/fallback around the match detail stack so one downstream UI failure does not blank the whole app.
- Keep the existing missing-table fallbacks in the cinema components intact.

3. Validate in preview
- Reload the match route in preview.
- Confirm the page shell renders and that the blank white screen is gone.
- Re-check browser console/network to ensure the failing module request no longer blocks app boot.

## Technical notes
- Current signal: browser preview shows a white screen and reports a failed script load for `src/components/ui/switch.tsx` with `net::ERR_ABORTED` / 502.
- The local dev server can serve that file, so this looks like a preview transform/module-loading issue rather than MatchDetail business logic itself.
- I’ll keep the fix scoped to the frontend and avoid backend changes unless a second, concrete error appears after the app can render again.