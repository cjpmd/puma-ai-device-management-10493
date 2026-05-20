import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set([
  "head_coach", "coach", "assistant_coach", "academy_manager",
  "physio", "sports_scientist", "analyst", "scout",
  "welfare_officer", "admin", "other",
]);

const CALLER_ALLOWED = new Set(["head_coach", "academy_manager", "admin"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { academy_id, user_id, role } = body ?? {};
    if (!academy_id || !user_id || !role) {
      return json({ error: "academy_id, user_id and role are required" }, 400);
    }
    if (!ALLOWED_ROLES.has(role)) {
      return json({ error: "Invalid role" }, 400);
    }

    const { data: hasAccess } = await admin.rpc("user_has_academy_access", {
      _user_id: user.id, _academy_id: academy_id,
    });
    if (!hasAccess) return json({ error: "Forbidden" }, 403);

    // Confirm caller's own role in this academy allows management
    const { data: callerRow } = await admin
      .from("user_academies")
      .select("role")
      .eq("academy_id", academy_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!callerRow || !CALLER_ALLOWED.has(callerRow.role)) {
      return json({ error: "Insufficient permissions to change roles" }, 403);
    }

    const { data: updated, error: updErr } = await admin
      .from("user_academies")
      .update({ role, external_role_synced_at: null })
      .eq("academy_id", academy_id)
      .eq("user_id", user_id)
      .select("user_id, role, external_role, external_role_synced_at")
      .maybeSingle();
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, member: updated });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}