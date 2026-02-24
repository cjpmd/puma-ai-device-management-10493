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

    // Connect to external Football Central using service role key to bypass RLS
    const externalSupabase = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL')!,
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Read entity from query params OR request body
    const url = new URL(req.url);
    let entity = url.searchParams.get('entity') || 'all';
    
    try {
      const body = await req.json();
      if (body?.entity) entity = body.entity;
    } catch {
      // No body or invalid JSON, use query param
    }

    console.log(`Starting sync for entity: ${entity}`);

    const results = {
      clubs: { inserted: 0, updated: 0, errors: 0 },
      teams: { inserted: 0, updated: 0, errors: 0 },
      players: { inserted: 0, updated: 0, errors: 0 },
    };

    // Sync clubs
    if (entity === 'clubs' || entity === 'all') {
      console.log('Syncing clubs...');
      const { data: externalClubs, error: clubsError } = await externalSupabase
        .from('clubs')
        .select('*');

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

          if (error) {
            console.error(`Error upserting club ${club.id}:`, error);
            results.clubs.errors++;
          } else {
            results.clubs.updated++;
          }
        }
      }
      console.log(`Clubs synced: ${results.clubs.updated} updated, ${results.clubs.errors} errors`);
    }

    // Sync teams
    if (entity === 'teams' || entity === 'all') {
      console.log('Syncing teams...');
      const { data: externalTeams, error: teamsError } = await externalSupabase
        .from('teams')
        .select('*');

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        results.teams.errors++;
      } else if (externalTeams) {
        for (const team of externalTeams) {
          // Look up local club by external_id matching the team's club_id
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

          if (error) {
            console.error(`Error upserting team ${team.id}:`, error);
            results.teams.errors++;
          } else {
            results.teams.updated++;
          }
        }
      }
      console.log(`Teams synced: ${results.teams.updated} updated, ${results.teams.errors} errors`);
    }

    // Sync players
    if (entity === 'players' || entity === 'all') {
      console.log('Syncing players...');
      const { data: externalPlayers, error: playersError } = await externalSupabase
        .from('players')
        .select('*');

      if (playersError) {
        console.error('Error fetching players:', playersError);
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

          if (error) {
            console.error(`Error upserting player ${player.id}:`, error);
            results.players.errors++;
          } else {
            results.players.updated++;
          }
        }
      }
      console.log(`Players synced: ${results.players.updated} updated, ${results.players.errors} errors`);
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
