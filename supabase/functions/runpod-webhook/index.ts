import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchMetadata(metadataPath: string): Promise<Record<string, any> | null> {
  try {
    const endpoint = Deno.env.get("WASABI_ENDPOINT")!;
    const bucket = Deno.env.get("WASABI_BUCKET")!;
    const accessKey = Deno.env.get("WASABI_ACCESS_KEY")!;
    const secretKey = Deno.env.get("WASABI_SECRET_KEY")!;
    const region = Deno.env.get("WASABI_REGION") || "eu-central-1";

    // Build a simple GET request with AWS Signature (using fetch with presigned-like approach)
    // For simplicity, use the public URL if bucket is public, or construct a signed URL
    const url = `https://${bucket}.${endpoint.replace("https://", "")}/${metadataPath}`;

    // Use AWS4 signing for Wasabi
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const shortDate = dateStamp.substring(0, 8);

    const { createHmac } = await import("https://deno.land/std@0.177.0/node/crypto.ts");

    const method = "GET";
    const host = `${bucket}.${endpoint.replace("https://", "")}`;
    const canonicalUri = `/${metadataPath}`;
    const canonicalQueryString = "";
    const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // empty payload
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateStamp}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const encoder = new TextEncoder();
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${shortDate}/${region}/s3/aws4_request`;

    // Hash canonical request
    const canonicalRequestHash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)))
    ).map(b => b.toString(16).padStart(2, "0")).join("");

    const stringToSign = `${algorithm}\n${dateStamp}\n${credentialScope}\n${canonicalRequestHash}`;

    // Signing key
    function hmacSha256(key: Uint8Array, data: string): Promise<ArrayBuffer> {
      return crypto.subtle.sign("HMAC",
        crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) as any,
        encoder.encode(data)
      );
    }

    // Use the sync createHmac approach instead
    const kDate = createHmac("sha256", encoder.encode(`AWS4${secretKey}`)).update(shortDate).digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const authHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
      headers: {
        "Host": host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": dateStamp,
        "Authorization": authHeader,
      },
    });

    if (!res.ok) {
      console.error("Failed to fetch metadata:", res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("Error fetching metadata:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { id, status, output } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing job id" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: job, error: jobErr } = await adminClient
      .from("processing_jobs")
      .select("id, match_id")
      .eq("runpod_job_id", id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: corsHeaders });
    }

    const isComplete = status === "COMPLETED";
    const isFailed = status === "FAILED";

    const jobUpdate: Record<string, any> = {
      status: isComplete ? "complete" : isFailed ? "failed" : "running",
      completed_at: isComplete || isFailed ? new Date().toISOString() : null,
    };

    if (isComplete && output) {
      jobUpdate.output_video_path = output.video_path || null;
      jobUpdate.output_highlights_path = output.highlights_path || null;
      jobUpdate.output_metadata_path = output.metadata_path || null;

      // Fetch and parse metadata to populate analytics columns
      if (output.metadata_path) {
        const metadata = await fetchMetadata(output.metadata_path);
        if (metadata) {
          jobUpdate.player_tracking_data = metadata.player_tracks || null;
          jobUpdate.ball_tracking_data = {
            detection_stages: metadata.detection_stages || null,
            ball_positions: metadata.ball_positions || null,
            total_frames: metadata.total_frames || null,
          };
          jobUpdate.event_data = {
            play_switch_events: metadata.play_switch_events || null,
            highlights: metadata.highlights || null,
          };
        }
      }
    }

    if (isFailed) {
      jobUpdate.processing_logs = JSON.stringify(body.error || body);
    }

    await adminClient.from("processing_jobs").update(jobUpdate).eq("id", job.id);

    await adminClient
      .from("matches")
      .update({ status: isComplete ? "complete" : isFailed ? "failed" : "processing" })
      .eq("id", job.match_id);

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
