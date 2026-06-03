import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * analysis-callback: RunPod webhook called when an analysis job completes.
 *
 * RunPod payload: { id: "<runpod-job-id>", status: "COMPLETED"|"FAILED", output: {...} }
 *
 * Lookup: processing_jobs WHERE runpod_job_id = payload.id
 * On success: status = 'completed', event_data = raw output + structured fields
 * On failure: status = 'failed', error_message set
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CV_EVENT_TYPE_MAP: Record<string, string> = {
  shot: "key_moment",
  goal: "goal",
  pass: "key_moment",
  tackle: "key_moment",
  possession_change: "key_moment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("analysis-callback received:", JSON.stringify(body).slice(0, 500));

    // RunPod webhook shape: { id, status, output }
    const { id: runpodJobId, status, output } = body;

    if (!runpodJobId) {
      return new Response(JSON.stringify({ error: "Missing RunPod job id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Primary lookup: runpod_job_id (set by process-video when queuing)
    let job: { id: string; match_id: string } | null = null;

    const { data: byRunpodId } = await adminClient
      .from("processing_jobs")
      .select("id, match_id")
      .eq("runpod_job_id", runpodJobId)
      .maybeSingle();
    job = byRunpodId;

    // Fallback: analysis_job_id (same value, older rows may only have this)
    if (!job) {
      const { data: byAnalysisId } = await adminClient
        .from("processing_jobs")
        .select("id, match_id")
        .eq("analysis_job_id", runpodJobId)
        .maybeSingle();
      job = byAnalysisId;
    }

    // Final fallback: job_id embedded in output body
    if (!job && output?.job_id) {
      const { data: byJobId } = await adminClient
        .from("processing_jobs")
        .select("id, match_id")
        .eq("id", output.job_id)
        .maybeSingle();
      job = byJobId;
    }

    if (!job) {
      console.error("analysis-callback: job not found for RunPod id", runpodJobId);
      return new Response(JSON.stringify({ ok: false, reason: "job not found" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const isComplete = status === "COMPLETED";
    const isFailed = status === "FAILED" || (!isComplete && status !== "IN_PROGRESS");

    if (isComplete && output) {
      const update: Record<string, unknown> = {
        status: "completed",
        completed_at: new Date().toISOString(),
        // Raw output stored in event_data for full result inspection
        event_data: output,
        // Structured fields for app features
        player_metrics: output.player_metrics ?? null,
        team_metrics: output.team_stats ?? output.team_metrics ?? null,
        heatmaps: output.heatmaps ?? null,
        ball_tracking_data: output.ball_tracking ?? null,
        divergence_metrics: {
          confidence_score: output.confidence_score ?? null,
          duration_seconds: output.duration_seconds ?? null,
          processed_at: output.processed_at ?? null,
        },
      };

      await adminClient
        .from("processing_jobs")
        .update(update)
        .eq("id", job.id);

      // Upsert high-confidence CV events into match_event_tags
      const highConfEvents = (output.events ?? []).filter(
        (e: any) => e.source === "cv" && (e.confidence ?? 0) >= 0.70
      );

      if (highConfEvents.length > 0 && output.session_id) {
        const tags = highConfEvents
          .map((e: any) => {
            const mappedType = CV_EVENT_TYPE_MAP[e.type];
            if (!mappedType) return null;
            return {
              match_id: job!.match_id,
              session_id: output.session_id,
              event_type: mappedType,
              timestamp_ms: Math.round((e.time ?? 0) * 1000),
              tagged_by: "cv_analysis",
              notes: `Auto-detected ${e.type}${e.outcome ? ` (${e.outcome})` : ""}${
                e.confidence != null
                  ? ` — confidence ${Math.round(e.confidence * 100)}%`
                  : ""
              }`,
            };
          })
          .filter(Boolean);

        if (tags.length > 0) {
          await adminClient
            .from("match_event_tags")
            .upsert(tags as any[], {
              onConflict: "match_id,session_id,event_type,timestamp_ms",
              ignoreDuplicates: true,
            });
        }
      }

      // Upsert player_match_stats
      const playerMetrics: Record<string, any> = output.player_metrics ?? {};
      if (Object.keys(playerMetrics).length > 0) {
        const statsRows = Object.entries(playerMetrics).map(([trackIdStr, pm]: [string, any]) => ({
          match_id:               job!.match_id,
          processing_job_id:      job!.id,
          track_id:               Number(trackIdStr),
          team:                   pm.team ?? null,
          distance_m:             pm.distance_m ?? null,
          top_speed_kmh:          pm.top_speed_kmh ?? null,
          sprints:                pm.sprints ?? null,
          minutes_played:         pm.minutes_played ?? null,
          passes:                 pm.passes ?? null,
          passes_completed:       pm.passes_completed ?? null,
          pass_success_pct:       pm.pass_success_pct ?? null,
          shots:                  pm.shots ?? null,
          tackles:                pm.tackles ?? null,
          goals:                  0,
          xg:                     pm.xg ?? null,
          contribution_score:     pm.contribution_score ?? null,
          touches_total:          pm.touches_total ?? pm.touches ?? null,
          touches_receive:        pm.touches_receive ?? null,
          touches_control:        pm.touches_control ?? null,
          touches_pass:           pm.touches_pass ?? null,
          touches_shot:           pm.touches_shot ?? null,
          touches_dribble:        pm.touches_dribble ?? null,
          jersey_number:          pm.jersey_number ?? null,
          passes_attempted:       pm.passes_attempted ?? null,
          passes_completed_count: pm.passes_completed_count ?? null,
          pass_accuracy:          pm.pass_accuracy ?? null,
          passes_forward:         pm.passes_forward ?? null,
          passes_sideways:        pm.passes_sideways ?? null,
          passes_back:            pm.passes_back ?? null,
        }));

        await adminClient
          .from("player_match_stats")
          .upsert(statsRows, {
            onConflict: "match_id,processing_job_id,track_id",
            ignoreDuplicates: false,
          });
      }

      await adminClient
        .from("matches")
        .update({ status: "complete" })
        .eq("id", job.match_id);

      adminClient.functions
        .invoke("generate-match-insights", { body: { match_id: job.match_id } })
        .catch((e: unknown) => console.error("generate-match-insights invoke failed:", e));

    } else if (isFailed) {
      await adminClient
        .from("processing_jobs")
        .update({
          status: "failed",
          error_message: output?.error ?? `RunPod status: ${status}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await adminClient
        .from("matches")
        .update({ status: "failed" })
        .eq("id", job.match_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("analysis-callback error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
