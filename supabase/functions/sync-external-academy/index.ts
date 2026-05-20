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
      user_academies: { fetched: 0, head_matched: 0, auto_granted: 0 },
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
    //   Derive academy↔club pairs from THREE possible FC schemas:
    //     (a) academy_clubs join table
    //     (b) academies.club_id column
    //     (c) clubs.academy_id column
    //   We try all three so the link works regardless of how FC models it.
    const pairs: { academy_ext: string; club_ext: string }[] = [];

    // (a) join table
    const { data: academyClubs, error: linkErr } = await externalSupabase
      .from("academy_clubs")
      .select("academy_id, club_id");
    if (linkErr) console.warn("FC academy_clubs unavailable:", linkErr.message);
    for (const link of academyClubs || []) {
      pairs.push({ academy_ext: link.academy_id, club_ext: link.club_id });
    }

    // (b) academies.club_id (re-fetch with that column; tolerate failure)
    const { data: acsWithClub, error: acsErr } = await externalSupabase
      .from("academies")
      .select("id, club_id");
    if (acsErr) {
      console.warn("FC academies.club_id unavailable:", acsErr.message);
    } else {
      for (const a of acsWithClub || []) {
        if (a.club_id) pairs.push({ academy_ext: a.id, club_ext: a.club_id });
      }
    }

    // (c) clubs.academy_id
    const { data: clubsWithAcademy, error: clubsErr } = await externalSupabase
      .from("clubs")
      .select("id, academy_id");
    if (clubsErr) {
      console.warn("FC clubs.academy_id unavailable:", clubsErr.message);
    } else {
      for (const c of clubsWithAcademy || []) {
        if (c.academy_id) pairs.push({ academy_ext: c.academy_id, club_ext: c.id });
      }
    }

    const seen = new Set<string>();
    for (const p of pairs) {
      const key = `${p.academy_ext}:${p.club_ext}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const { data: localAcademy } = await localSupabase
        .from("academies").select("id").eq("external_id", p.academy_ext).maybeSingle();
      if (!localAcademy) {
        console.log(`skip: no local academy for external_id=${p.academy_ext}`);
        continue;
      }

      const { error: updateErr, count } = await localSupabase
        .from("clubs")
        .update({ academy_id: localAcademy.id }, { count: "exact" })
        .eq("external_id", p.club_ext);
      if (updateErr) {
        console.error("link update failed:", updateErr.message);
      } else if ((count ?? 0) > 0) {
        results.clubs_linked++;
      } else {
        console.log(`skip: no local club for external_id=${p.club_ext}`);
      }
    }

    // ── 3b. Name-match fallback ─────────────────────────────────────────────
    //   For any local academy still not referenced by a local club, try to
    //   link by name: "Dundee FC Academy" ↔ "Dundee FC".
    const { data: allAcademies } = await localSupabase
      .from("academies").select("id, name");
    const { data: allClubs } = await localSupabase
      .from("clubs").select("id, name, academy_id");
    const linkedAcademyIds = new Set(
      (allClubs || []).map(c => c.academy_id).filter(Boolean) as string[],
    );
    const norm = (s: string) =>
      (s || "").toLowerCase().replace(/\s+academy$/, "").trim();
    for (const a of allAcademies || []) {
      if (linkedAcademyIds.has(a.id)) continue;
      const aKey = norm(a.name);
      if (!aKey) continue;
      const match = (allClubs || []).find(c => !c.academy_id && norm(c.name) === aKey);
      if (!match) {
        console.log(`name-match: no club for academy "${a.name}"`);
        continue;
      }
      const { error: linkErr } = await localSupabase
        .from("clubs").update({ academy_id: a.id }).eq("id", match.id);
      if (linkErr) {
        console.error(`name-match link failed for ${match.name}:`, linkErr.message);
      } else {
        console.log(`name-match: linked club "${match.name}" → academy "${a.name}"`);
        match.academy_id = a.id;
        linkedAcademyIds.add(a.id);
        results.clubs_linked++;
      }
    }

    // ── 3c. Auto-grant user_academies from club access ──────────────────────
    //   Anyone with access to a club that is now linked to an academy should
    //   also have a user_academies row, so the academy view appears in their
    //   picker.
    const linkedClubs = (allClubs || []).filter(c => c.academy_id);
    if (linkedClubs.length > 0) {
      const { data: clubAccessRows } = await localSupabase
        .from("user_club_access")
        .select("user_id, club_id")
        .in("club_id", linkedClubs.map(c => c.id));
      const clubToAcademy = new Map(linkedClubs.map(c => [c.id, c.academy_id as string]));
      const seen = new Set<string>();
      for (const row of clubAccessRows || []) {
        const academyId = clubToAcademy.get(row.club_id);
        if (!academyId) continue;
        const key = `${row.user_id}:${academyId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { error: insErr, count } = await localSupabase
          .from("user_academies")
          .upsert(
            { user_id: row.user_id, academy_id: academyId, role: "member" },
            { onConflict: "user_id,academy_id", ignoreDuplicates: true, count: "exact" },
          );
        if (insErr) {
          console.warn(`auto_grant failed for ${row.user_id}:`, insErr.message);
        } else if ((count ?? 0) > 0) {
          results.user_academies.auto_granted++;
        }
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
