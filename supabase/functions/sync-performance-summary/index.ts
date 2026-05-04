import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Performance repo Supabase client
const perfClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Football Central Supabase client (separate project)
const fcClient = createClient(
  Deno.env.get('FC_SUPABASE_URL')!,
  Deno.env.get('FC_SERVICE_ROLE_KEY')!,
);

const SEASON_CUTOFF_MONTHS_AGO = 10;

function maturationBadge(offset: number | null): string {
  if (offset === null) return 'unknown';
  if (offset > 1.0) return 'early';
  if (offset < -1.0) return 'late';
  return 'on_time';
}

async function buildSummary(playerId: string) {
  const seasonCutoff = new Date();
  seasonCutoff.setMonth(seasonCutoff.getMonth() - SEASON_CUTOFF_MONTHS_AGO);
  const cutoffStr = seasonCutoff.toISOString().split('T')[0];

  const [
    { data: snapshots },
    { data: injuries },
    { data: latestLoad },
    { data: maturation },
  ] = await Promise.all([
    perfClient
      .from('attribute_snapshot')
      .select('scores, snapshot_date')
      .eq('player_id', playerId)
      .eq('is_final', true)
      .gte('snapshot_date', cutoffStr)
      .order('snapshot_date', { ascending: false })
      .limit(1),
    perfClient
      .from('injury_record')
      .select('id, resolved_at')
      .eq('player_id', playerId)
      .is('resolved_at', null),
    perfClient
      .from('training_load')
      .select('acwr_at_time, session_date')
      .eq('player_id', playerId)
      .order('session_date', { ascending: false })
      .limit(1),
    perfClient
      .from('maturation_record')
      .select('bio_age_estimate')
      .eq('player_id', playerId)
      .order('recorded_date', { ascending: false })
      .limit(1),
  ]);

  // Overall rating: average of all attribute scores in the latest snapshot
  let overallRating: number | null = null;
  if (snapshots?.[0]?.scores) {
    const vals = Object.values(snapshots[0].scores as Record<string, number>).filter(
      (v) => typeof v === 'number',
    );
    if (vals.length > 0) {
      overallRating = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
    }
  }

  // Availability status
  const acwr = latestLoad?.[0]?.acwr_at_time ?? null;
  let availabilityStatus: string;
  if ((injuries?.length ?? 0) > 0) {
    availabilityStatus = 'injured';
  } else if (acwr !== null && acwr >= 1.5) {
    availabilityStatus = 'high_load';
  } else if (acwr !== null && acwr >= 1.3) {
    availabilityStatus = 'elevated_load';
  } else {
    availabilityStatus = 'available';
  }

  const matOffset = maturation?.[0]?.bio_age_estimate ?? null;

  return {
    overall_rating: overallRating,
    availability_status: availabilityStatus,
    maturation_badge: maturationBadge(matOffset),
    last_snapshot_date: snapshots?.[0]?.snapshot_date ?? null,
    acwr: acwr,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Fetch all players from the performance database
    const { data: players, error: playersErr } = await perfClient
      .from('players')
      .select('id, fc_player_id')
      .not('fc_player_id', 'is', null);

    if (playersErr) {
      return new Response(JSON.stringify({ error: playersErr.message }), { status: 500 });
    }

    const results = { updated: 0, skipped: 0, errors: [] as string[] };

    for (const player of players ?? []) {
      try {
        const summary = await buildSummary(player.id);

        // Write to Football Central players table
        const { error: fcErr } = await fcClient
          .from('players')
          .update({
            performance_summary: summary,
            performance_summary_updated_at: new Date().toISOString(),
          })
          .eq('id', player.fc_player_id);

        if (fcErr) {
          results.errors.push(`${player.id}: ${fcErr.message}`);
          results.skipped++;
        } else {
          results.updated++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${player.id}: ${msg}`);
        results.skipped++;
      }
    }

    // Log the sync run to audit_log
    await perfClient.from('audit_log').insert({
      action: 'sync_performance_summary',
      table_name: 'players',
      record_id: null,
      actor_id: null,
      metadata: { ...results, ran_at: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
