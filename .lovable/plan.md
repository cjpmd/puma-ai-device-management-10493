

# Fix Mobile Video Upload to Wasabi

## Issues Found

### 1. **Duplicate variable declaration crashes the edge function** (CRITICAL)
In `generate-upload-url/index.ts`, `adminClient` is declared on **line 46** and again on **line 154**. This causes a runtime error — the function never reaches the presigned URL generation step. The first declaration (line 46-49) is used for token validation; the second (line 154-157) is used for upserting `match_videos`. The second declaration should be removed since the first is already in scope.

### 2. **`getClaims()` does not exist in supabase-js v2** (CRITICAL for authenticated uploads)
Line 84 calls `supabase.auth.getClaims()` which is not a valid method. Should be `supabase.auth.getUser()` to extract the user ID from the JWT.

### 3. **CORS headers incomplete** (may cause preflight failures on mobile)
The edge functions use a minimal set of CORS headers. Newer versions of the Supabase JS client send additional headers (`x-supabase-client-platform`, etc.) that aren't allowed, which can cause `OPTIONS` preflight to fail on mobile browsers.

### 4. **Native recording: base64 conversion will OOM on large files**
In `CameraRecorder.tsx` lines 258-264, after stopping a native recording, the entire 4K video file is read into memory as base64, then converted byte-by-byte to an `ArrayBuffer`. For multi-GB files this will crash the app. Instead, the file should be uploaded directly using the native file path via `XMLHttpRequest` or `fetch` with a `Blob` URL.

## Changes

### 1. Fix `supabase/functions/generate-upload-url/index.ts`
- Remove the duplicate `adminClient` declaration on line 154-157 (reuse the one from line 46)
- Replace `supabase.auth.getClaims()` with `supabase.auth.getUser()` and extract `user.id`
- Update CORS headers to include all Supabase client headers

### 2. Fix `supabase/functions/confirm-guest-upload/index.ts`
- Update CORS headers to match

### 3. Fix `src/components/Matches/CameraRecorder.tsx`
- Replace the base64-to-ArrayBuffer conversion with a chunked approach for smaller files
- For large native files, pass the file path back to the parent and let the upload use `Filesystem.readFile` in chunks or use `fetch` with the native file URI directly
- Add the chunked base64 conversion helper to avoid stack overflow

### 4. Fix `src/components/Matches/VideoUploadCard.tsx`
- Update CORS-related headers if manually set (currently none — uses `supabase.functions.invoke` which handles this)

## File Summary

### Files to modify:
1. `supabase/functions/generate-upload-url/index.ts` — Fix duplicate variable, fix auth method, update CORS
2. `supabase/functions/confirm-guest-upload/index.ts` — Update CORS headers
3. `src/components/Matches/CameraRecorder.tsx` — Fix native file conversion to avoid OOM

