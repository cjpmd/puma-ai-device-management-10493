import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * trigger-stitching: queues a panoramic stitching job on RunPod when both
 * camera videos for a match have been uploaded to Wasabi.
 *
 * Called automatically by confirm-guest-upload once both sides are present,
 * or manually by authenticated users from the match detail page.
 *
 * RunPod handler receives left + right Wasabi paths and is expected to:
 *   1. Download both MP4s from Wasabi.
 *   2. Perform homography-based stitching (OpenCV / FFmpeg concat fallback).
 *   3. Upload the stitched panoramic to `matches/{matchId}/stitched.mp4`.
 *   4. POST the output path back to the runpod-webhook edge function.
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

    // Auth: Bearer JWT (match owner) OR internal service call (no auth header)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await anonClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const { match_id, session_id } = await req.json();

    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // If called by a user, verify ownership
    if (userId) {
      const { data: match } = await adminClient
        .from("matches")
        .select("id")
        .eq("id", match_id)
        .eq("user_id", userId)
        .single();

      if (!match) {
        return new Response(JSON.stringify({ error: "Match not found" }), {
          status: 404,
          headers: corsHeaders,
        });
      }
    }

    // Fetch both uploaded videos
    const { data: videos } = await adminClient
      .from("match_videos")
      .select("camera_side, wasabi_path, upload_status")
      .eq("match_id", match_id);

    const left = videos?.find((v: any) => v.camera_side === "left" && v.upload_status === "uploaded");
    const right = videos?.find((v: any) => v.camera_side === "right" && v.upload_status === "uploaded");

    if (!left || !right) {
      return new Response(
        JSON.stringify({ error: "Both camera videos must be uploaded before stitching" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const runpodApiKey = Deno.env.get("RUNPOD_API_KEY");
    const runpodEndpointId = Deno.env.get("RUNPOD_STITCH_ENDPOINT_ID") || Deno.env.get("RUNPOD_ENDPOINT_ID");

    if (!runpodApiKey || !runpodEndpointId) {
      return new Response(JSON.stringify({ error: "Stitching pipeline not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const outputPath = `matches/${match_id}/stitched.mp4`;
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/runpod-webhook`;

    const runpodRes = await fetch(`https://api.runpod.ai/v2/${runpodEndpointId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${runpodApiKey}`,
      },
      body: JSON.stringify({
        input: {
          job_type: "stitch",
          left_video: left.wasabi_path,
          right_video: right.wasabi_path,
          output_bucket: Deno.env.get("WASABI_BUCKET"),
          output_path: outputPath,
          match_id,
          session_id: session_id ?? null,
          // 15% horizontal overlap assumed between left and right cameras
          overlap_fraction: 0.15,
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
        JSON.stringify({ error: "RunPod stitching job failed to queue", details: runpodData }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Record the stitch job in video_footage
    await adminClient.from("video_footage").upsert(
      [
        {
          match_id,
          session_id: session_id ?? null,
          camera_role: "left_donor",
          storage_path: left.wasabi_path,
          processing_status: "processing",
        },
        {
          match_id,
          session_id: session_id ?? null,
          camera_role: "right_donor",
          storage_path: right.wasabi_path,
          processing_status: "processing",
        },
      ],
      { onConflict: "match_id,camera_role", ignoreDuplicates: false }
    );

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
