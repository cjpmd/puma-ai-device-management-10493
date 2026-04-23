import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hmacSha256(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  return crypto.subtle
    .importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message)));
}

function sha256(data: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(data))
    .then((h) =>
      Array.from(new Uint8Array(h))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmacSha256(new Uint8Array(kDate), region);
  const kService = await hmacSha256(new Uint8Array(kRegion), service);
  const kSigning = await hmacSha256(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Public endpoint — does NOT require auth. Resolves a share token to a
// short-lived presigned URL for the underlying Wasabi object.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { share_token } = await req.json();
    if (!share_token || typeof share_token !== "string") {
      return new Response(JSON.stringify({ error: "share_token required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: share, error: shareErr } = await adminClient
      .from("match_shares")
      .select("match_id, file_type, expires_at, revoked")
      .eq("share_token", share_token)
      .maybeSingle();

    if (shareErr || !share) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }
    if (share.revoked) {
      return new Response(JSON.stringify({ error: "Link revoked" }), {
        status: 410,
        headers: corsHeaders,
      });
    }
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link expired" }), {
        status: 410,
        headers: corsHeaders,
      });
    }

    // Look up the latest completed processing job for this match
    const { data: job, error: jobErr } = await adminClient
      .from("processing_jobs")
      .select("output_video_path, output_highlights_path")
      .eq("match_id", share.match_id)
      .eq("status", "complete")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Video not ready" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const storagePath =
      share.file_type === "highlights" ? job.output_highlights_path : job.output_video_path;
    if (!storagePath) {
      return new Response(JSON.stringify({ error: "Video not ready" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Fetch match metadata for header display (no sensitive data)
    const { data: match } = await adminClient
      .from("matches")
      .select("title, match_date")
      .eq("id", share.match_id)
      .maybeSingle();

    // Build presigned GET URL for Wasabi
    const accessKey = Deno.env.get("WASABI_ACCESS_KEY")!;
    const secretKey = Deno.env.get("WASABI_SECRET_KEY")!;
    const bucket = Deno.env.get("WASABI_BUCKET")!;
    const region = (Deno.env.get("WASABI_REGION") || "us-east-1").trim();
    let endpoint = (Deno.env.get("WASABI_ENDPOINT") || `https://s3.${region}.wasabisys.com`).trim();
    if (!endpoint.startsWith("http")) endpoint = `https://${endpoint}`;

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
    ]
      .sort()
      .join("&");

    const canonicalRequest = [
      "GET",
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

    return new Response(
      JSON.stringify({
        url: presignedUrl,
        file_type: share.file_type,
        match_title: match?.title || "Match video",
        match_date: match?.match_date || null,
        expires_in: expiresIn,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});