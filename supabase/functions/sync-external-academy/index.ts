import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getClients(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization header");

  const localSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await localSupabase.auth.getUser(token);
  if (authError || !user) throw new Error("Unauthorized");

  const externalSupabase = createClient(
    Deno.env.get("EXTERNAL_SUPABASE_URL")!,
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!,
  );

  return { localSupabase, externalSupabase, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { localSupabase, externalSupabase, user } = await getClients(req);
    console.log(`Starting academy sync (user: ${user.email})`);

    const results = {
      academies: { updated: 0, errors: 0 },
      clubs_linked: 0,
      user_academies: { fetched: 0, head_matched: 0 },
    };

    // ── 1. Fetch academies from FC ──────────────────────────────────────────
    const { data: externalAcademies, error: acErr } = await externalSupabase
      .from("academies")
      .select("id, name, logo_url, fa_registration_number, eppp_category, founded_year");

    if (acErr) {
      console.error("Error fetching academies from FC:", acErr);
      return new Response(JSON.stringify({ success: false, error: acErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Upsert academies locally ─────────────────────────────────────────
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

    // ── 3. Fetch academy_clubs from FC and link local clubs ─────────────────
    const { data: academyClubs, error: linkErr } = await externalSupabase
      .from("academy_clubs")
      .select("academy_id, club_id");

    if (linkErr) {
      console.error("Error fetching academy_clubs:", linkErr);
    } else {
      for (const link of academyClubs || []) {
        const { data: localAcademy } = await localSupabase
          .from("academies").select("id").eq("external_id", link.academy_id).single();
        if (!localAcademy) continue;

        const { error: updateErr } = await localSupabase
          .from("clubs").update({ academy_id: localAcademy.id }).eq("external_id", link.club_id);
        if (!updateErr) results.clubs_linked++;
      }
    }

    // ── 4. Fetch user_academies from FC (with profile email for matching) ───
    //
    // user_academies links FC user IDs to academies. We fetch this data to:
    //   a) report academy membership counts
    //   b) attempt to match academy_admin users to local Performance accounts
    //      by email, then record the head_of_academy on the local academy row.
    const { data: fcUserAcademies, error: uaErr } = await externalSupabase
      .from("user_academies")
      .select("academy_id, user_id, role, profiles!inner(email)");

    if (uaErr) {
      console.warn("Could not fetch user_academies from FC (non-fatal):", uaErr.message);
    } else {
      results.user_academies.fetched = (fcUserAcademies || []).length;

      // For each academy_admin entry, try to find the matching local user by
      // email and record them on the local academy row.
      for (const ua of (fcUserAcademies || []).filter((r: any) => r.role === "academy_admin")) {
        const email: string | undefined = (ua as any).profiles?.email;
        if (!email) continue;

        const { data: localUser } = await localSupabase
          .from("profiles").select("id").ilike("email", email).maybeSingle();
        if (!localUser) continue;

        const { data: localAcademy } = await localSupabase
          .from("academies").select("id").eq("external_id", ua.academy_id).single();
        if (!localAcademy) continue;

        // Store the matched local user as head_of_academy on the Performance academy
        await localSupabase
          .from("academies")
          .update({ head_of_academy_user_id: localUser.id })
          .eq("id", localAcademy.id);

        results.user_academies.head_matched++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Academy sync completed", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in sync-external-academy:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
