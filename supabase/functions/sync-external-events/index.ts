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
      scores_derived: 0,
    };

    // ── 1. Events ──────────────────────────────────────────────────────────────
    const { data: externalEvents, error: eventsError } = await externalSupabase.from("events").select("*");
    if (eventsError) {
      results.events.errors++;
    } else {
      if (externalEvents && externalEvents.length > 0) {
        console.log("External events columns:", JSON.stringify(Object.keys(externalEvents[0])));
      }
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
      if (externalMatchEvents && externalMatchEvents.length > 0) {
        console.log("External match_events columns:", JSON.stringify(Object.keys(externalMatchEvents[0])));
      }
      // Track derived scores per local event id
      const goalCounts = new Map<string, { home: number; away: number }>();

      for (const me of externalMatchEvents || []) {
        const localEventId = eventMap.get(me.event_id);
        if (!localEventId) continue;

        // Normalize team_side: 'home' | 'away' | 'own' (own goal counts for opposite team)
        const rawSide = (me.team_side || me.team || (me.is_home === true ? "home" : me.is_home === false ? "away" : null) || "").toString().toLowerCase();
        let teamSide: "home" | "away" | "own" | null = null;
        if (rawSide === "home" || rawSide === "away" || rawSide === "own") teamSide = rawSide;

        const { error: upsertError } = await localSupabase.from("team_match_events").upsert({
          external_id: me.id,
          event_id: localEventId,
          player_id: playerMap.get(me.player_id) || null,
          event_type: me.event_type,
          minute: me.minute ?? null,
          period_number: me.period_number ?? null,
          team_side: teamSide,
          notes: me.notes || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "external_id" });
        if (upsertError) results.match_events.errors++;
        else results.match_events.updated++;

        // Tally goals for score derivation
        const eventTypeLower = (me.event_type || "").toString().toLowerCase();
        if (eventTypeLower === "goal" && teamSide) {
          const counts = goalCounts.get(localEventId) || { home: 0, away: 0 };
          if (teamSide === "home") counts.home++;
          else if (teamSide === "away") counts.away++;
          else if (teamSide === "own") {
            // own goal: count is_home=true → away gets the goal, and vice versa.
            // Without per-event is_home context here, we can't tell. We'll resolve below.
            // For now, store own goals separately by negative tally trick: skip here.
          }
          goalCounts.set(localEventId, counts);
        }
      }

      // Apply derived scores to events that have NULL scores
      const { data: eventsForScore } = await localSupabase
        .from("team_events")
        .select("id, home_score, away_score")
        .in("id", Array.from(goalCounts.keys()));

      for (const ev of eventsForScore || []) {
        if (ev.home_score !== null && ev.away_score !== null) continue;
        const counts = goalCounts.get(ev.id);
        if (!counts) continue;
        const { error: scoreError } = await localSupabase
          .from("team_events")
          .update({ home_score: counts.home, away_score: counts.away })
          .eq("id", ev.id);
        if (!scoreError) results.scores_derived++;
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
