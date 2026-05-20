import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * analysis-callback: RunPod webhook called when an analysis-only job completes.
 *
 * RunPod sends: { id, status, output: ProcessingJobResult }
 *
 * On success:
 *   - Updates processing_jobs with events, player_metrics, team_metrics, heatmaps
 *   - Upserts high-confidence CV events (confidence ≥ 0.70) into match_event_tags
 *     so they appear in Cinema mode alongside manual coach tags
 *   - Triggers generate-match-insights (fire-and-forget)
 *
 * On failure:
 *   - Sets status = 'failed' and stores error_message
 *
 * Lookup strategy: RunPod sends `id` = the RunPod job ID.
 * We stored this in processing_jobs.analysis_job_id when we queued the job.
 * We also accept job_id in the output body as a fallback.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CV event types that map to match_event_tags.event_type values
const CV_EVENT_TYPE_MAP: Record<string, string> = {
  shot: "key_moment",   // shots detected by CV mapped to key_moment for coach review
  goal: "goal",
  pass: "key_moment",   // only high-confidence passes become tags
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
    // RunPod webhook shape: { id, status, output }
    const { id: runpodJobId, status, output } = body;

    if (!runpodJobId) {
      return new Response(JSON.stringify({ error: "Missing RunPod job id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Look up our job — try analysis_job_id first, fall back to output.job_id
    let job: { id: string; match_id: string } | null = null;

    if (runpodJobId) {
      const { data } = await adminClient
        .from("processing_jobs")
        .select("id, match_id")
        .eq("analysis_job_id", runpodJobId)
        .maybeSingle();
      job = data;
    }

    // Fallback: job_id embedded in output body
    if (!job && output?.job_id) {
      const { data } = await adminClient
        .from("processing_jobs")
        .select("id, match_id")
        .eq("id", output.job_id)
        .maybeSingle();
      job = data;
    }

    if (!job) {
      console.error("analysis-callback: job not found for RunPod id", runpodJobId);
      // Return 200 so RunPod doesn't retry indefinitely
      return new Response(JSON.stringify({ ok: false, reason: "job not found" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const isComplete = status === "COMPLETED" && output?.success === true;
    const isFailed = status === "FAILED" || output?.success === false;

    if (isComplete && output) {
      // Map ProcessingJobResult fields to processing_jobs columns
      const update: Record<string, unknown> = {
        status: "complete",
        completed_at: new Date().toISOString(),
        // events go into event_data.events so Cinema MatchCinemaLayout can read them
        event_data: {
          events: output.events ?? [],
          highlights: output.auto_highlights ?? [],
        },
        player_metrics: output.player_metrics ?? null,
        // The GPU handler returns 'team_stats'; DB column is 'team_metrics'
        team_metrics: output.team_stats ?? output.team_metrics ?? null,
        heatmaps: output.heatmaps ?? null,
        ball_tracking_data: output.ball_tracking ?? null,
        // Confidence score and duration live in divergence_metrics for now
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
              // e.time is in seconds; timestamp_ms is milliseconds
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

      await adminClient
        .from("matches")
        .update({ status: "complete" })
        .eq("id", job.match_id);

      // Fire-and-forget: generate AI narrative insights
      adminClient.functions
        .invoke("generate-match-insights", { body: { match_id: job.match_id } })
        .catch((e) => console.error("generate-match-insights invoke failed:", e));
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
