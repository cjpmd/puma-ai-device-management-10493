

## Plan — Build a clear end-to-end video donation flow with persistent recordings, manual upload, and shareable processed results

### What's broken / missing today

You correctly identified two big gaps:

1. **The recording vanishes when the donor hits Stop.**
   `CameraRecorder` builds a `File` in memory and passes it to `CameraCapture` via `onRecordingComplete`. That `File` only lives in React state. If the donor closes the page, navigates away, or the WebView is suspended, the recording is gone. Worse, on iOS the native plugin already saved the MP4 to the device cache directory, but we throw away that path and only keep the in-memory blob.

2. **There's no "upload later when on WiFi" UX.**
   Right now the donor sees the file briefly, then has to tap **Upload Video** in the same session. There's no concept of "I have unsent recordings, I'll do them tonight on WiFi". And once the page is closed, they can't get back to that state — the deep-link token is single-use and expires.

3. **Sharing processed videos isn't supported.**
   `MatchOutputViewer.tsx` opens the Wasabi presigned URL in a new tab — but those URLs expire in 1 hour and are tied to the master account. The coach can't send a link to a parent.

### The end-to-end flow we're going to build

```text
┌──────────────────────┐
│ MASTER (coach)        │
│ • create match       │
│ • generate L+R QR    │
│ • Start / Stop       │  ← already works
└──────────┬───────────┘
           │ realtime
┌──────────▼───────────┐         ┌────────────────────────┐
│ DONOR PHONE          │         │ DONOR — "My Recordings"│
│ • scan QR            │         │ • list saved files     │
│ • record (controlled)│ ─save→  │ • upload when on WiFi  │
│ • Stop → SAVED       │         │ • progress + retry     │
│   locally on phone   │         │ • delete after upload  │
└──────────────────────┘         └─────────┬──────────────┘
                                           │ Wasabi PUT
                                           ▼
                                ┌──────────────────────┐
                                │ Wasabi storage        │
                                │ matches/{id}/L|R/...  │
                                └─────────┬────────────┘
                                          │
                                ┌─────────▼────────────┐
                                │ RunPod processing    │ (auto when both sides uploaded)
                                └─────────┬────────────┘
                                          │
                                ┌─────────▼────────────┐
                                │ MASTER → Match page  │
                                │ • watch processed    │
                                │ • Share button →     │
                                │   public share link  │
                                └──────────────────────┘
```

### Donor side — persistent local recordings

**Save the recording the moment it stops, on the device, not in React state.**

In `src/components/Matches/CameraRecorder.tsx` `stopRecording()`:
- iOS already returns `result.videoFilePath` from `CameraPreview.stopRecordVideo()`. Keep that file on the device — don't fetch it into a Blob just to throw the path away. Pass `{ filePath, sizeBytes, durationSec, mimeType }` to the parent instead of a `File`.
- Web/Android fallback: write the blob to `Filesystem` (`@capacitor/filesystem`, Directory.Data) under `puma-recordings/<recordingId>.mp4`. We already lazy-load Filesystem.

**Store metadata in a small local registry.**

Create `src/services/localRecordings.ts`:
- Keys held in `localStorage` under `puma.localRecordings` as a JSON array of:
  ```
  {
    id: string,                // uuid
    matchId: string,
    matchTitle: string,
    cameraSide: 'left' | 'right',
    uploadToken: string,       // the QR token, kept so we can authorise upload later
    filePath: string,          // file:// URI on iOS or relative Filesystem path on web
    sizeBytes: number,
    durationSec: number,
    mimeType: string,
    recordedAt: string,        // ISO
    status: 'pending' | 'uploading' | 'uploaded' | 'failed',
    progress: number,          // 0-100
    lastError?: string,
  }
  ```
- Functions: `add()`, `list()`, `update(id, patch)`, `remove(id)`.
- This is the donor phone's source of truth. The capture screen, the recordings screen, and the upload manager all read/write through it.

**After Stop on the donor:**
- `CameraCapture.tsx` saves the entry, then shows a small confirmation card:
  - ✅ "Recording saved (12:34, 2.4 GB)."
  - Two buttons: **Upload now (on WiFi)** and **Upload later**.
  - Plus: **Open My Recordings**.
- No more silent loss when the page closes.

### Donor side — "My Recordings" screen

