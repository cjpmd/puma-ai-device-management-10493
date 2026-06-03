## Goal
Deploy the two edge functions Claude Code already edited (`process-video` and `analysis-callback`) so the RunPod → Supabase webhook chain works end-to-end.

## Current state (verified in codebase)
- `supabase/functions/process-video/index.ts` — already appends `?apikey=${EXTERNAL_SUPABASE_ANON_KEY}` to the webhook URL and stores RunPod id in both `runpod_job_id` and `analysis_job_id`. ✅
- `supabase/functions/analysis-callback/index.ts` — already looks up by `runpod_job_id`, sets status to `'completed'`, and reads RunPod payload `{id, status, output}`. ✅
- `supabase/config.toml` — already has `[functions.analysis-callback] verify_jwt = false`. ✅
- Secret `EXTERNAL_SUPABASE_ANON_KEY` — already present in Supabase secrets. ✅

So nothing in the repo needs to change — only deployment is outstanding.

## Plan
1. Deploy both edge functions from Lovable (no CLI / personal access token needed) using the `supabase--deploy_edge_functions` tool:
   - `process-video`
   - `analysis-callback`
2. Tail recent logs for each function with `supabase--edge_function_logs` to confirm they booted cleanly.
3. Report back so you can trigger a fresh RunPod job and we can watch `analysis-callback` fire.

## Out of scope
- No code edits to either function (Claude Code's changes are already on `main` and match what's needed).
- No secret changes — `EXTERNAL_SUPABASE_ANON_KEY` is already configured.
- No DB migrations.
