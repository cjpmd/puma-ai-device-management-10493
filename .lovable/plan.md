# Apply light design scheme to all AppShell pages

## Problem

The web dashboard shell (`AppShell`) uses a light background (`bg-slate-50`), but several pages and shared components inside it still use dark-theme Tailwind classes (`text-white`, `bg-white/5`, `border-white/10`, `bg-slate-900`, `hover:bg-white/10`, `placeholder-white/*`). This produces light text on a light background and unreadable controls.

The iOS / `MobileNavShell` routes (Matches, Analysis, Devices, ML Training, Match Detail, Pitch Calibration, Camera Capture, ScanQR, MyRecordings, IOSApp) are intentionally dark and will be left alone. Same for `Auth`, `SharedVideo`, `NotFound`, `Index`.

## Files to reskin (AppShell pages + their shared components)

Pages:
- `src/pages/Medical.tsx`
- `src/pages/Welfare.tsx`
- `src/pages/Scouting.tsx`
- `src/pages/FitnessTesting.tsx`
- `src/pages/PlayerProfile.tsx` (largest — ~81 occurrences)
- `src/pages/LogRPE.tsx` (standalone token route, currently dark — switch to light to match new scheme)

Shared components used by those pages:
- `src/components/medical/InjuryLogModal.tsx`
- `src/components/fitness/FitnessTestModal.tsx`
- `src/components/players/AttributeSnapshotModal.tsx`
- `src/components/players/MaturationCalculator.tsx`
- `src/components/MetricCard.tsx`
- `src/components/PerformanceChart.tsx`

Out of scope (intentionally dark, inside `MobileNavShell` or full-screen capture/video UI):
- All `src/pages/ios/*`, `Matches.tsx`, `MatchDetail.tsx`, `Analysis.tsx`, `Devices.tsx`, `MLTraining.tsx`, `PitchCalibration.tsx`, `CameraCapture.tsx`, `ScanQR.tsx`, `MyRecordings.tsx`, `Auth.tsx`, `Index.tsx`, `NotFound.tsx`, `Dashboard.tsx` (already light)
- All `src/components/Matches/**`, `src/components/Analysis/**`, `src/components/MLTraining/**`, `src/components/VideoAnalysis/**`, `src/components/Devices/**`, `src/components/PitchCalibration/**`, `src/components/ios/**`, `Sidebar.tsx` (sidebar is intentionally its own dark slab)

## Class swap rules (technical)

Apply the same mapping already used for Compliance/Settings:

| Dark                                    | Light                                                       |
| --------------------------------------- | ----------------------------------------------------------- |
| `bg-slate-900` (modal panel)            | `bg-white`                                                  |
| `bg-white/5` (card / input)             | `bg-white border border-slate-200`                          |
| `bg-white/10` / `hover:bg-white/10`     | `bg-slate-100` / `hover:bg-slate-100`                       |
| `bg-white/20` / `hover:bg-white/20`     | `bg-slate-200` / `hover:bg-slate-200`                       |
| `border-white/10` / `border-white/5`    | `border-slate-200`                                          |
| `border-white/30`                       | `border-slate-300`                                          |
| `divide-white/5` / `divide-white/10`    | `divide-slate-200`                                          |
| `text-white` (plain text, not on colored btn) | `text-slate-900`                                      |
| `text-white/80` / `text-white/70`       | `text-slate-700` / `text-slate-600`                         |
| `text-white/60` / `text-white/50`       | `text-slate-600` / `text-slate-500`                         |
| `text-white/40` / `text-white/30`       | `text-slate-400`                                            |
| `text-slate-400` (labels)               | keep (`text-slate-500` works on white too — keep as is)     |
| `text-slate-500` (muted)                | keep                                                        |
| `hover:text-white`                      | `hover:text-slate-900`                                      |
| `placeholder-white/30` / `/40`          | `placeholder-slate-400`                                     |

Preserve `text-white` when it sits on a colored button background (`bg-violet-*`, `bg-emerald-*`, `bg-rose-*`, `bg-red-*`, `bg-amber-*`, `bg-indigo-*`, `bg-blue-*`, `bg-sky-*`). Tinted status pills like `bg-emerald-500/20 text-emerald-400` stay — they read fine on white.

For modal overlays, keep `bg-black/60` backdrop, change inner panel from `bg-slate-900 border-white/10` to `bg-white border border-slate-200 shadow-xl`.

## Approach

Use a Python script to apply ordered regex substitutions per file (longer/more specific patterns first to avoid double-replacement), then a manual review of `PlayerProfile.tsx` since it's the largest and may have nuanced cases (charts, status pills). After substitution, grep each file to confirm zero remaining `text-white\b`, `bg-white/`, `border-white/`, `hover:bg-white/`, `placeholder-white/`, `bg-slate-900` (outside colored-button contexts).

## Verification

1. `rg "text-white\b|bg-white/[0-9]|border-white/[0-9]|placeholder-white|hover:bg-white/[0-9]"` across the touched files returns only matches inside `className` strings on colored backgrounds.
2. Open `/medical`, `/welfare`, `/scouting`, `/fitness-testing`, `/players/:id`, `/compliance`, `/settings` in the preview and confirm legibility.
3. Open the Log Injury, Fitness Test, and Attribute Snapshot modals and confirm form fields render with dark text on white inputs.
