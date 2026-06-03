import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * rerun-analysis: re-queues GPU analysis for a match using whatever source
 * video the previous job used — even if match_videos has been cleared.
 *
 * Lookup priority for the source video path:
 *   1. processing_jobs.source_video_path (persisted by process-video)
 *   2. processing_jobs.output_video_path of the latest completed job
 *      (the GPU worker stores the analysed source as a presigned wasabi URL)
 *   3. match_videos.left (single-camera fallback)
 *
 * We re-derive bucket/region/key from the stored URL, generate a fresh
 * 1-hour presigned GET URL, create a new processing_jobs row, then invoke
 * process-video which queues the RunPod analysis endpoint.
 */

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
    .then((h) => Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}
async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmacSha256(new Uint8Array(kDate), region);
  const kService = await hmacSha256(new Uint8Array(kRegion), service);
  const kSigning = await hmacSha256(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function presignGet(bucket: string, key: string, region: string) {
  const accessKey = Deno.env.get("WASABI_ACCESS_KEY_ID") || Deno.env.get("WASABI_ACCESS_KEY")!;
  const secretKey = Deno.env.get("WASABI_SECRET_ACCESS_KEY") || Deno.env.get("WASABI_SECRET_KEY")!;
  const endpoint = `https://s3.${region}.wasabisys.com`;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const encodedBucket = encodeURIComponent(bucket);
  const expiresIn = 3600;
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const shortDate = dateStamp.substring(0, 8);
  const credential = `${accessKey}/${shortDate}/${region}/s3/aws4_request`;
  const host = endpoint.replace("https://", "");
  const canonicalQS = [
    "X-Amz-Algorithm=AWS4-HMAC-SHA256",
    `X-Amz-Credential=${encodeURIComponent(credential)}`,
    `X-Amz-Date=${dateStamp}`,
    `X-Amz-Expires=${expiresIn}`,
    "X-Amz-SignedHeaders=host",
  ].sort().join("&");
  const canonicalRequest = [
    "GET",
    `/${encodedBucket}/${encodedKey}`,
    canonicalQS,
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
  return `${endpoint}/${encodedBucket}/${encodedKey}?${canonicalQS}&X-Amz-Signature=${signature}`;
}

function parseWasabiUrl(stored: string): { bucket: string; key: string; region: string } | null {
  try {
    if (/^https?:\/\//i.test(stored)) {
      const u = new URL(stored);
      const m = u.host.match(/^s3[.-]([a-z0-9-]+)\.wasabisys\.com$/i);
      const region = m ? m[1] : (Deno.env.get("WASABI_REGION") || "us-east-1");
      const p = u.pathname.replace(/^\/+/, "");
      const slash = p.indexOf("/");
      if (slash <= 0) return null;
      return {
        bucket: p.slice(0, slash),
        key: decodeURIComponent(p.slice(slash + 1)),
        region,
      };
    }
    // Otherwise treat as a bare "bucket/key" or just "key" in the default bucket
    const bucket = Deno.env.get("WASABI_BUCKET") || "";
    const region = Deno.env.get("WASABI_REGION") || "us-east-1";
    if (stored.includes("/")) {
      const slash = stored.indexOf("/");
      return { bucket: stored.slice(0, slash), key: stored.slice(slash + 1), region };
    }
    return { bucket, key: stored, region };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify ownership
    const { data: match } = await admin.from("matches").select("id, user_id").eq("id", match_id).single();
    if (!match || match.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: corsHeaders });
    }

    // Pull latest job (any status) for source path fallbacks
    const { data: lastJob } = await admin
      .from("processing_jobs")
      .select("source_video_path, output_video_path")
      .eq("match_id", match_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sourceCandidate: string | null =
      (lastJob as any)?.source_video_path || (lastJob as any)?.output_video_path || null;

    if (!sourceCandidate) {
      const { data: vids } = await admin
        .from("match_videos")
        .select("camera_side, wasabi_path, upload_status")
        .eq("match_id", match_id);
      const left = vids?.find((v: any) => v.camera_side === "left" && v.upload_status === "uploaded");
      if (left?.wasabi_path) sourceCandidate = left.wasabi_path;
    }

    if (!sourceCandidate) {
      return new Response(
        JSON.stringify({ error: "No source video found for this match" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const parsed = parseWasabiUrl(sourceCandidate);
    if (!parsed || !parsed.bucket || !parsed.key) {
      return new Response(
        JSON.stringify({ error: "Could not parse source video location" }),
        { status: 500, headers: corsHeaders },
      );
    }

    const freshUrl = await presignGet(parsed.bucket, parsed.key, parsed.region);

    // Create new processing job row
    const { data: newJob, error: insertErr } = await admin
      .from("processing_jobs")
      .insert({
        match_id,
        status: "queued",
        gpu_type: "analysis",
        source_video_path: `${parsed.bucket}/${parsed.key}`,
      })
      .select("id")
      .single();

    if (insertErr || !newJob) {
      return new Response(
        JSON.stringify({ error: `Failed to create job: ${insertErr?.message}` }),
        { status: 500, headers: corsHeaders },
      );
    }

    // Invoke process-video to queue RunPod
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${supabaseUrl}/functions/v1/process-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ job_id: newJob.id, video_url: freshUrl }),
    });
    const body = await res.json();
    if (!res.ok) {
      await admin
        .from("processing_jobs")
        .update({ status: "failed", processing_logs: `rerun queue failed: ${JSON.stringify(body)}` })
        .eq("id", newJob.id);
      return new Response(JSON.stringify({ error: "Failed to queue analysis", details: body }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    await admin.from("matches").update({ status: "processing" }).eq("id", match_id);

    return new Response(
      JSON.stringify({ job_id: newJob.id, analysis_job_id: body?.analysis_job_id ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
