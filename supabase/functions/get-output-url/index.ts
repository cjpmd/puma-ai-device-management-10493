import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hmacSha256(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { match_id, file_type } = await req.json();

    if (!match_id || !file_type) {
      return new Response(JSON.stringify({ error: "match_id and file_type required" }), { status: 400, headers: corsHeaders });
    }

    if (!["video", "highlights", "metadata"].includes(file_type)) {
      return new Response(JSON.stringify({ error: "file_type must be video, highlights, or metadata" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user owns this match
    const { data: match, error: matchErr } = await adminClient
      .from("matches")
      .select("id")
      .eq("id", match_id)
      .eq("user_id", user.id)
      .single();

    if (matchErr || !match) {
      return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: corsHeaders });
    }

    // Get the output path from processing_jobs
    const { data: job, error: jobErr } = await adminClient
      .from("processing_jobs")
      .select("output_video_path, output_highlights_path, output_metadata_path")
      .eq("match_id", match_id)
      .in("status", ["complete", "completed"])
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "No completed processing job found" }), { status: 404, headers: corsHeaders });
    }

    const pathMap: Record<string, string | null> = {
      video: job.output_video_path,
      highlights: job.output_highlights_path,
      metadata: job.output_metadata_path,
    };

    const storedValue = pathMap[file_type];
    if (!storedValue) {
      return new Response(JSON.stringify({ error: `No ${file_type} output available` }), { status: 404, headers: corsHeaders });
    }

    // If the stored value is already a fully-qualified presigned URL and
    // hasn't expired, return it as-is. The GPU worker signs URLs with the
    // correct region/key for the object, so re-signing here often breaks
    // (wrong region env, key encoding, etc.).
    if (/^https?:\/\//i.test(storedValue)) {
      try {
        const u = new URL(storedValue);
        const dateStr = u.searchParams.get("X-Amz-Date");
        const expiresStr = u.searchParams.get("X-Amz-Expires");
        if (dateStr && expiresStr) {
          // X-Amz-Date format: YYYYMMDDTHHMMSSZ
          const y = +dateStr.slice(0, 4), mo = +dateStr.slice(4, 6) - 1, d = +dateStr.slice(6, 8);
          const h = +dateStr.slice(9, 11), mi = +dateStr.slice(11, 13), s = +dateStr.slice(13, 15);
          const signedAt = Date.UTC(y, mo, d, h, mi, s);
          const expiresAt = signedAt + (+expiresStr) * 1000;
          if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000) {
            return new Response(
              JSON.stringify({ url: storedValue, file_type, expires_in: Math.floor((expiresAt - Date.now()) / 1000) }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      } catch { /* fall through and try to re-sign */ }
    }

    // Need to re-sign. Derive region + bucket + key from the stored URL
    // when possible, so we don't depend on env vars matching the object.
    let bucket = Deno.env.get("WASABI_BUCKET") || "";
    let region = (Deno.env.get("WASABI_REGION") || "us-east-1").trim();
    let storageKey = storedValue;

    if (/^https?:\/\//i.test(storedValue)) {
      try {
        const u = new URL(storedValue);
        const m = u.host.match(/^s3[.-]([a-z0-9-]+)\.wasabisys\.com$/i);
        if (m) region = m[1];
        let p = u.pathname.replace(/^\/+/, "");
        const firstSlash = p.indexOf("/");
        if (firstSlash > 0) {
          bucket = p.slice(0, firstSlash);
          storageKey = decodeURIComponent(p.slice(firstSlash + 1));
        }
      } catch { /* keep defaults */ }
    }

    const accessKey = Deno.env.get("WASABI_ACCESS_KEY_ID") || Deno.env.get("WASABI_ACCESS_KEY")!;
    const secretKey = Deno.env.get("WASABI_SECRET_ACCESS_KEY") || Deno.env.get("WASABI_SECRET_KEY")!;
    const endpoint = `https://s3.${region}.wasabisys.com`;

    // URL-encode each path segment (preserves "/"), so keys with spaces sign correctly.
    const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
    const encodedBucket = encodeURIComponent(bucket);

    const expiresIn = 3600; // 1 hour
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
      "GET",
      `/${encodedBucket}/${encodedKey}`,
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

    const presignedUrl = `${endpoint}/${encodedBucket}/${encodedKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    return new Response(
      JSON.stringify({ url: presignedUrl, file_type, expires_in: expiresIn }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
