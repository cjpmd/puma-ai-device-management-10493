import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * extract-clip: queues a clip extraction job on RunPod.
 *
 * Body: { match_id, start_sec, end_sec, label? }
 *
 * The RunPod worker downloads the stitched (or processed) MP4, trims the segment
 * using FFmpeg, uploads the clip to `matches/{matchId}/clips/{start}-{end}.mp4`,
 * and POSTs back to stitch-callback (reusing the same webhook pattern).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth required
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { match_id, start_sec, end_sec, label } = await req.json();

    if (!match_id || start_sec == null || end_sec == null) {
      return new Response(JSON.stringify({ error: "match_id, start_sec and end_sec required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (end_sec <= start_sec) {
      return new Response(JSON.stringify({ error: "end_sec must be greater than start_sec" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Verify ownership
    const { data: match } = await adminClient
      .from("matches")
      .select("id")
      .eq("id", match_id)
      .eq("user_id", user.id)
      .single();

    if (!match) {
      return new Response(JSON.stringify({ error: "Match not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Find source video — prefer stitched
    const { data: footage } = await adminClient
      .from("video_footage")
      .select("stitched_path, storage_path, processing_status")
      .eq("match_id", match_id)
      .order("created_at", { ascending: false });

    const stitchedRow = footage?.find((f: any) => f.processing_status === "stitched" && f.stitched_path);
    const sourceRow = stitchedRow || footage?.find((f: any) => f.storage_path);

    // Fall back to match_videos if no video_footage rows exist
    let sourcePath = stitchedRow?.stitched_path || sourceRow?.storage_path || null;

    if (!sourcePath) {
      // Check processing_jobs for output_video_path
      const { data: pj } = await adminClient
        .from("processing_jobs")
        .select("output_video_path")
        .eq("match_id", match_id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      sourcePath = pj?.output_video_path || null;
    }

    if (!sourcePath) {
      return new Response(JSON.stringify({ error: "No source video available for clipping" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const runpodApiKey = Deno.env.get("RUNPOD_API_KEY");
    const runpodEndpointId = Deno.env.get("RUNPOD_STITCH_ENDPOINT_ID") || Deno.env.get("RUNPOD_ENDPOINT_ID");

    if (!runpodApiKey || !runpodEndpointId) {
      return new Response(JSON.stringify({ error: "RunPod not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const startStr = String(Math.round(start_sec));
    const endStr = String(Math.round(end_sec));
    const outputPath = `matches/${match_id}/clips/${startStr}-${endStr}.mp4`;
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/stitch-callback`;

    // Create a video_footage placeholder so the UI can track progress
    await adminClient.from("video_footage").insert({
      match_id,
      session_id: null,
      camera_role: null,
      storage_path: outputPath,
      processing_status: "processing",
    });

    const runpodRes = await fetch(`https://api.runpod.ai/v2/${runpodEndpointId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${runpodApiKey}`,
      },
      body: JSON.stringify({
        input: {
          job_type: "extract_clip",
          source_path: sourcePath,
          start_sec,
          end_sec,
          output_bucket: Deno.env.get("WASABI_BUCKET"),
          output_path: outputPath,
          match_id,
          label: label ?? null,
          webhook_url: webhookUrl,
          wasabi_access_key: Deno.env.get("WASABI_ACCESS_KEY"),
          wasabi_secret_key: Deno.env.get("WASABI_SECRET_KEY"),
          wasabi_region: Deno.env.get("WASABI_REGION"),
          wasabi_endpoint: Deno.env.get("WASABI_ENDPOINT"),
        },
      }),
    });

    const runpodData = await runpodRes.json();

    if (!runpodRes.ok) {
      return new Response(
        JSON.stringify({ error: "RunPod clip job failed to queue", details: runpodData }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ job_id: runpodData.id, status: "queued", output_path: outputPath }),
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
