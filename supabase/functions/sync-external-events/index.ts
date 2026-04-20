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
      events: { updated: 0, errors: 0 },
      player_stats: { updated: 0, errors: 0 },
      match_events: { updated: 0, errors: 0 },
    };

    // ── 1. Events ──────────────────────────────────────────────────────────────
    const { data: externalEvents, error: eventsError } = await externalSupabase.from("events").select("*");
    if (eventsError) {
      results.events.errors++;
    } else {
      for (const event of externalEvents || []) {
        const { data: localTeam } = await localSupabase.from("teams").select("id").eq("external_id", event.team_id).single();

        const homeScore =
          event.home_score ??
          (event.is_home ? event.our_score : event.opponent_score) ??
          (event.is_home ? event.team_score : event.opponent_score) ??
          null;
        const awayScore =
          event.away_score ??
          (event.is_home ? event.opponent_score : event.our_score) ??
          (event.is_home ? event.opponent_score : event.team_score) ??
          null;

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
          home_score: typeof homeScore === "number" ? homeScore : null,
          away_score: typeof awayScore === "number" ? awayScore : null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "external_id" });
        if (upsertError) results.events.errors++;
        else results.events.updated++;
      }
    }

    // ── Build lookup maps once for player_stats + match_events ────────────────
    const { data: localEventsIndex } = await localSupabase
      .from("team_events")
      .select("id, external_id");
    const eventMap = new Map((localEventsIndex || []).map((e: any) => [e.external_id, e.id]));

    const { data: localPlayersIndex } = await localSupabase
      .from("players")
      .select("id, external_id");
    const playerMap = new Map((localPlayersIndex || []).map((p: any) => [p.external_id, p.id]));

    // ── 2. Event player stats (who played, position, minutes, captain/sub) ────
    const { data: externalPlayerStats, error: playerStatsError } = await externalSupabase
      .from("event_player_stats")
      .select("*");

    if (!playerStatsError) {
      for (const stat of externalPlayerStats || []) {
        const localEventId = eventMap.get(stat.event_id);
        const localPlayerId = playerMap.get(stat.player_id);
        if (!localEventId || !localPlayerId) continue;

        const { error: upsertError } = await localSupabase.from("team_event_player_stats").upsert({
          external_id: stat.id,
          event_id: localEventId,
          player_id: localPlayerId,
          period_number: stat.period_number ?? 1,
          team_number: stat.team_number ?? 1,
          position: stat.position || null,
          minutes_played: stat.minutes_played ?? 0,
          is_captain: stat.is_captain ?? false,
          is_substitute: stat.is_substitute ?? false,
          substitution_time: stat.substitution_time || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "external_id" });
        if (upsertError) results.player_stats.errors++;
        else results.player_stats.updated++;
      }
    } else {
      console.error("Error fetching event_player_stats:", playerStatsError);
      results.player_stats.errors++;
    }

    // ── 3. Match events (goals, cards, subs timeline) ─────────────────────────
    const { data: externalMatchEvents, error: matchEventsError } = await externalSupabase
      .from("match_events")
      .select("*");

    if (!matchEventsError) {
      for (const me of externalMatchEvents || []) {
        const localEventId = eventMap.get(me.event_id);
        if (!localEventId) continue;

        const { error: upsertError } = await localSupabase.from("team_match_events").upsert({
          external_id: me.id,
          event_id: localEventId,
          player_id: playerMap.get(me.player_id) || null,
          event_type: me.event_type,
          minute: me.minute ?? null,
          period_number: me.period_number ?? null,
          notes: me.notes || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "external_id" });
        if (upsertError) results.match_events.errors++;
        else results.match_events.updated++;
      }
    } else {
      console.error("Error fetching match_events:", matchEventsError);
      results.match_events.errors++;
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
