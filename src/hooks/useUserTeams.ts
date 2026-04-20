import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserTeam {
  id: string;
  name: string;
  age_group: string | null;
  game_format: string | null;
  logo_url: string | null;
  club_id: string | null;
  role: string;
}

export function useUserTeams() {
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: access, error: accessErr } = await supabase
        .from('user_team_access')
        .select('role, team_id, teams:team_id(id, name, age_group, game_format, logo_url, club_id)')
        .order('synced_at', { ascending: false });

      if (accessErr) throw accessErr;

      const list: UserTeam[] = (access || [])
        .map((row: any) => row.teams ? { ...row.teams, role: row.role } : null)
        .filter(Boolean) as UserTeam[];

      setTeams(list);
    } catch (e: any) {
      console.error('useUserTeams error:', e);
      setError(e.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { teams, loading, error, refresh: load };
}

async function invokeExternalSync(functionName: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(functionName, body ? { body } : undefined);
  if (error) throw error;
  return data;
}

export async function syncUserAccess() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    return await invokeExternalSync('sync-external-user-access');
  } catch (e) {
    console.error('syncUserAccess failed:', e);
    return null;
  }
}

export async function syncEvents() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Not signed in' as const };
  try {
    const data = await invokeExternalSync('sync-external-events');
    return { success: true, data };
  } catch (e: any) {
    console.error('syncEvents failed:', e);
    return { success: false, error: e?.message || 'Sync failed' };
  }
}

export async function syncCore(entity: 'all' | 'clubs' | 'teams' | 'players' | 'attributes' = 'all') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Not signed in' as const };
  try {
    const data = await invokeExternalSync('sync-external-core', { entity });
    return { success: true, data };
  } catch (e: any) {
    console.error('syncCore failed:', e);
    return { success: false, error: e?.message || 'Sync failed' };
  }
}

/**
 * Full sync: clubs → teams → players (with photos) → attributes → events → user_access.
 */
export async function syncAll() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Not signed in' as const };
  try {
    const [core, events, access] = await Promise.all([
      invokeExternalSync('sync-external-core', { entity: 'all' }),
      invokeExternalSync('sync-external-events'),
      invokeExternalSync('sync-external-user-access'),
    ]);

    return {
      success: true,
      data: {
        results: {
          ...core?.results,
          ...events?.results,
          ...access?.results,
        },
      },
    };
  } catch (e: any) {
    console.error('syncAll failed:', e);
    return { success: false, error: e?.message || 'Sync failed' };
  }
}
