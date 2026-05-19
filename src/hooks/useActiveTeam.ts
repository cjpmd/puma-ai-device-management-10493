import { useCallback } from 'react';
import { useUserTeams, UserTeam } from './useUserTeams';
import { useActiveContext } from '@/contexts/ActiveContextContext';

/**
 * @deprecated Use useActiveContext() directly for new code.
 * This hook is retained for iOS shell compatibility only.
 *
 * Thin adapter over useActiveContext(). Reads the active team from the
 * shared context so the iOS shell and web dashboard stay in sync.
 * setActiveTeam() writes back through setActiveContext(), persisting the
 * choice to the unified active-ctx-v1-{userId} localStorage key.
 */
export function useActiveTeam() {
  const { teams, loading: teamsLoading, error, refresh } = useUserTeams();
  const { activeContext, availableContexts, setActiveContext, loading: ctxLoading } = useActiveContext();

  // iOS shell is always team-centric. If the web dashboard is in academy/club
  // context, fall back to the first team rather than showing nothing.
  const activeTeamId = activeContext?.kind === 'team' ? activeContext.id : null;
  const activeTeam: UserTeam | null =
    teams.find(t => t.id === activeTeamId) ?? teams[0] ?? null;

  const setActiveTeam = useCallback((id: string) => {
    const teamCtx = availableContexts.find(c => c.kind === 'team' && c.id === id);
    if (teamCtx) setActiveContext(teamCtx);
  }, [availableContexts, setActiveContext]);

  return {
    teams,
    activeTeam,
    setActiveTeam,
    loading: teamsLoading || ctxLoading,
    error,
    refresh,
  };
}