**New route `/my-recordings`** rendered by `src/pages/MyRecordings.tsx`. Add a top-level entry point on the donor home + on the QR-scan landing card.

For each entry we render a row with:
- Match title + L/R badge + recorded timestamp
- File size + duration
- Status pill: **Pending / Uploading X% / Uploaded / Failed**
- Buttons depending on status:
  - **Upload** (disabled when offline, with WiFi-only toggle)
  - **Pause / Resume** during upload
  - **Retry** on failure
  - **Delete** (only enabled after Uploaded, or with a confirm if Pending)

**Network policy:**
- A persistent toggle "Only upload on WiFi" stored in `localStorage`.
- We use Capacitor `Network` plugin (already in the dep tree as part of Capacitor core ecosystem; if missing we add `@capacitor/network`) to detect connection type.
- If WiFi-only is on and we're on cellular, the row shows **Waiting for WiFi**.
- A background `useEffect` watches `Network.addListener('networkStatusChange')` and, if a recording is `pending` and WiFi-only is OK, kicks off upload automatically.

### The upload itself

Reuse the existing edge functions — they already handle the donor token path.

`src/services/uploadRecording.ts`:
1. Read the file from disk via `Filesystem.readFile` (returns base64) → convert to Blob via `fetch(file://...)` on iOS to avoid base64 OOM (already a project rule).
2. `POST /functions/v1/generate-upload-url` with `{ match_id, camera_side, filename, content_type, upload_token }`. Already supports the donor token path.
3. `XHR PUT` the Blob to the returned `presigned_url` with progress callbacks → update `localRecordings.update(id, { progress })` so the UI reflects it.
4. `POST /functions/v1/confirm-guest-upload` to mark token used + flip `match_videos.upload_status = uploaded` and (when both sides are in) `matches.status = uploaded`.
5. On success: mark entry `uploaded`. Keep the file on disk for a configurable grace period (default 24h) so the donor can re-upload if something goes wrong server-side.
6. **Auto-cleanup**: a small sweep on app open removes `uploaded` entries older than 24h and deletes the underlying file via `Filesystem.deleteFile`.

**Upload-token longevity:**
- Tokens currently expire in 24 h. Bump the default to 7 days for the donor flow so a parent can record on Saturday and upload on Sunday night.
- Edit `supabase/functions/generate-camera-token/index.ts` → `expiresAt = Date.now() + 7*24*3600*1000`.
- Add a "regenerate token" affordance on `My Recordings` rows that are `failed: token expired` so the donor can ask the coach for a fresh QR via a generated link / chat — no schema change needed.

**No more single-use blocking:**
- `confirm-guest-upload` currently sets `used: true`. That means a re-upload (e.g. if the first attempt failed mid-stream and we want to retry the next day) is blocked. Change `used` to be set only on `confirm-guest-upload` success **after** the PUT has been verified, AND don't reject reuse of the token from `generate-upload-url` if `match_videos.upload_status != 'uploaded'`. This keeps the single-use guarantee semantically (one accepted upload per token) without breaking retry.

### Master side — "where's my recording?" feedback

`MatchDetail.tsx` already polls `match_videos`. Tighten the messaging:

- `CameraQRSetup` rows already show **Uploaded** when `upload_status='uploaded'`. Add **Recorded, awaiting upload** state when the donor has finished recording but hasn't uploaded. We get this for free by having the donor broadcast a new realtime message `recording_saved` after Stop, which `RecordingControls` already listens to. We persist it on the master only in component state (no DB row needed) and show it as a badge on the QR card: "Recorded ✔ — waiting for donor to upload".

- Add a **Send reminder** button on the master QR card that copies a deep link `playeranalysis://my-recordings?match=<id>` the coach can text to the donor. On tap it opens the donor app at `My Recordings` filtered to that match.

### Master side — share processed video with anyone

Today `get-output-url` returns a 1-hour presigned URL and only works for the match owner. Add a proper share mechanism.

**New table `match_shares`** (migration):
```
id uuid pk default gen_random_uuid()
match_id uuid not null references matches(id) on delete cascade
created_by uuid not null         -- auth.uid() of master
share_token text not null unique -- 32-byte hex, used in URL
file_type text not null check (file_type in ('video','highlights'))
expires_at timestamptz            -- nullable = no expiry
revoked boolean not null default false
created_at timestamptz not null default now()
```
With RLS:
- Owners (`matches.user_id = auth.uid()`) can `select / insert / update (revoke) / delete`.
- No public select — the share link is resolved by an edge function, not a client query.

