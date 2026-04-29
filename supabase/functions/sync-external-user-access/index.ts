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

async function tryFetch(externalSupabase: any, table: string, userId: string, userColumn: string) {
  const { data, error } = await externalSupabase.from(table).select("*").eq(userColumn, userId);
  if (error) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { localSupabase, externalSupabase, user } = await getClients(req);
    const results = {
      matched: false,
      user_access: { inserted: 0, updated: 0, errors: 0 },
    };

    if (!user.email) {
      console.warn("sync-external-user-access: local user has no email — cannot match");
      return new Response(
        JSON.stringify({ success: true, message: "User has no email", matched: false, teams_synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let externalUserId: string | null = null;

    // 1. Try profiles table lookup by email.
    const { data: extProfile } = await externalSupabase
      .from("profiles")
      .select("id, user_id, email")
      .eq("email", user.email)
      .maybeSingle();

    if (extProfile) {
      externalUserId = (extProfile.user_id as string) || (extProfile.id as string);
    }

    // 2. Fall back to auth.admin.listUsers if profiles lookup found nothing.
    if (!externalUserId) {
      try {
        const { data: usersList } = await externalSupabase.auth.admin.listUsers();
        const match = usersList?.users?.find(
          (candidate: { email?: string }) => candidate.email === user.email,
        );
        if (match) externalUserId = match.id;
      } catch (error) {
        console.warn(
          "sync-external-user-access: External admin.listUsers not available:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Guard: no matching Football Central user found.
    // Return early — do NOT grant any access to local teams.
    // This replaces the previous fallback that silently granted member access
    // to every team in this database when the email was unrecognised.
    if (!externalUserId) {
      console.warn(
        `sync-external-user-access: No matching Football Central user for email: ${user.email}`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: "No matching Football Central user found",
          matched: false,
          teams_synced: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    results.matched = true;

    // Sync team memberships.
    const teamMemberships =
      (await tryFetch(externalSupabase, "user_teams", externalUserId, "user_id")) ||
      (await tryFetch(externalSupabase, "team_members", externalUserId, "user_id")) ||
      [];

    for (const membership of teamMemberships) {
      const { data: localTeam } = await localSupabase
        .from("teams")
        .select("id")
        .eq("external_id", membership.team_id)
        .maybeSingle();
      if (!localTeam) continue;

      const { error } = await localSupabase.from("user_team_access").upsert(
        {
          user_id: user.id,
          team_id: localTeam.id,
          role: membership.role || "member",
          external_user_id: externalUserId,
          external_team_id: membership.team_id,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,team_id" },
      );
      if (error) results.user_access.errors++;
      else results.user_access.updated++;
    }

    // Sync club memberships.
    const clubMemberships =
      (await tryFetch(externalSupabase, "user_clubs", externalUserId, "user_id")) ||
      (await tryFetch(externalSupabase, "club_members", externalUserId, "user_id")) ||
      [];

    for (const membership of clubMemberships) {
      const { data: localClub } = await localSupabase
        .from("clubs")
        .select("id")
        .eq("external_id", membership.club_id)
        .maybeSingle();
      if (!localClub) continue;

      const { error } = await localSupabase.from("user_club_access").upsert(
        {
          user_id: user.id,
          club_id: localClub.id,
          role: membership.role || "member",
          external_user_id: externalUserId,
          external_club_id: membership.club_id,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,club_id" },
      );
      if (error) results.user_access.errors++;
      else results.user_access.updated++;
    }

    const teams_synced = results.user_access.updated;
    return new Response(
      JSON.stringify({
        success: true,
        message: "User access sync completed",
        matched: true,
        teams_synced,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in sync-external-user-access function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
