import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ContextKind = 'academy' | 'club' | 'team';
export type UserGroupTier = 'grassroots_junior' | 'amateur_professional';

export interface ActiveContext {
  kind: ContextKind;
  /** academy_id | club_id | team_id depending on kind */
  id: string;
  /** Owning club — always set. Primary key for scoping players/welfare/etc. */
  clubId: string;
  /** Human-readable name shown in the context switcher */
  label: string;
  userGroupTier: UserGroupTier;
}

export interface UseActiveContextReturn {
  activeContext: ActiveContext | null;
  availableContexts: ActiveContext[];
  setActiveContext: (ctx: ActiveContext) => void;
  loading: boolean;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function storageKey(userId: string) {
  return `active-ctx-v1-${userId}`;
}

function loadStored(userId: string, available: ActiveContext[]): ActiveContext | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: ActiveContext = JSON.parse(raw);
    // Re-validate: membership may have changed since last session
    return available.find(c => c.kind === parsed.kind && c.id === parsed.id) ?? null;
  } catch {
    return null;
  }
}

function persist(userId: string, ctx: ActiveContext) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ctx));
  } catch {}
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useActiveContextData(): UseActiveContextReturn {
  const [activeContext, setActiveContextState] = useState<ActiveContext | null>(null);
  const [availableContexts, setAvailableContexts] = useState<ActiveContext[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const sb = supabase as any;

    // Resolve tier; default to amateur_professional so access isn't accidentally
    // stripped if the column hasn't been populated yet.
    const { data: profile } = await sb
      .from('profiles')
      .select('user_group_tier')
      .eq('id', user.id)
      .maybeSingle();
    const tier: UserGroupTier = profile?.user_group_tier ?? 'amateur_professional';

    // Academy memberships — only fetched for amateur_professional users
    const academyPromise: Promise<{ data: any[] | null }> =
      tier === 'amateur_professional'
        ? sb
            .from('user_academies')
            .select('academy_id, academies!inner(id, club_id, clubs!inner(id, name))')
            .eq('user_id', user.id)
        : Promise.resolve({ data: [] });

    const [teamResult, clubResult, academyResult] = await Promise.all([
      sb
        .from('user_team_access')
        .select('team_id, teams!inner(id, name, club_id)')
        .eq('user_id', user.id),
      sb
        .from('user_club_access')
        .select('club_id, clubs!inner(id, name, academy_id)')
        .eq('user_id', user.id),
      academyPromise,
    ]);

    const contexts: ActiveContext[] = [];

    // 1. Academy contexts (highest rank — shown first)
    for (const row of (academyResult.data ?? [])) {
      const acad = row.academies;
      if (!acad?.club_id) continue;
      const clubName: string = acad.clubs?.name ?? '';
      contexts.push({
        kind: 'academy',
        id: row.academy_id,
        clubId: acad.club_id,
        label: clubName ? `${clubName} Academy` : 'Academy',
        userGroupTier: tier,
      });
    }

    // 1b. Synthesise academy contexts from club access so academy-tier nav
    //     items appear immediately for users with club admin access, even
    //     before the Sync Academy job has populated user_academies.
    const seenAcademyIds = new Set(contexts.map(c => c.id));
    for (const row of (clubResult.data ?? [])) {
      const club = row.clubs;
      if (!club) continue;
      const synthId = club.academy_id ?? row.club_id;
      if (seenAcademyIds.has(synthId)) continue;
      seenAcademyIds.add(synthId);
      contexts.push({
        kind: 'academy',
        id: synthId,
        clubId: row.club_id,
        label: `${club.name} Academy`,
        userGroupTier: tier,
      });
    }

    // 2. Club contexts
    for (const row of (clubResult.data ?? [])) {
      const club = row.clubs;
      if (!club) continue;
      contexts.push({
        kind: 'club',
        id: row.club_id,
        clubId: row.club_id,
        label: club.name,
        userGroupTier: tier,
      });
    }

    // 3. Team contexts (most granular — shown last)
    for (const row of (teamResult.data ?? [])) {
      const team = row.teams;
      if (!team?.club_id) continue;
      contexts.push({
        kind: 'team',
        id: row.team_id,
        clubId: team.club_id,
        label: team.name,
        userGroupTier: tier,
      });
    }

    setAvailableContexts(contexts);

    const stored = loadStored(user.id, contexts);
    setActiveContextState(stored ?? contexts[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const setActiveContext = useCallback(async (ctx: ActiveContext) => {
    setActiveContextState(ctx);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) persist(user.id, ctx);
  }, []);

  return { activeContext, availableContexts, setActiveContext, loading };
}
