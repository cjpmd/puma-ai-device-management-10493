import { useEffect, useState, useCallback } from 'react';
import { useUserTeams, UserTeam } from './useUserTeams';

const STORAGE_KEY = 'origin.activeTeamId';

export function useActiveTeam() {
  const { teams, loading, error, refresh } = useUserTeams();
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  // Default to first team once loaded
  useEffect(() => {
    if (!loading && teams.length > 0) {
      const valid = activeId && teams.find(t => t.id === activeId);
      if (!valid) {
        setActiveId(teams[0].id);
      }
    }
  }, [loading, teams, activeId]);

  // Persist
  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(STORAGE_KEY, activeId);
    } catch {}
  }, [activeId]);

  const activeTeam: UserTeam | null =
    teams.find(t => t.id === activeId) || teams[0] || null;

  const setActiveTeam = useCallback((id: string) => setActiveId(id), []);

  return { teams, activeTeam, setActiveTeam, loading, error, refresh };
}
