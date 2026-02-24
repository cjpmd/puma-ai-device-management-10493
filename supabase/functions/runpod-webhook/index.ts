import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Public webhook — no JWT verification
    const body = await req.json();
    const { id, status, output } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing job id" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the processing job
    const { data: job, error: jobErr } = await adminClient
      .from("processing_jobs")
      .select("id, match_id")
      .eq("runpod_job_id", id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: corsHeaders });
    }

    const isComplete = status === "COMPLETED";
    const isFailed = status === "FAILED";

    const jobUpdate: Record<string, any> = {
      status: isComplete ? "complete" : isFailed ? "failed" : "running",
      completed_at: isComplete || isFailed ? new Date().toISOString() : null,
    };

    if (isComplete && output) {
      jobUpdate.output_video_path = output.video_path || null;
      jobUpdate.output_highlights_path = output.highlights_path || null;
      jobUpdate.output_metadata_path = output.metadata_path || null;
    }

    if (isFailed) {
      jobUpdate.processing_logs = JSON.stringify(body.error || body);
    }

    await adminClient.from("processing_jobs").update(jobUpdate).eq("id", job.id);

    await adminClient
      .from("matches")
      .update({ status: isComplete ? "complete" : isFailed ? "failed" : "processing" })
      .eq("id", job.match_id);

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
