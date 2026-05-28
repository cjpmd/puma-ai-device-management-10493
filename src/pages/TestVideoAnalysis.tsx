import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// NOTE: processing_jobs.id is a UUID column so 'test-001' can't be used directly.
// This page uses the UUID below as the canonical test job ID.
const TEST_JOB_UUID = '00000000-0000-0000-0000-000000000001';
const TEST_SESSION_ID = 'test-session-001';
const VIDEO_URL =
  'https://s3.eu-west-1.wasabisys.com/pumaaivideoanalysis/test/Lions%20v%20Kirrie%209v9s%2010-12-2025?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=YGLWRFL2I716872ISIAN%2F20260528%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20260528T132345Z&X-Amz-Expires=90000&X-Amz-Signature=6283b341d7fdf969385f87d75f6dbaa39a1d87816e61c1fa62290732d00f4918&X-Amz-SignedHeaders=host';

export default function TestVideoAnalysis() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runpodJobId, setRunpodJobId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = (msg: string) =>
    setLog((prev) => [...prev, `[${new Date().toISOString()}] ${msg}`]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const runAnalysis = async () => {
    setRunning(true);
    setLog([]);
    setRunpodJobId(null);
    setResult(null);
    stopPolling();

    try {
      // 1. Get a valid match_id — required for processing_jobs FK constraint + RLS
      addLog('Fetching a match_id for processing_jobs FK constraint...');
      const { data: matchRow, error: matchErr } = await supabase
        .from('matches')
        .select('id')
        .limit(1)
        .single();

      if (matchErr || !matchRow) {
        addLog(
          `ERROR: No matches found. A match must exist to satisfy processing_jobs.match_id NOT NULL FK. Create a match first. (${matchErr?.message ?? 'no data'})`,
        );
        setRunning(false);
        return;
      }

      const matchId = matchRow.id;
      addLog(`Using match_id: ${matchId}`);
      addLog(`Test job UUID: ${TEST_JOB_UUID}`);

      // 2. Upsert test row so the analysis-callback has a row to write to
      addLog('Upserting test row into processing_jobs (id, match_id, status=pending)...');
      const { error: upsertErr } = await supabase
        .from('processing_jobs')
        .upsert(
          { id: TEST_JOB_UUID, match_id: matchId, status: 'pending' },
          { onConflict: 'id' },
        );

      if (upsertErr) {
        addLog(`ERROR upserting test row: ${upsertErr.message}`);
        setRunning(false);
        return;
      }
      addLog('Test row upserted ✓');

      // 3. Call process-video edge function
      addLog('Calling process-video edge function...');
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('process-video', {
        body: {
          job_id: TEST_JOB_UUID,
          session_id: TEST_SESSION_ID,
          video_url: VIDEO_URL,
        },
      });

      if (fnErr) {
        addLog(`ERROR calling process-video: ${fnErr.message}`);
        // FunctionsHttpError.context is the raw Response — read its body
        try {
          const ctx = (fnErr as any).context;
          if (ctx && typeof ctx.text === 'function') {
            const body = await ctx.text();
            addLog(`Response body: ${body}`);
          }
        } catch {
          // ignore body read failure
        }
        setRunning(false);
        return;
      }

      addLog(`Edge function response: ${JSON.stringify(fnData)}`);

      const analysisJobId = (fnData as any)?.analysis_job_id;
      if (analysisJobId) {
        setRunpodJobId(analysisJobId);
        addLog(`RunPod analysis_job_id: ${analysisJobId}`);
      } else {
        addLog('No analysis_job_id in response — check edge function logs');
      }

      // 4. Poll every 10 s for status = 'complete' / 'completed' / 'failed'
      addLog('Polling processing_jobs every 10 s...');
      pollRef.current = setInterval(async () => {
        const { data: jobRow, error: pollErr } = await supabase
          .from('processing_jobs')
          .select('*')
          .eq('id', TEST_JOB_UUID)
          .single();

        if (pollErr) {
          addLog(`Poll error: ${pollErr.message}`);
          return;
        }

        addLog(`Poll → status: ${jobRow?.status}`);

        const done =
          jobRow?.status === 'complete' ||
          jobRow?.status === 'completed' ||
          jobRow?.status === 'failed';

        if (done) {
          stopPolling();
          setResult(jobRow as Record<string, unknown>);
          addLog(jobRow?.status === 'failed' ? `Job failed: ${(jobRow as any)?.error_message}` : 'Job complete — results below');
          setRunning(false);
        }
      }, 10_000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Unexpected error: ${msg}`);
      setRunning(false);
    }
  };

  const stopTest = () => {
    stopPolling();
    setRunning(false);
    addLog('Polling stopped manually.');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
          <h1 className="text-lg font-bold text-amber-900">⚠ Test Page: Video Analysis Pipeline</h1>
          <p className="text-sm text-amber-700 mt-1">
            Temporary — not linked from nav. Delete after testing. Uses UUID{' '}
            <code className="bg-amber-100 px-1 rounded text-xs">{TEST_JOB_UUID}</code> as the
            processing_jobs row (schema requires UUID, not the string "test-001").
          </p>
        </div>

        {/* Params summary */}
        <div className="bg-white border rounded-xl p-5 text-sm font-mono space-y-2">
          <div>
            <span className="text-slate-400">job_id: </span>
            <span className="text-blue-700">{TEST_JOB_UUID}</span>
          </div>
          <div>
            <span className="text-slate-400">session_id: </span>
            <span className="text-blue-700">{TEST_SESSION_ID}</span>
          </div>
          <div className="break-all">
            <span className="text-slate-400">video_url: </span>
            <span className="text-blue-700 text-xs">{VIDEO_URL}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={runAnalysis}
            disabled={running}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Running…' : 'Run Analysis'}
          </button>
          {running && (
            <button
              onClick={stopTest}
              className="bg-slate-200 text-slate-700 px-6 py-3 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        {/* RunPod job ID */}
        {runpodJobId && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-medium text-green-800">
              RunPod job queued:{' '}
              <code className="font-mono bg-green-100 px-2 py-0.5 rounded">{runpodJobId}</code>
            </p>
          </div>
        )}

        {/* Log output */}
        {log.length > 0 && (
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-green-400 space-y-0.5 max-h-72 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {/* Raw result JSON */}
        {result && (
          <div className="space-y-2">
            <h2 className="font-semibold text-slate-800">Raw processing_jobs row (result):</h2>
            <pre className="bg-white border rounded-xl p-5 text-xs overflow-auto max-h-[32rem] leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
