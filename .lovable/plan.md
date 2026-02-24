

# Mobile Camera Capture: 3-Phone Workflow

## Concept

Three phones per match:
- **Control Phone** (logged-in user): Creates the match, generates QR codes for left and right cameras
- **Left Camera Phone** (no account needed): Scans QR, records video using native camera, uploads via a token-authenticated link when on WiFi
- **Right Camera Phone** (same as above)

## How It Works

```text
Control Phone (authenticated user)
  |
  |--> Creates match
  |--> Generates QR code for "Left Camera"
  |--> Generates QR code for "Right Camera"
  |
  v
Camera Phones (no login required)
  |
  |--> Scan QR code
  |--> Land on a guest upload page with:
  |      - Match name + camera side pre-filled
  |      - "Record Video" button (uses native camera)
  |      - "Upload" button (when ready, on WiFi)
  |--> Upload goes directly to Wasabi via presigned URL
  |--> Control phone sees status update in real-time
```

## Database Changes

**New table: `upload_tokens`**
- id (uuid, PK)
- match_id (uuid, FK to matches)
- camera_side (text: left / right)
- token (text, unique, random string)
- expires_at (timestamptz, e.g. 24 hours from creation)
- used (boolean, default false)
- created_at (timestamptz)

No RLS needed on this table from the client side -- it will be accessed via edge functions only. RLS policies will allow the match owner to create tokens, and a new edge function will validate tokens for guest uploads.

## Edge Function Changes

**New: `generate-camera-token`** (authenticated)
- Input: match_id, camera_side
- Validates the user owns the match
- Creates a random token in `upload_tokens` table (expires in 24h)
- Returns: token string + full URL for the guest upload page

**Modified: `generate-upload-url`**
- Currently requires authentication (Bearer token)
- Add a second auth path: accept an `upload_token` in the request body
- If token provided: validate it against `upload_tokens` table (not expired, not used, matches camera_side)
- If valid: generate presigned URL as normal, no user login required
- After successful upload: mark token as used

## Frontend Changes

### New Route: `/capture/:token`
A guest-accessible page (no login required) that:
- Validates the token via an edge function call
- Shows the match name and camera side (e.g. "Left Camera - Arsenal vs Chelsea")
- Has a large "Record Video" button that uses `<input type="file" accept="video/*" capture="environment">` to open the native camera directly
- Shows upload progress bar
- Designed for mobile-first: large tap targets, simple layout, clear status
- Can work offline for recording -- the file stays on the phone until the user taps "Upload"
- Shows a "waiting for WiFi" suggestion if on cellular

### Updated: Match Detail Page (`/matches/:id`)
- Add a "Camera Setup" section with two QR code cards
- Each card shows:
  - Camera side label (Left / Right)
  - A QR code encoding the guest upload URL (`/capture/{token}`)
  - A "Copy Link" button (for sharing via iMessage as alternative)
  - Token expiry countdown
  - Upload status from that camera (synced via polling)
- QR codes generated client-side using a lightweight library (e.g. `qrcode.react`)

### Updated: App.tsx
- Add `/capture/:token` as a public route (no auth wrapper)

## New Dependency

- `qrcode.react` -- lightweight QR code rendering for React

## Security Model

- Tokens are single-use, time-limited (24h), and scoped to a specific match + camera side
- The guest upload page cannot access any other data -- only upload to the specific match/camera
- Presigned URLs from Wasabi expire in 15 minutes
- Token validation happens server-side in edge functions
- The match owner can regenerate tokens if needed (invalidates old ones)

## File Summary

### New files:
1. `supabase/functions/generate-camera-token/index.ts` -- Token generation (authenticated)
2. `src/pages/CameraCapture.tsx` -- Guest upload page
3. `src/components/Matches/CameraQRSetup.tsx` -- QR code display for control phone

### Modified files:
1. `supabase/functions/generate-upload-url/index.ts` -- Add token-based auth path
2. `src/pages/MatchDetail.tsx` -- Add Camera Setup section
3. `src/App.tsx` -- Add /capture/:token public route
4. `supabase/config.toml` -- Add verify_jwt=false for generate-camera-token (we handle auth in code)

### Database migration:
- Create `upload_tokens` table with RLS policies (owner can SELECT/INSERT/DELETE, no public access)

## Implementation Order

1. Database migration for `upload_tokens` table
2. `generate-camera-token` edge function
3. Update `generate-upload-url` to accept tokens
4. `CameraCapture.tsx` guest upload page
5. `CameraQRSetup.tsx` QR code component
6. Update `MatchDetail.tsx` with camera setup section
7. Update `App.tsx` routing
