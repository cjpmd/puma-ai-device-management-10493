## Plan — Restore preview by fixing the actual import/build errors

### What is actually breaking preview
The preview is failing because Vite cannot finish dependency scanning. I found two concrete code issues in the latest build log:

1. `src/pages/Compliance.tsx` imports `../lib/supabaseClient`, but that file does not exist in this project.
2. `src/pages/Settings.tsx` does the same.
3. Both pages also import `PageHeader` as a default export, but `src/components/layout/PageHeader.tsx` only exports a named `PageHeader`.

These errors are enough to keep preview stuck on:
`Preview has not been built yet. Either your project has an error or the preview is currently being built.`

### What I’ll change
- Update `src/pages/Compliance.tsx`
  - replace the missing Supabase import with the project’s real client import:
    `@/integrations/supabase/client`
  - switch `PageHeader` import to named import
- Update `src/pages/Settings.tsx`
  - replace the missing Supabase import with the project’s real client import
  - switch `PageHeader` import to named import
- Re-check for any other stale `../lib/supabaseClient` references or default `PageHeader` imports that would keep preview failing
- Verify the preview/server log is clean after the fixes

### Technical notes
- This is separate from the earlier `@capacitor/network` issue.
- I also found `@capacitor/network@8` still present in `package.json` while the app is on Capacitor 7, but that is not the current preview blocker shown in the latest log.
- If no other errors appear after the import fixes, preview should recover immediately.

### Expected outcome
- Preview builds again
- Root route loads instead of the build placeholder
- The recording/upload work can be debugged in the UI after the app is buildable again