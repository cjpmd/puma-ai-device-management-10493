

## Plan — Sync, navbar, status bar, Ultra fixes

### 1. Make "Sync" actually work + sync photos
**Problem:** the "Sync" label in Profile is just text — only the surrounding Glass div has an onClick, and it only syncs `user_access` (teams/clubs), not players/photos/attributes/events.

**Fix:**
- Turn the Sync action into a real tappable Glass button with clear states (`Syncing…`, success toast with counts, error toast).
- Run a **full sync** (`entity=all`) so we pull clubs → teams → players (with `photo_url`) → attributes → events → user_access in one go.
- Render `photo_url` in player avatars on Squad list + Squad detail (currently we only show initials). Fall back to initials when null.
- Add a tiny "Last synced 2 min ago" line under the Sync button so it's obvious it ran.

The sync function already maps `photo_url` from external `players.photo_url`, so no edge-function changes needed for images themselves — we just trigger the right entity and use the field in the UI.

### 2. Persistent bottom nav across all screens
The TabBar is already on every iOS shell screen, but legacy pages (`/analysis`, `/matches`, `/devices`, `/ml-training`, `/pitch-calibration`, `/match/:id`) have **no TabBar at all** — when the user taps "Open full Ultra analysis" they lose the nav.

**Fix:**
- Create `<MobileNavShell>` wrapper that renders any legacy page content above a fixed-position TabBar that routes back to the iOS shell tabs (Home → `/`, Squad → `/`, Matches → `/matches`, Ultra → `/analysis`, Profile → `/`).
- Wrap each legacy route in `App.tsx` with the shell so the bottom nav is always present.
- Add bottom padding (`paddingBottom: 100px`) to legacy page roots so content doesn't hide behind the TabBar.

### 3. Remove the iOS time/signal/wifi/battery row
**Fix:** delete the `<IOSStatusBar>` from all 6 iOS screens (HomeScreen, SquadScreen × 2, MatchesScreen, ProfileScreen, UltraScreen, FormationScreen) and add a small top spacer (`paddingTop: env(safe-area-inset-top)` so the notch is respected on the real device but no fake icons render). Keep the `StatusBar.tsx` file but stop using it.

### 4. Ultra Analysis (`/analysis`) page — three fixes
**a. Background:** page uses `wallpaper-aurora` ✓ but the Tabs/Cards inside still render with light `bg-card` defaults, so big white panels appear over the dark wallpaper (your screenshot 1). Fix by:
- Wrapping all top-level cards in `.glass` (semi-transparent dark glass on aurora)
- Setting Tabs list background to `bg-white/5 border border-white/10`
- Override MetricCard to dark variant when on aurora (text white, bg `bg-white/5`)

**b. Team auto-selection:** Analysis page has its own `ClubSelector` + `TeamSelector` requiring re-selection (your screenshot 2). Fix:
- Read `useActiveTeam()` on mount and pre-fill `selectedClubId` + `selectedTeamId` with the active team's `club_id` / `id`
- Hide the selectors behind a small "Change team" link if already set; show full selectors only if no active team

**c. Header tidy-up:** currently shows two stacked headers ("Performance Analysis" + "Data in sync with database" + Club/Team labels + 6 buttons in a row that wrap awkwardly). Consolidate into:
- Single page header: `Ultra Analysis` (h1) + small subtext `{teamName} · Live` (or session badge)
- Move Sync / Bluetooth / Share / Manage Devices / ML Training into a single overflow `…` Glass menu (icon-only on mobile, dropdown on tap)
- Keep the Live/Historical session selector visible (primary control)

### 5. Files

**Edit**
- `src/pages/ios/ProfileScreen.tsx` — full sync + last-synced label + remove status bar
- `src/pages/ios/HomeScreen.tsx`, `SquadScreen.tsx`, `MatchesScreen.tsx`, `UltraScreen.tsx`, `FormationScreen.tsx` — remove `<IOSStatusBar />`, add safe-area top spacer
- `src/pages/ios/SquadScreen.tsx` — render `photo_url` in player avatars (list + detail hero)
- `src/pages/Analysis.tsx` — auto-select active team, glass cards on dark wallpaper, consolidate header into overflow menu, fix card backgrounds
- `src/App.tsx` — wrap legacy routes in `MobileNavShell`

**New**
- `src/components/ios/MobileNavShell.tsx` — fixed bottom TabBar that maps tabs to legacy routes & back to `/` for shell tabs

**No backend / migration changes needed** — `photo_url` already exists and is already mapped by `sync-external-data`.

### Out of scope (next pass)
- Restyling individual MLTraining / Devices / MatchDetail cards on dark wallpaper (header + nav fixed first; deeper card audit follow-up)
- Pulling photo binaries into Supabase Storage (currently we use the external URL; only matters if Origin Sports hides them later)

