import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public endpoint — validates a token and returns match info for guest capture page
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow, error } = await adminClient
      .from("upload_tokens")
      .select("*, matches(title, match_date, location)")
      .eq("token", token)
      .single();

    if (error || !tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 404, headers: corsHeaders });
    }

    if (tokenRow.used) {
      return new Response(JSON.stringify({ error: "Token already used" }), { status: 410, headers: corsHeaders });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Token expired" }), { status: 410, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({
        match_id: tokenRow.match_id,
        camera_side: tokenRow.camera_side,
        expires_at: tokenRow.expires_at,
        match_title: tokenRow.matches?.title || "Untitled Match",
        match_date: tokenRow.matches?.match_date,
        match_location: tokenRow.matches?.location,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
