# Fix blank UI screens after sign-in

## What’s likely happening
The signed-in app depends on `ActiveContextProvider`, and `useActiveContextData()` currently does all of its loading in one async flow with no `try/catch/finally` and no per-query error handling.

If any of these queries fail or return an unexpected shape:
- `profiles`
- `user_team_access -> teams!inner(...)`
- `user_club_access -> clubs!inner(...)`
- `user_academies -> academies!inner(...)`
- follow-up `clubs` reverse lookup by `academy_id`

then `loading` can stay `true` forever or the provider can end up with no usable context. Because that provider wraps the whole app, the result is an apparently blank signed-in UI.

## Plan

### 1. Make active-context loading fail-safe
Update `src/hooks/useActiveContext.ts` so context loading can never strand the app in a blank state:
- Wrap `load()` in `try/catch/finally`
- Always call `setLoading(false)` in `finally`
- Check and handle `error` from each Supabase query instead of assuming `.data` exists
- Add safe defaults for failed queries (`[]`) so one broken membership source does not blank the whole app
- Log the specific failing query to the console for future debugging

### 2. Simplify the academy lookup path
Reduce risk from nested relation queries in `useActiveContext.ts`:
- Keep the academy membership fetch, but avoid relying on fragile nested response shapes
- Resolve academy labels and owning clubs from plain follow-up queries when needed
- Build contexts only from validated data (`id`, `kind`, `clubId`, `label`)
- If academy resolution fails, still return club/team contexts so the UI remains usable

### 3. Add explicit no-context fallbacks in signed-in screens
Prevent signed-in routes from rendering “nothing” when there is no active context:
- `src/pages/ios/HomeScreen.tsx`
- `src/pages/ios/SquadScreen.tsx`
- `src/pages/ios/UltraScreen.tsx`
- any route guards relying on `useActiveContext()`

Behavior:
- If context is still loading: show a visible loading state
- If loading is finished but no contexts are available: show a clear empty state like “No club/team access found” instead of a blank screen
- Avoid silent redirects/empty render paths when `activeContext` is null

### 4. Verify the Dundee FC academy path still works
After hardening the loader, verify that:
- Dundee FC Academy appears as a valid academy context
- Home shows academy-only navigation when academy context is selected
- Ultra follows the same selected context
- Non-academy contexts still render normally

## Technical details
Files expected to change:
- `src/hooks/useActiveContext.ts`
- `src/App.tsx`
- `src/pages/ios/HomeScreen.tsx`
- `src/pages/ios/UltraScreen.tsx`
- possibly `src/pages/ios/SquadScreen.tsx` if it still has a silent null-context render path

Main implementation rule:
- The signed-in app must never depend on a single fragile async query chain to render anything. If academy lookup fails, the app should degrade to club/team context instead of going blank.