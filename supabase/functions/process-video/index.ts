import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * process-video: queues a match video analysis job on the RunPod analysis endpoint.
 *
 * Called after a stitched (or single-camera) video is available.
 * Uses RUNPOD_ANALYSIS_ENDPOINT_ID — a separate, lighter endpoint from the
 * full follow-cam worker (RUNPOD_ENDPOINT_ID).
 *
 * Body:
 *   { job_id, session_id?, video_url?, stitched_url?, left_url?, right_url?,
 *     target_fps? }
 *
 * - video_url / stitched_url: presigned HTTPS URL for an already-stitched video.
 * - left_url / right_url: Wasabi paths for the two donor cameras (analysis runs
 *   on left_url if no stitched video is available yet).
 * - target_fps: frames per second to analyse (default 5; lower = faster, less
 *   accurate; higher = slower, more accurate).
 *
 * Returns immediately after queuing (RunPod is async).
 * Result arrives via analysis-callback edge function.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      job_id,
      session_id,
      video_url,
      stitched_url,
      left_url,
      right_url,
      target_fps = 5,
    } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Prefer stitched → single footage URL → left donor
    const sourceVideoUrl: string | null = stitched_url ?? video_url ?? left_url ?? null;

    if (!sourceVideoUrl) {
      return new Response(
        JSON.stringify({ error: "No video URL provided (video_url, stitched_url, or left_url required)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const runpodApiKey = Deno.env.get("RUNPOD_API_KEY");
    const runpodEndpointId = Deno.env.get("RUNPOD_ANALYSIS_ENDPOINT_ID");

    if (!runpodApiKey || !runpodEndpointId) {
      return new Response(
        JSON.stringify({ error: "RUNPOD_ANALYSIS_ENDPOINT_ID not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Mark job as processing
    await adminClient
      .from("processing_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/analysis-callback`;

    const runpodRes = await fetch(
      `https://api.runpod.ai/v2/${runpodEndpointId}/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({
          input: {
            job_type: "analyse",
            job_id,
            session_id: session_id ?? null,
            video_url: sourceVideoUrl,
            left_video_url: left_url ?? null,
            right_video_url: right_url ?? null,
            target_fps,
            // Wasabi credentials so the handler can download presigned-URL-less paths
            wasabi_access_key: Deno.env.get("WASABI_ACCESS_KEY"),
            wasabi_secret_key: Deno.env.get("WASABI_SECRET_KEY"),
            wasabi_region: Deno.env.get("WASABI_REGION"),
            wasabi_endpoint: Deno.env.get("WASABI_ENDPOINT"),
            output_bucket: Deno.env.get("WASABI_BUCKET"),
          },
          webhook: webhookUrl,
        }),
      }
    );

    const runpodData = await runpodRes.json();

    if (!runpodRes.ok) {
      await adminClient
        .from("processing_jobs")
        .update({
          status: "failed",
          error_message: `RunPod queue failed: ${JSON.stringify(runpodData)}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({ error: "Failed to queue RunPod analysis job", details: runpodData }),
        { status: 502, headers: corsHeaders }
      );
    }

    // Store analysis job ID so analysis-callback can look it up
    await adminClient
      .from("processing_jobs")
      .update({ analysis_job_id: runpodData.id })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({ queued: true, analysis_job_id: runpodData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
