import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const localSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await localSupabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const externalSupabase = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL')!,
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    let entity = url.searchParams.get('entity') || 'all';

    try {
      const body = await req.json();
      if (body?.entity) entity = body.entity;
    } catch {
      // no body
    }

    console.log(`Starting sync for entity: ${entity} (user: ${user.email})`);

    const results: Record<string, { inserted: number; updated: number; errors: number }> = {
      clubs: { inserted: 0, updated: 0, errors: 0 },
      teams: { inserted: 0, updated: 0, errors: 0 },
      players: { inserted: 0, updated: 0, errors: 0 },
      events: { inserted: 0, updated: 0, errors: 0 },
      user_access: { inserted: 0, updated: 0, errors: 0 },
    };

    // ---- Clubs ----
    if (entity === 'clubs' || entity === 'all') {
      const { data: externalClubs, error: clubsError } = await externalSupabase.from('clubs').select('*');
      if (clubsError) {
        console.error('Error fetching clubs:', clubsError);
        results.clubs.errors++;
      } else if (externalClubs) {
        for (const club of externalClubs) {
          const { error } = await localSupabase
            .from('clubs')
            .upsert({
              external_id: club.id,
              name: club.name,
              logo_url: club.logo_url || null,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'external_id' });
          if (error) results.clubs.errors++;
          else results.clubs.updated++;
        }
      }
    }

    // ---- Teams ----
    if (entity === 'teams' || entity === 'all') {
      const { data: externalTeams, error: teamsError } = await externalSupabase.from('teams').select('*');
      if (teamsError) {
        results.teams.errors++;
      } else if (externalTeams) {
        for (const team of externalTeams) {
          const { data: localClub } = await localSupabase
            .from('clubs')
            .select('id')
            .eq('external_id', team.club_id)
            .single();

          const { error } = await localSupabase
            .from('teams')
            .upsert({
              external_id: team.id,
              name: team.name,
              club_id: localClub?.id || null,
              age_group: team.age_group || null,
              game_format: team.game_format || null,
              logo_url: team.logo_url || null,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'external_id' });
          if (error) results.teams.errors++;
          else results.teams.updated++;
        }
      }
    }

    // ---- Players ----
    if (entity === 'players' || entity === 'all') {
      const { data: externalPlayers, error: playersError } = await externalSupabase.from('players').select('*');
      if (playersError) {
        results.players.errors++;
      } else if (externalPlayers) {
        for (const player of externalPlayers) {
          const { data: localTeam } = await localSupabase
            .from('teams')
            .select('id, club_id')
            .eq('external_id', player.team_id)
            .single();

          const { error } = await localSupabase
            .from('players')
            .upsert({
              external_id: player.id,
              name: player.name,
              team_id: localTeam?.id || null,
              club_id: localTeam?.club_id || null,
              position: player.play_style || player.position || null,
              player_type: player.type || player.player_type || null,
              squad_number: player.squad_number,
              date_of_birth: player.date_of_birth || null,
              availability: player.availability || null,
              photo_url: player.photo_url || null,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'external_id' });
          if (error) results.players.errors++;
          else results.players.updated++;
        }
      }
    }

    // ---- Events ----
    if (entity === 'events' || entity === 'all') {
      const { data: externalEvents, error: eventsError } = await externalSupabase.from('events').select('*');
      if (eventsError) {
        results.events.errors++;
      } else if (externalEvents) {
        for (const event of externalEvents) {
          const { data: localTeam } = await localSupabase
            .from('teams')
            .select('id')
            .eq('external_id', event.team_id)
            .single();

          const { error } = await localSupabase
            .from('team_events')
            .upsert({
              external_id: event.id,
              team_id: localTeam?.id || null,
              title: event.title,
              event_type: event.event_type || 'match',
              date: event.date,
              start_time: event.start_time || null,
              end_time: event.end_time || null,
              meeting_time: event.meeting_time || null,
              location: event.location || null,
              opponent: event.opponent || null,
              is_home: event.is_home ?? true,
              game_format: event.game_format || null,
              game_duration: event.game_duration || null,
              notes: event.notes || null,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'external_id' });
          if (error) results.events.errors++;
          else results.events.updated++;
        }
      }
    }

    // ---- User access (team & club memberships for the signed-in user) ----
    if (entity === 'user_access' || entity === 'all') {
      const userEmail = user.email;
      if (!userEmail) {
        results.user_access.errors++;
      } else {
        // Find external user by email. Try common locations: profiles or auth.users via admin.
        let externalUserId: string | null = null;

        // Try a `profiles` table with email column
        const { data: extProfile } = await externalSupabase
          .from('profiles')
          .select('id, user_id, email')
          .eq('email', userEmail)
          .maybeSingle();

        if (extProfile) {
          externalUserId = (extProfile.user_id as string) || (extProfile.id as string);
        }

        // Fallback: external auth admin lookup
        if (!externalUserId) {
          try {
            const { data: usersList } = await externalSupabase.auth.admin.listUsers();
            const match = usersList?.users?.find((u: { email?: string }) => u.email === userEmail);
            if (match) externalUserId = match.id;
          } catch (e) {
            console.warn('External admin.listUsers not available:', e instanceof Error ? e.message : e);
          }
        }

        if (!externalUserId) {
          console.log(`No external user found for ${userEmail}`);
        } else {
          // Try common membership table names. We attempt a few patterns.
          const tryFetch = async (table: string, userCol: string, idCol: string) => {
            const { data, error } = await externalSupabase
              .from(table)
              .select('*')
              .eq(userCol, externalUserId);
            if (error) return null;
            return data;
          };

          // user_teams
          let teamMemberships =
            (await tryFetch('user_teams', 'user_id', 'team_id')) ||
            (await tryFetch('team_members', 'user_id', 'team_id')) ||
            [];

          for (const m of teamMemberships) {
            const externalTeamId = m.team_id;
            const role = m.role || 'member';
            const { data: localTeam } = await localSupabase
              .from('teams')
              .select('id')
              .eq('external_id', externalTeamId)
              .maybeSingle();
            if (!localTeam) continue;

            const { error } = await localSupabase
              .from('user_team_access')
              .upsert({
                user_id: user.id,
                team_id: localTeam.id,
                role,
                external_user_id: externalUserId,
                external_team_id: externalTeamId,
                synced_at: new Date().toISOString(),
              }, { onConflict: 'user_id,team_id' });
            if (error) results.user_access.errors++;
            else results.user_access.updated++;
          }

          // user_clubs
          let clubMemberships =
            (await tryFetch('user_clubs', 'user_id', 'club_id')) ||
            (await tryFetch('club_members', 'user_id', 'club_id')) ||
            [];

          for (const m of clubMemberships) {
            const externalClubId = m.club_id;
            const role = m.role || 'member';
            const { data: localClub } = await localSupabase
              .from('clubs')
              .select('id')
              .eq('external_id', externalClubId)
              .maybeSingle();
            if (!localClub) continue;

            const { error } = await localSupabase
              .from('user_club_access')
              .upsert({
                user_id: user.id,
                club_id: localClub.id,
                role,
                external_user_id: externalUserId,
                external_club_id: externalClubId,
                synced_at: new Date().toISOString(),
              }, { onConflict: 'user_id,club_id' });
            if (error) results.user_access.errors++;
            else results.user_access.updated++;
          }

          // Fallback: if no explicit memberships, give the user access to every synced team.
          // (Useful while membership tables aren't yet wired.)
          if (results.user_access.updated === 0) {
            const { data: allTeams } = await localSupabase.from('teams').select('id');
            for (const t of allTeams || []) {
              const { error } = await localSupabase
                .from('user_team_access')
                .upsert({
                  user_id: user.id,
                  team_id: t.id,
                  role: 'member',
                  external_user_id: externalUserId,
                  synced_at: new Date().toISOString(),
                }, { onConflict: 'user_id,team_id' });
              if (error) results.user_access.errors++;
              else results.user_access.updated++;
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Sync completed', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-external-data function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
