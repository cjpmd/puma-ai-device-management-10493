import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert grassroots football coach analysing a youth/amateur match.
You receive structured statistics derived from automated video analysis (no professional datasets).
Be concise, plain-English, and explainable. Avoid jargon. Focus on what the coach can act on next session.
Never invent stats — only reason from the numbers given.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "match_insights",
    description: "Structured coaching insights for a single match.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "1 short paragraph (60-100 words) on why the match unfolded as it did.",
        },
        team_strengths: {
          type: "array",
          items: { type: "string" },
          description: "Exactly 3 strengths shown in the data.",
        },
        team_weaknesses: {
          type: "array",
          items: { type: "string" },
          description: "Exactly 3 weaknesses shown in the data.",
        },
        top_performers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              track_id: { type: "integer" },
              reason: { type: "string" },
            },
            required: ["track_id", "reason"],
            additionalProperties: false,
          },
          description: "Top 3 players (by track_id) with a one-sentence reason.",
        },
        coaching_focus: {
          type: "array",
          items: { type: "string" },
          description: "2 actionable training focuses for next session.",
        },
      },
      required: ["summary", "team_strengths", "team_weaknesses", "top_performers", "coaching_focus"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), { status: 400, headers: corsHeaders });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Latest job for this match
    const { data: jobs } = await admin
      .from("processing_jobs")
      .select("team_metrics, player_metrics, divergence_metrics, event_data")
      .eq("match_id", match_id)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1);

    const job = jobs?.[0];
    if (!job?.team_metrics) {
      return new Response(JSON.stringify({ error: "No completed job with metrics" }), { status: 404, headers: corsHeaders });
    }

    // Mark pending
    await admin.from("match_insights").upsert({
      match_id,
      status: "generating",
      error: null,
    }, { onConflict: "match_id" });

    // Trim event_data for prompt size
    const events = (job.event_data?.events || []).slice(0, 80);
    const userPayload = {
      team_metrics: job.team_metrics,
      player_metrics: job.player_metrics,
      divergence_metrics: job.divergence_metrics,
      event_count: (job.event_data?.events || []).length,
      sample_events: events,
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Match data:\n\`\`\`json\n${JSON.stringify(userPayload, null, 2)}\n\`\`\`` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "match_insights" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      const msg = aiResp.status === 429
        ? "Rate limit exceeded. Please try again shortly."
        : aiResp.status === 402
          ? "AI credits exhausted. Add credits in workspace settings."
          : `AI error: ${aiResp.status}`;
      await admin.from("match_insights").upsert({
        match_id, status: "failed", error: msg,
      }, { onConflict: "match_id" });
      return new Response(JSON.stringify({ error: msg }), { status: aiResp.status, headers: corsHeaders });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI returned no structured output");
    }
    const insights = JSON.parse(toolCall.function.arguments);

    await admin.from("match_insights").upsert({
      match_id,
      status: "complete",
      summary: insights.summary,
      team_strengths: insights.team_strengths,
      team_weaknesses: insights.team_weaknesses,
      top_performers: insights.top_performers,
      coaching_focus: insights.coaching_focus,
      error: null,
    }, { onConflict: "match_id" });

    return new Response(JSON.stringify({ ok: true, insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-match-insights error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500, headers: corsHeaders,
    });
  }
});
