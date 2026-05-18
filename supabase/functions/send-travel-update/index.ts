// TODO: Wire to send-push-notification Edge Function and parent_communication table.
// Steps to complete:
//  1. For each target user_id, look up device push tokens (e.g. a `push_tokens` table).
//  2. Invoke the `send-push-notification` Edge Function (or call FCM/APNs directly).
//  3. Insert a row into `parent_communication` for each delivered message so parents
//     can see the full thread inside the parent-facing app.
//  4. Store delivery receipts / errors back against the travel_update row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface TravelUpdate {
  id: string;
  title: string;
  body: string;
  update_type: string;
  target_squads: string[];
  travel_event_id: string;
}

interface TravelEvent {
  id: string;
  academy_id: string;
  squads: string[];
}

interface Team {
  id: string;
  age_group: string | null;
  name: string;
}

interface UserAccess {
  user_id: string;
  team_id: string;
  role: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { travel_update_id, travel_event_id } = await req.json();

    if (!travel_update_id || !travel_event_id) {
      return new Response(
        JSON.stringify({ error: 'travel_update_id and travel_event_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. Fetch the update ──────────────────────────────────────────────────
    const { data: update, error: updateErr } = await admin
      .from('travel_update')
      .select('id, title, body, update_type, target_squads, travel_event_id')
      .eq('id', travel_update_id)
      .single<TravelUpdate>();

    if (updateErr || !update) {
      return new Response(
        JSON.stringify({ error: updateErr?.message ?? 'Update not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 2. Fetch the travel event ────────────────────────────────────────────
    const { data: event, error: eventErr } = await admin
      .from('travel_event')
      .select('id, academy_id, squads')
      .eq('id', travel_event_id)
      .single<TravelEvent>();

    if (eventErr || !event) {
      return new Response(
        JSON.stringify({ error: eventErr?.message ?? 'Travel event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Determine which squads (age_groups) to notify ─────────────────────
    // If target_squads is empty the update targets all squads on the event.
    const targetSquads: string[] =
      update.target_squads && update.target_squads.length > 0
        ? update.target_squads
        : event.squads;

    console.log(
      `[send-travel-update] update="${update.title}" (${update.update_type})`,
      `| event=${travel_event_id} | targeting squads: [${targetSquads.join(', ')}]`,
    );

    // ── 4. Find teams whose age_group matches the target squads ──────────────
    const { data: teams, error: teamsErr } = await admin
      .from('teams')
      .select('id, age_group, name')
      .in('age_group', targetSquads)
      .returns<Team[]>();

    if (teamsErr) {
      console.error('[send-travel-update] teams lookup error:', teamsErr.message);
      return new Response(
        JSON.stringify({ error: teamsErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const teamIds = (teams ?? []).map(t => t.id);

    console.log(
      `[send-travel-update] matched ${teamIds.length} team(s):`,
      (teams ?? []).map(t => `${t.name} (${t.age_group})`).join(', ') || 'none',
    );

    // ── 5. Find all users with access to those teams ─────────────────────────
    let notificationTargets: { user_id: string; team_id: string; role: string }[] = [];

    if (teamIds.length > 0) {
      const { data: accessRows, error: accessErr } = await admin
        .from('user_team_access')
        .select('user_id, team_id, role')
        .in('team_id', teamIds)
        .returns<UserAccess[]>();

      if (accessErr) {
        console.error('[send-travel-update] user_team_access lookup error:', accessErr.message);
        return new Response(
          JSON.stringify({ error: accessErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      notificationTargets = accessRows ?? [];
    }

    // Deduplicate by user_id — a user may have access to multiple matching teams
    const uniqueUserIds = [...new Set(notificationTargets.map(r => r.user_id))];

    // ── 6. Log the resolved target list ─────────────────────────────────────
    console.log(
      `[send-travel-update] notification target list (${uniqueUserIds.length} unique user(s)):`,
      uniqueUserIds.join(', ') || 'none',
    );

    if (notificationTargets.length > 0) {
      // Group by team for structured logging
      const byTeam = notificationTargets.reduce<Record<string, string[]>>((acc, r) => {
        (acc[r.team_id] ??= []).push(`${r.user_id} (${r.role})`);
        return acc;
      }, {});
      for (const [teamId, users] of Object.entries(byTeam)) {
        const team = (teams ?? []).find(t => t.id === teamId);
        console.log(
          `  team: ${team?.name ?? teamId} (${team?.age_group ?? '?'})`,
          `→ ${users.join(', ')}`,
        );
      }
    }

    // ── 7. Mark the update as sent ───────────────────────────────────────────
    await admin
      .from('travel_update')
      .update({ sent_push: true })
      .eq('id', travel_update_id);

    return new Response(
      JSON.stringify({
        ok: true,
        squads_targeted: targetSquads,
        teams_matched: teamIds.length,
        users_targeted: uniqueUserIds.length,
        note: 'target list resolved and logged — no notifications dispatched yet (see TODO)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-travel-update] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
