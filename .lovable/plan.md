

# Test Results: Wasabi Upload

## What I tested

1. **Edge function is running** — confirmed it boots and processes requests.
2. **Token-based auth path** — correctly rejects invalid tokens (401).
3. **JWT auth path** — **BROKEN**. Line 85 of `generate-upload-url/index.ts` still calls `supabase.auth.getClaims(token)`, which does not exist in supabase-js v2. This means **no authenticated user can get a presigned URL**. The fix from the previous plan was never applied to this file.

## Root cause

The previous plan proposed replacing `getClaims()` with `getUser()`, but the deployed code still has the old broken call. The source file hasn't been updated.

## Fix (single file change)

### `supabase/functions/generate-upload-url/index.ts`

Replace lines 84-89:
```typescript
// OLD (broken)
const token = authHeader.replace("Bearer ", "");
const { data: claims, error: authError } = await supabase.auth.getClaims(token);
if (authError || !claims?.claims) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}
const userId = claims.claims.sub as string;
```

With:
```typescript
// NEW (working)
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}
const userId = user.id;
```

After deploying this fix, I'll create a small test edge function that:
1. Calls `generate-upload-url` internally to get a presigned URL
2. Uploads a small text file ("hello world") to that presigned URL via `fetch` PUT
3. Returns success/failure

This will confirm the entire Wasabi pipeline works end-to-end without needing a browser or mobile device.

