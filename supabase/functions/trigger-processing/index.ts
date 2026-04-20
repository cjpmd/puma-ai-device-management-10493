import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const userId = user.id;

    const { match_id, gpu_type, config } = await req.json();

    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify ownership
    const { data: match, error: matchErr } = await adminClient
      .from("matches")
      .select("id, user_id")
      .eq("id", match_id)
      .single();

    if (matchErr || !match || match.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: corsHeaders });
    }

    // Get both video paths
    const { data: videos } = await adminClient
      .from("match_videos")
      .select("camera_side, wasabi_path, upload_status")
      .eq("match_id", match_id);

    const leftVideo = videos?.find((v: any) => v.camera_side === "left" && v.upload_status === "uploaded");
    const rightVideo = videos?.find((v: any) => v.camera_side === "right" && v.upload_status === "uploaded");

    if (!leftVideo || !rightVideo) {
      return new Response(JSON.stringify({ error: "Both camera uploads must be complete" }), { status: 400, headers: corsHeaders });
    }

    const runpodApiKey = Deno.env.get("RUNPOD_API_KEY");
    const runpodEndpointId = Deno.env.get("RUNPOD_ENDPOINT_ID");

    if (!runpodApiKey || !runpodEndpointId) {
      return new Response(JSON.stringify({ error: "Processing not configured" }), { status: 500, headers: corsHeaders });
    }

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/runpod-webhook`;

    // Processing config with defaults
    const processingConfig = {
      output_resolution: config?.output_resolution || "1920x1080",
      follow_mode: config?.follow_mode || "ball",       // ball | player | auto
      zoom_level: config?.zoom_level || 1.5,
      smooth_factor: config?.smooth_factor || 0.85,
      output_fps: config?.output_fps || 30,
    };

    // Call RunPod serverless API
    const runpodResponse = await fetch(`https://api.runpod.ai/v2/${runpodEndpointId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${runpodApiKey}`,
      },
      body: JSON.stringify({
        input: {
          left_video: leftVideo.wasabi_path,
          right_video: rightVideo.wasabi_path,
          output_bucket: Deno.env.get("WASABI_BUCKET"),
          match_id,
          webhook_url: webhookUrl,
          config: processingConfig,
          // Wasabi credentials for the handler to download/upload
          wasabi_access_key: Deno.env.get("WASABI_ACCESS_KEY"),
          wasabi_secret_key: Deno.env.get("WASABI_SECRET_KEY"),
          wasabi_region: Deno.env.get("WASABI_REGION"),
          wasabi_endpoint: Deno.env.get("WASABI_ENDPOINT"),
        },
      }),
    });

    const runpodData = await runpodResponse.json();

    if (!runpodResponse.ok) {
      await adminClient.from("matches").update({ status: "failed" }).eq("id", match_id);
      return new Response(JSON.stringify({ error: "RunPod API error", details: runpodData }), { status: 500, headers: corsHeaders });
    }

    // Create processing job
    await adminClient.from("processing_jobs").insert({
      match_id,
      runpod_job_id: runpodData.id,
      status: "running",
      started_at: new Date().toISOString(),
      gpu_type: gpu_type || "default",
    });

    await adminClient.from("matches").update({ status: "processing" }).eq("id", match_id);

    return new Response(
      JSON.stringify({ job_id: runpodData.id, status: "running" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
