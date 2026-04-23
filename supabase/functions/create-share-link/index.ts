import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { match_id, file_type, expires_in_days, app_origin } = await req.json();

    if (!match_id || !file_type) {
      return new Response(JSON.stringify({ error: "match_id and file_type required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (!["video", "highlights"].includes(file_type)) {
      return new Response(JSON.stringify({ error: "file_type must be video or highlights" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify ownership
    const { data: match, error: matchErr } = await adminClient
      .from("matches")
      .select("id")
      .eq("id", match_id)
      .eq("user_id", user.id)
      .single();
    if (matchErr || !match) {
      return new Response(JSON.stringify({ error: "Match not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Generate token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const share_token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expires_at = expires_in_days && Number(expires_in_days) > 0
      ? new Date(Date.now() + Number(expires_in_days) * 24 * 3600 * 1000).toISOString()
      : null;

    const { error: insertErr } = await adminClient.from("match_shares").insert({
      match_id,
      created_by: user.id,
      share_token,
      file_type,
      expires_at,
    });

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const origin = (app_origin || req.headers.get("origin") || "").replace(/\/$/, "");
    const url = origin ? `${origin}/share/${share_token}` : `/share/${share_token}`;

    return new Response(
      JSON.stringify({ share_token, url, expires_at }),
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