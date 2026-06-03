## Deploy edge functions

No Supabase access token or CLI needed — I can deploy directly from Lovable.

### Steps
1. Deploy `process-video` and `analysis-callback` via the built-in deploy tool (parallel).
2. Tail recent logs for each to confirm they booted cleanly.
3. Report back so you can re-run the job from `/test-video-analysis`.

### Notes
- `EXTERNAL_SUPABASE_ANON_KEY` and `RUNPOD_ANALYSIS_ENDPOINT_ID` are already set in Supabase secrets.
- Reminder: the last failure was a RunPod **404** — confirm `RUNPOD_ANALYSIS_ENDPOINT_ID` is updated to `uh6tok74gjrg3b` in Cloud → Edge Functions → Secrets before re-testing, otherwise the redeploy will hit the same error.