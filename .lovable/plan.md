## Problem

The web dashboard (`AppShell`) renders pages on a **light** background (`bg-slate-50`, white `TopBar`, light `PageHeader` with `text-slate-900`). Most dashboard pages (Dashboard, Players, Medical, Welfare, Scouting, PlayerProfile) correctly use slate text on white cards.

Two recently added pages were written assuming a dark wallpaper and are unreadable inside the light shell:

- **`src/pages/Compliance.tsx`** — ~30 occurrences of `text-white`, `bg-white/5`, `border-white/10`, `text-white/40`, etc.
- **`src/pages/Settings.tsx`** — ~35 occurrences of the same dark-mode classes (white text, `bg-white/5` cards, `text-white/50` labels, dark inputs).

The result: white text and faint white-alpha card outlines on the light slate-50 page background — invisible.

All other dashboard pages already follow the light scheme correctly. The shell, sidebar, TopBar and PageHeader are also fine. No global theming change is needed.

## Fix

Reskin **only** `Compliance.tsx` and `Settings.tsx` to match the existing light dashboard convention used by `Dashboard.tsx` / `Players.tsx` / `Medical.tsx`:

| Was (dark)                            | Becomes (light)                                   |
| ------------------------------------- | ------------------------------------------------- |
| `bg-white/5` card                     | `bg-white border border-slate-200 rounded-2xl shadow-sm` |
| `text-white`                          | `text-slate-900`                                  |
| `text-white/70` / `text-white/60`     | `text-slate-600`                                  |
| `text-white/50` / `text-white/40`     | `text-slate-500` / `text-slate-400`               |
| `border-white/10`                     | `border-slate-200`                                |
| `bg-white/5` input + `border-white/10`| `bg-white border-slate-300 text-slate-900`        |
| `hover:bg-white/10`                   | `hover:bg-slate-100`                              |
| Inactive tab `text-white/50 hover:text-white hover:bg-white/10` | `text-slate-500 hover:text-slate-900 hover:bg-slate-100` |
| Active tab keeps `bg-violet-600 text-white` | unchanged                                    |
| Status pill `text-white/40` ("Not recorded") | `text-slate-400`                            |

Both files keep their existing structure, queries, tabs, EPPP logic, audit log, expiry badges and form behaviour — purely a color/border swap. Buttons that already use `bg-violet-600 text-white` stay as-is (correct contrast on light bg).

## Out of scope

- Sidebar, TopBar, PageHeader, AppShell — already correct.
- Dashboard, Players, PlayerProfile, Medical, Welfare, Scouting — already on the light scheme; their few `text-white` instances are on violet buttons (correct).
- The `MobileNavShell`-wrapped routes (Analysis, Devices, Matches, MyRecordings, etc.) intentionally use the dark `wallpaper-twilight` theme — no change.
- Public/auth/capture pages — unchanged.

## Files touched

- `src/pages/Compliance.tsx`
- `src/pages/Settings.tsx`
