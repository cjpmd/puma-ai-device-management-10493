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
    console.log(`Starting academy sync (user: ${user.email})`);

    const results = {
      academies: { updated: 0, errors: 0 },
      clubs_linked: 0,
    };

    // 1. Fetch all academies from FC
    const { data: externalAcademies, error: acErr } = await externalSupabase
      .from("academies")
      .select("id, name, logo_url, fa_registration_number, eppp_category, founded_year");

    if (acErr) {
      console.error("Error fetching academies from FC:", acErr);
      return new Response(JSON.stringify({ success: false, error: acErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Upsert each academy locally
    for (const academy of externalAcademies || []) {
      const { error: upsertErr } = await localSupabase.from("academies").upsert({
        external_id: academy.id,
        name: academy.name,
        logo_url: academy.logo_url || null,
        fa_registration_number: academy.fa_registration_number || null,
        eppp_category: academy.eppp_category || null,
        founded_year: academy.founded_year || null,
        synced_at: new Date().toISOString(),
      }, { onConflict: "external_id" });

      if (upsertErr) {
        console.error("Error upserting academy:", upsertErr);
        results.academies.errors++;
      } else {
        results.academies.updated++;
      }
    }

    // 3. Fetch academy_clubs links from FC
    const { data: academyClubs, error: linkErr } = await externalSupabase
      .from("academy_clubs")
      .select("academy_id, club_id");

    if (linkErr) {
      console.error("Error fetching academy_clubs from FC:", linkErr);
    } else {
      for (const link of academyClubs || []) {
        const { data: localAcademy } = await localSupabase
          .from("academies")
          .select("id")
          .eq("external_id", link.academy_id)
          .single();

        if (!localAcademy) continue;

        const { error: updateErr } = await localSupabase
          .from("clubs")
          .update({ academy_id: localAcademy.id })
          .eq("external_id", link.club_id);

        if (!updateErr) results.clubs_linked++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Academy sync completed", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in sync-external-academy:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
