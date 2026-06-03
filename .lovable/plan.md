## Fix: Load Match Video error

**Root cause:** `get-output-url` picks the newest completed job, but that job has a NULL `output_video_path`. The older job with a valid path is never considered → 404 → "Edge Function returned a non-2xx status code".

## Change

**`supabase/functions/get-output-url/index.ts`** — change the job lookup to filter by the column matching the requested `file_type`:

- Map `file_type` → column (`output_video_path` / `output_highlights_path` / `output_metadata_path`).
- Query `processing_jobs` with `.not(<column>, "is", null)` in addition to the existing status filter, ordered by `completed_at desc` then `created_at desc`, limit 1.
- Return a clearer 404 (`No completed job has a <file_type> output yet`) when nothing matches.
- Rest of the function (presign reuse + re-sign logic) stays as-is.

No frontend changes — `MatchDetail.tsx` already gates the button correctly on the client side.