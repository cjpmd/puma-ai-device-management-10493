# Fix blank/loading page + video signing

## What's actually happening

The page is **not** crashing — when I navigated to `/matches/bd76f2a1-…`, it took ~4s of "Loading…" before fully rendering (slowest query: `processing_jobs` 4s, `get-output-url` 4s). The page then showed the match, all panels, and the cinema player with **"Video source not supported by this browser"**.

So there are two real issues:

### 1. Long "Loading…" feels like a blank page

`MatchDetail.tsx` blocks the entire page behind `if (loading) return <Loading…>`. `useMatchPolling.fetchMatchDetail` does `Promise.all` of match + match_videos + processing_jobs and only flips `loading=false` when all three resolve. `processing_jobs` for this match consistently takes ~4s.

Fix: stop blocking the whole page on `processing_jobs`. Render the match shell as soon as the match row is loaded, and let `ProcessingStatus` / `MatchCinemaLayout` render their own loading state when `jobs` is still empty.

### 2. Video says "source not supported" → bad presigned URL

`processing_jobs.output_video_path` is the original Wasabi URL:

```
https://s3.eu-west-1.wasabisys.com/pumaaivideoanalysis/Lions%20v%20Kirrie%209v9s%2010-12-2025.mp4?...
```

— region **eu-west-1**, key has **spaces**.

`supabase/functions/get-output-url/index.ts` re-extracts the key and re-signs, but:

- It rebuilds the host from `WASABI_REGION` (default `us-east-1`) → wrong host for objects in `eu-west-1`. The currently configured secret almost certainly doesn't match this object's region.
- After `decodeURIComponent`, `storagePath` becomes `Lions v Kirrie 9v9s 10-12-2025.mp4` (raw spaces). It's then dropped straight into both the canonical request (`/${bucket}/${storagePath}`) and the final URL — spaces are never re-encoded. Wasabi will reject the signature and/or the URL is malformed, which the browser surfaces as "source not supported".

### Fix plan

**A. Edge function `get-output-url`**

1. If the stored value is already a fully-qualified Wasabi URL **and not expired**, return it as-is instead of re-signing (it was created by the GPU worker with the correct region/key and a long expiry — the example expires in 2027).
2. If we *do* need to re-sign, derive the region and host from the original URL (parse `s3.<region>.wasabisys.com`) instead of relying on the `WASABI_REGION` env var.
3. URL-encode each path segment when building both the canonical request and the final URL (`segments.map(encodeURIComponent).join('/')`), so keys with spaces sign correctly.

**B. Frontend loading**

1. In `useMatchPolling.fetchMatchDetail`, set `loading=false` as soon as the `match` row resolves; let videos/jobs continue in the background.
2. Make `MatchDetail.tsx` only short-circuit on `!match` (not on missing jobs). `ProcessingStatus` and `MatchCinemaLayout` already handle the no-job case.

### Files to edit

- `supabase/functions/get-output-url/index.ts`
- `src/hooks/useMatchPolling.ts`
- `src/pages/MatchDetail.tsx`

No schema/RLS changes needed — the permissions you amended are working (all REST queries return 200).
