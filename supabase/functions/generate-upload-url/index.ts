import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hmacSha256(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message)));
}

function sha256(data: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))
    .then((h) => Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  let kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  let kRegion = await hmacSha256(new Uint8Array(kDate), region);
  let kService = await hmacSha256(new Uint8Array(kRegion), service);
  let kSigning = await hmacSha256(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { match_id, camera_side, filename, content_type, upload_token } = await req.json();

    if (!match_id || !camera_side || !filename || !content_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    if (!["left", "right"].includes(camera_side)) {
      return new Response(JSON.stringify({ error: "camera_side must be left or right" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth path 1: upload_token (guest camera phone)
    // Auth path 2: Bearer token (authenticated user)
    if (upload_token) {
      const { data: tokenRow, error: tokenError } = await adminClient
        .from("upload_tokens")
        .select("*")
        .eq("token", upload_token)
        .eq("match_id", match_id)
        .eq("camera_side", camera_side)
        .single();

      if (tokenError || !tokenRow) {
        return new Response(JSON.stringify({ error: "Invalid upload token" }), { status: 401, headers: corsHeaders });
      }
      if (tokenRow.used) {
        return new Response(JSON.stringify({ error: "Token already used" }), { status: 410, headers: corsHeaders });
      }
      if (new Date(tokenRow.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Token expired" }), { status: 410, headers: corsHeaders });
      }
    } else {
      // Standard JWT auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: authError } = await supabase.auth.getClaims(token);
      if (authError || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const userId = claims.claims.sub as string;

      // Verify user owns this match
      const { data: match, error: matchError } = await adminClient
        .from("matches")
        .select("id")
        .eq("id", match_id)
        .eq("user_id", userId)
        .single();

      if (matchError || !match) {
        return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: corsHeaders });
      }
    }

    // Generate presigned URL for Wasabi
    const accessKey = Deno.env.get("WASABI_ACCESS_KEY");
    const secretKey = Deno.env.get("WASABI_SECRET_KEY");
    const bucket = Deno.env.get("WASABI_BUCKET");
    const region = Deno.env.get("WASABI_REGION") || "us-east-1";
    const endpoint = Deno.env.get("WASABI_ENDPOINT") || `https://s3.${region}.wasabisys.com`;

    if (!accessKey || !secretKey || !bucket) {
      return new Response(JSON.stringify({ error: "Storage not configured" }), { status: 500, headers: corsHeaders });
    }

    const storagePath = `matches/${match_id}/${camera_side}/${filename}`;
    const expiresIn = 900; // 15 minutes

    // AWS Signature V4 presigned URL
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const shortDate = dateStamp.substring(0, 8);
    const credential = `${accessKey}/${shortDate}/${region}/s3/aws4_request`;
    const host = endpoint.replace("https://", "").replace("http://", "");

    const canonicalQueryString = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(credential)}`,
      `X-Amz-Date=${dateStamp}`,
      `X-Amz-Expires=${expiresIn}`,
      `X-Amz-SignedHeaders=host`,
    ].sort().join("&");

    const canonicalRequest = [
      "PUT",
      `/${bucket}/${storagePath}`,
      canonicalQueryString,
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      dateStamp,
      `${shortDate}/${region}/s3/aws4_request`,
      await sha256(canonicalRequest),
    ].join("\n");

    const signingKey = await getSignatureKey(secretKey, shortDate, region, "s3");
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    const presignedUrl = `${endpoint}/${bucket}/${storagePath}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    // Upsert match_videos record (reuse adminClient from above)
    const { error: videoError } = await adminClient
      .from("match_videos")
      .upsert(
        {
          match_id,
          camera_side,
          wasabi_path: storagePath,
          upload_status: "pending",
        },
        { onConflict: "match_id,camera_side", ignoreDuplicates: false }
      );

    // Update match status to uploading
    await adminClient
      .from("matches")
      .update({ status: "uploading" })
      .eq("id", match_id);

    return new Response(
      JSON.stringify({ presigned_url: presignedUrl, storage_path: storagePath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
