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

export async function syncUserAccess() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const { data, error } = await supabase.functions.invoke('sync-external-data', {
      body: { entity: 'user_access' },
    });
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('syncUserAccess failed:', e);
    return null;
  }
}
