## Add Academy section to iOS Home

When the active context is an academy, show a new "Academy" section on the iOS HomeScreen with tap-through links to each academy page.

### Where
`src/pages/ios/HomeScreen.tsx` — insert a new `<SectionHeader title="Academy" />` block, rendered only when `activeContext?.kind === 'academy'`. Placement: between the existing "Squad" section and "Today" rings (high in the scroll, below Next event / QR scan).

### Links (route → label → icon)
Using `lucide-react` icons already used elsewhere:
- `/squads`       — Squads        — `Users`
- `/development`  — Development   — `TrendingUp`
- `/welfare`      — Welfare       — `HeartPulse`
- `/scouting`     — Scouting      — `Search`
- `/coaching`     — Coaching      — `ClipboardList`
- `/compliance`   — Compliance    — `ShieldCheck`
- `/travel`       — Travel & Events — `Plane`

### Layout
2-column grid of `Glass r={20}` tiles matching the existing Quick Actions style (icon chip + title + subtitle, `onClick={() => navigate(route)}`). Reuse `T` tokens / `tType` typography. No new design tokens.

### Gating
- Render the whole section only when `activeContext?.kind === 'academy'`.
- Routes are already protected by `<TierRoute kind="academy">` in `App.tsx`, so no extra guard needed.

### Out of scope
- No changes to TabBar, ProfileScreen, routing, or backend.
- Quick Actions section stays as-is.
