import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Public endpoint — marks upload as complete and token as used
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { upload_token, match_id, camera_side, file_size } = await req.json();

    if (!upload_token || !match_id || !camera_side) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token
    const { data: tokenRow, error: tokenError } = await adminClient
      .from("upload_tokens")
      .select("*")
      .eq("token", upload_token)
      .eq("match_id", match_id)
      .eq("camera_side", camera_side)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Token expired" }), { status: 410, headers: corsHeaders });
    }

    // Mark video as uploaded
    await adminClient
      .from("match_videos")
      .update({ upload_status: "uploaded", file_size: file_size || null })
      .eq("match_id", match_id)
      .eq("camera_side", camera_side);

    // Mark token as used
    await adminClient
      .from("upload_tokens")
      .update({ used: true })
      .eq("id", tokenRow.id);

    // Check if both videos are uploaded, update match status
    const { data: videos } = await adminClient
      .from("match_videos")
      .select("camera_side, upload_status")
      .eq("match_id", match_id);

    const leftDone = videos?.find(v => v.camera_side === "left")?.upload_status === "uploaded";
    const rightDone = videos?.find(v => v.camera_side === "right")?.upload_status === "uploaded";

    if (leftDone && rightDone) {
      await adminClient.from("matches").update({ status: "uploaded" }).eq("id", match_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
