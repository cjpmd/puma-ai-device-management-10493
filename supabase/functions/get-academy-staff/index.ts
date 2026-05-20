import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { academy_id } = await req.json().catch(() => ({}));
    if (!academy_id) {
      return new Response(JSON.stringify({ error: "academy_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm caller has access to this academy
    const { data: hasAccess } = await admin.rpc("user_has_academy_access", {
      _user_id: user.id, _academy_id: academy_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: members } = await admin
      .from("user_academies")
      .select("user_id, role, created_at, external_role, external_role_synced_at")
      .eq("academy_id", academy_id);

    const userIds = (members || []).map((m: any) => m.user_id);
    const { data: profiles } = userIds.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] };

    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
    const staff = (members || []).map((m: any) => {
      const p: any = profileById.get(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        external_role: m.external_role ?? null,
        external_role_synced_at: m.external_role_synced_at ?? null,
      };
    });

    return new Response(JSON.stringify({ staff }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});