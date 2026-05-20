import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * stitch-callback: called by the RunPod stitching worker when a job completes.
 *
 * Expected body:
 *   { job_id, match_id, session_id?, stitched_path, duration_seconds?, success, error? }
 *
 * On success: upserts video_footage row with processing_status='stitched' and stitched_path.
 * On failure: marks the row as 'failed'.
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

    const body = await req.json();
    const { job_id, match_id, session_id, stitched_path, duration_seconds, success, error } = body;

    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (success && stitched_path) {
      await adminClient.from("video_footage").upsert(
        [
          {
            match_id,
            session_id: session_id ?? null,
            camera_role: "stitched" as any,
            storage_path: stitched_path,
            stitched_path,
            duration_seconds: duration_seconds ?? null,
            processing_status: "stitched",
          },
        ],
        { onConflict: "match_id,camera_role", ignoreDuplicates: false }
      );
    } else {
      // Mark donor rows failed so the UI can surface the error
      await adminClient
        .from("video_footage")
        .update({ processing_status: "failed" })
        .eq("match_id", match_id)
        .in("camera_role", ["left_donor", "right_donor"]);
    }

    return new Response(
      JSON.stringify({ ok: true, job_id }),
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