**New edge function `create-share-link`** (auth required, owner only):
- Input: `{ match_id, file_type, expires_in_days? }`
- Generates `share_token`, inserts row, returns `{ url: '<app-origin>/share/<token>' }`.

**New edge function `resolve-share`** (public):
- Input: `{ share_token }`
- Looks up row; if not revoked / not expired and the corresponding `processing_jobs.output_*_path` exists, generates a 1-hour Wasabi presigned URL and returns `{ url, match_title, match_date, file_type, expires_in }`.

**New public route `/share/:token`** rendered by `src/pages/SharedVideo.tsx`:
- Fetches `resolve-share`, then renders a polished page: match title, date, location, an HTML `<video controls playsInline>` with the presigned URL as `src`, plus a **Download** button. No login required.
- Refreshes the presigned URL every 50 minutes while the page is open (so a parent watching for a long time doesn't lose the stream).

**Master UI changes** in `MatchOutputViewer.tsx` (and add to `MatchCinemaLayout` header):
- Each output row gets a new **Share link** button next to View.
- Clicking it opens a small dialog: "Share Final Follow Cam" → expiry selector (24 h / 7 d / Never) → **Generate link** → shows the URL + Copy + native share sheet via `navigator.share()` when available + WhatsApp / Email quick buttons.
- Below: a list of existing share links for this match with expiry, copy, and **Revoke** buttons (sets `revoked=true`).

### Files to touch / create

**Edit**
- `src/components/Matches/CameraRecorder.tsx` — return file metadata (path, size, duration, mime) instead of materialising a Blob; on web fallback, write Blob to Filesystem and return its path.
- `src/pages/CameraCapture.tsx` — after Stop, save to local recordings registry, show "Saved" card with Upload-now/later/Open My Recordings actions. Broadcast `recording_saved` to master.
- `src/components/Matches/RecordingControls.tsx` — show per-side "Recorded ✔ awaiting upload" badge based on the new broadcast.
- `src/components/Matches/CameraQRSetup.tsx` — surface the new "awaiting upload" state and add "Send reminder" link copy button.
- `src/components/Matches/MatchOutputViewer.tsx` — add **Share link** button per output; share-link manager dialog.
- `supabase/functions/generate-camera-token/index.ts` — extend default expiry to 7 days.
- `supabase/functions/confirm-guest-upload/index.ts` — only set `used=true` after the upload is confirmed (already true, but tighten the precondition so retries don't 410).
- `src/App.tsx` — add `/my-recordings` and `/share/:token` routes.

**Create**
- `src/services/localRecordings.ts` — local registry CRUD + cleanup sweep.
- `src/services/uploadRecording.ts` — single recording upload pipeline + WiFi-only gate.
- `src/pages/MyRecordings.tsx` — donor-side recordings list & upload UI.
- `src/pages/SharedVideo.tsx` — public share viewer page.
- `supabase/functions/create-share-link/index.ts`
- `supabase/functions/resolve-share/index.ts`
- New migration: `match_shares` table + RLS.

**No changes to**
- Wasabi storage layout (`matches/<id>/<side>/<filename>` is fine).
- RunPod orchestration (`trigger-processing`, webhook).
- Existing master Cinema/analytics views.

### Why this design

- **Nothing is lost.** The moment a donor hits Stop, the file is on disk with a registry entry. Closing the app, losing signal, or device reboot don't delete it.
- **Donor is in control of when to upload** — explicit "Upload later" button, WiFi-only toggle, plus auto-resume when WiFi is detected.
- **Master always knows the state** — recorded vs uploaded is shown on the QR card and the recording controls panel.
- **Sharing is real.** Public, revocable, expirable share links via dedicated public viewer page; no need to mint a fresh presigned URL by hand each time, and no need for the recipient to have an account.

### Out of scope (this round)
- Background uploads while the donor app is fully closed (would need a true iOS background task / push-triggered transfer). The donor needs to open the app for the upload to run; the WiFi-watcher kicks in instantly when the app comes to foreground.
- Editing share permissions per-recipient.
- Embedding the share link inside team chats.

