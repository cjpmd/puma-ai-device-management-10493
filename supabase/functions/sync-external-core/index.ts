import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ATTR_KEYS = new Set([
  "corners", "crossing", "dribbling", "finishing", "first_touch", "free_kicks", "heading",
  "long_shots", "long_throws", "marking", "passing", "penalties", "tackling", "technique",
  "aggression", "anticipation", "bravery", "composure", "concentration", "decisions",
  "determination", "flair", "leadership", "off_the_ball", "positioning", "teamwork", "vision", "work_rate",
  "acceleration", "agility", "balance", "jumping", "natural_fitness", "pace", "stamina", "strength",
  "aerial_reach", "command_of_area", "communication", "cross_handling", "distribution",
  "eccentricity", "footwork", "handling", "kicking", "one_on_one", "punching", "reflexes",
  "rushing_out", "shot_stopping", "throwing",
]);

const ATTR_ALIASES = {
  shooting: "finishing",
  shotstopping: "shot_stopping",
};

function normaliseAttrKey(raw: string) {
  const normalized = raw.toLowerCase().trim()
    .replace(/[']/g, "")
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (ATTR_KEYS.has(normalized)) return normalized;
  return ATTR_ALIASES[normalized as keyof typeof ATTR_ALIASES] || null;
}

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
    let entity = "all";

    try {
      const body = await req.json();
      if (body?.entity) entity = body.entity;
    } catch {
      // no body
    }

    if (!["all", "clubs", "teams", "players", "attributes"].includes(entity)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid entity" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting core sync for entity: ${entity} (user: ${user.email})`);

    const results = {
      clubs: { inserted: 0, updated: 0, errors: 0 },
      teams: { inserted: 0, updated: 0, errors: 0 },
      players: { inserted: 0, updated: 0, errors: 0 },
      attributes: { inserted: 0, updated: 0, errors: 0 },
    };

    if (entity === "clubs" || entity === "all") {
      const { data: externalClubs, error } = await externalSupabase.from("clubs").select("*");
      if (error) {
        console.error("Error fetching clubs:", error);
        results.clubs.errors++;
      } else {
        for (const club of externalClubs || []) {
          const { error: upsertError } = await localSupabase.from("clubs").upsert({
            external_id: club.id,
            name: club.name,
            logo_url: club.logo_url || null,
            synced_at: new Date().toISOString(),
          }, { onConflict: "external_id" });
          if (upsertError) results.clubs.errors++;
          else results.clubs.updated++;
        }
      }
    }

    if (entity === "teams" || entity === "all") {
      const { data: externalTeams, error } = await externalSupabase.from("teams").select("*");
      if (error) {
        results.teams.errors++;
      } else {
        for (const team of externalTeams || []) {
          const { data: localClub } = await localSupabase.from("clubs").select("id").eq("external_id", team.club_id).single();
          const { error: upsertError } = await localSupabase.from("teams").upsert({
            external_id: team.id,
            name: team.name,
            club_id: localClub?.id || null,
            age_group: team.age_group || null,
            game_format: team.game_format || null,
            logo_url: team.logo_url || null,
            synced_at: new Date().toISOString(),
          }, { onConflict: "external_id" });
          if (upsertError) results.teams.errors++;
          else results.teams.updated++;
        }
      }
    }

    if (entity === "players" || entity === "attributes" || entity === "all") {
      const { data: externalPlayers, error } = await externalSupabase.from("players").select("*");
      if (error) {
        results.players.errors++;
      } else {
        for (const player of externalPlayers || []) {
          const { data: localTeam } = await localSupabase
            .from("teams")
            .select("id, club_id")
            .eq("external_id", player.team_id)
            .single();

          const { data: upsertedPlayer, error: playerError } = await localSupabase
            .from("players")
            .upsert({
              external_id: player.id,
              name: player.name,
              team_id: localTeam?.id || null,
              club_id: localTeam?.club_id || null,
              position: player.play_style || player.position || null,
              player_type: player.type || player.player_type || null,
              squad_number: player.squad_number,
              date_of_birth: player.date_of_birth || null,
              availability: player.availability || null,
              expected_return_date: player.expected_return_date || player.return_date || null,
              photo_url: player.photo_url || null,
              synced_at: new Date().toISOString(),
            }, { onConflict: "external_id" })
            .select("id")
            .single();

          if (playerError) {
            results.players.errors++;
            continue;
          }

          results.players.updated++;

          const rawAttrs = player.attributes;
          if (!upsertedPlayer || !Array.isArray(rawAttrs) || rawAttrs.length === 0) {
            continue;
          }

          const flat: Record<string, number> = {};
          for (const attr of rawAttrs) {
            if (!attr || typeof attr !== "object") continue;
            const value = Number(attr.value);
            if (!Number.isFinite(value) || attr.enabled === false) continue;
            const key = normaliseAttrKey(String(attr.name || "")) || normaliseAttrKey(String(attr.id || ""));
            if (!key) continue;
            flat[key] = Math.max(1, Math.min(20, Math.round(value)));
          }

          if (Object.keys(flat).length === 0) {
            results.attributes.errors++;
            continue;
          }

          const { error: attrError } = await localSupabase.from("player_attributes").upsert({
            player_id: upsertedPlayer.id,
            external_id: player.id,
            ...flat,
            synced_at: new Date().toISOString(),
          }, { onConflict: "player_id" });

          if (attrError) results.attributes.errors++;
          else results.attributes.updated++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Core sync completed", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in sync-external-core function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});