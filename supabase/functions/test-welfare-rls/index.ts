/**
 * Edge Function: test-welfare-rls
 *
 * Calls verify_welfare_rls_isolation() via service-role RPC and returns
 * pass/fail results for all 5 tests.
 *
 * T1  RLS enabled on welfare_log               — always runs
 * T2  welfare_restricted_select policy exists   — always runs
 * T3  auto-restrict trigger fires               — requires ≥1 player row
 * T4  non-welfare user blocked (coach)          — requires ≥2 auth.users
 * T5  welfare_officer permitted                 — requires ≥2 auth.users
 *
 * Invoke: POST /functions/v1/test-welfare-rls
 * Auth:   Bearer <service_role_key>   (admin only — never expose publicly)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url     = Deno.env.get('SUPABASE_URL')!;
  const svcKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin   = createClient(url, svcKey, { auth: { persistSession: false } });

  // Verify the caller provided the service-role key
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.includes(svcKey)) {
    return new Response(JSON.stringify({ error: 'Service-role key required' }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { data: rows, error } = await admin.rpc('verify_welfare_rls_isolation');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  type Row = { test_name: string; passed: boolean | null; detail: string };
  const results = (rows ?? []) as Row[];

  const summary = {
    total:   results.length,
    passed:  results.filter(r => r.passed === true).length,
    failed:  results.filter(r => r.passed === false).length,
    skipped: results.filter(r => r.passed === null).length,
    all_critical_passed: results
      .filter(r => !r.detail.startsWith('SKIP'))
      .every(r => r.passed === true),
  };

  // Non-welfare isolation (T4) must pass — it is the explicit requirement
  const t4 = results.find(r => r.test_name.startsWith('T4'));
  if (t4 && t4.passed === false) {
    summary.all_critical_passed = false;
  }

  return new Response(
    JSON.stringify({ summary, results }, null, 2),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
