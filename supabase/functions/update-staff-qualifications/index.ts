import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_BG_TYPES = new Set(["dbs", "pvg", "accessni"]);
const MANAGER_ROLES = new Set(["head_coach", "academy_manager", "admin"]);

// Whitelisted columns the caller can update on profiles
const ALLOWED_FIELDS = new Set([
  "uefa_licence",
  "fa_safeguarding_expiry",
  "first_aid_expiry",
  "dbs_expiry",
  "pvg_expiry",
  "accessni_expiry",
  "background_check_type",
]);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { user_id, academy_id, updates } = body ?? {};
    if (!user_id || !updates || typeof updates !== "object") {
      return json({ error: "user_id and updates are required" }, 400);
    }

    // Authorisation: self, or manager in the supplied academy
    const isSelf = user.id === user_id;
    if (!isSelf) {
      if (!academy_id) return json({ error: "academy_id required when editing another user" }, 400);
      const { data: hasAccess } = await admin.rpc("user_has_academy_access", {
        _user_id: user.id, _academy_id: academy_id,
      });
      if (!hasAccess) return json({ error: "Forbidden" }, 403);
      const { data: callerRow } = await admin
        .from("user_academies")
        .select("role")
        .eq("academy_id", academy_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!callerRow || !MANAGER_ROLES.has(callerRow.role)) {
        return json({ error: "Insufficient permissions" }, 403);
      }
      // Ensure target user actually belongs to this academy
      const { data: targetRow } = await admin
        .from("user_academies")
        .select("user_id")
        .eq("academy_id", academy_id)
        .eq("user_id", user_id)
        .maybeSingle();
      if (!targetRow) return json({ error: "Target user not in this academy" }, 404);
    }

    // Build sanitised patch
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (!ALLOWED_FIELDS.has(k)) continue;
      if (k === "background_check_type") {
        if (v === null || v === "") patch[k] = null;
        else if (typeof v === "string" && ALLOWED_BG_TYPES.has(v)) patch[k] = v;
        else return json({ error: `Invalid background_check_type: ${v}` }, 400);
      } else {
        patch[k] = v === "" ? null : v;
      }
    }
    if (Object.keys(patch).length === 0) return json({ error: "No valid fields to update" }, 400);

    const { data: updated, error: updErr } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", user_id)
      .select("id, full_name, email, uefa_licence, fa_safeguarding_expiry, first_aid_expiry, dbs_expiry, pvg_expiry, accessni_expiry, background_check_type")
      .maybeSingle();
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, profile: updated });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});