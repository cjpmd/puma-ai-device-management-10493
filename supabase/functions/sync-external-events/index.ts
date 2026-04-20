import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getClients(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing authorization header");
  }

  const localSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await localSupabase.auth.getUser(token);
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const externalSupabase = createClient(
    Deno.env.get("EXTERNAL_SUPABASE_URL")!,
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!,
  );

  return { localSupabase, externalSupabase, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { localSupabase, externalSupabase, user } = await getClients(req);
    console.log(`Starting events sync (user: ${user.email})`);

    const results = {
      events: { inserted: 0, updated: 0, errors: 0 },
    };

    const { data: externalEvents, error } = await externalSupabase.from("events").select("*");
    if (error) {
      results.events.errors++;
    } else {
      for (const event of externalEvents || []) {
        const { data: localTeam } = await localSupabase.from("teams").select("id").eq("external_id", event.team_id).single();
        const { error: upsertError } = await localSupabase.from("team_events").upsert({
          external_id: event.id,
          team_id: localTeam?.id || null,
          title: event.title,
          event_type: event.event_type || "match",
          date: event.date,
          start_time: event.start_time || null,
          end_time: event.end_time || null,
          meeting_time: event.meeting_time || null,
          location: event.location || null,
          opponent: event.opponent || null,
          is_home: event.is_home ?? true,
          game_format: event.game_format || null,
          game_duration: event.game_duration || null,
          notes: event.notes || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "external_id" });
        if (upsertError) results.events.errors++;
        else results.events.updated++;
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Events sync completed", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in sync-external-events function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});