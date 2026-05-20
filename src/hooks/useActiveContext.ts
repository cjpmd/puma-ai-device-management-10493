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

    // Academy memberships — only fetched for amateur_professional users.
    // Note: academies has no club_id column; the relationship lives on
    // clubs.academy_id, so we resolve the owning club via a follow-up query.
    const academyPromise: Promise<{ data: any[] | null }> =
      tier === 'amateur_professional'
        ? sb
            .from('user_academies')
            .select('academy_id, role, academies!inner(id, name)')
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

    // 1. Academy contexts from user_academies (highest rank — shown first).
    // Resolve owning club via clubs.academy_id reverse lookup.
    const academyRows = academyResult.data ?? [];
    const academyIds = Array.from(
      new Set(academyRows.map((r: any) => r.academy_id).filter(Boolean))
    );
    const academyClubMap = new Map<string, { clubId: string; clubName: string }>();
    if (academyIds.length > 0) {
      const { data: clubsForAcademies } = await sb
        .from('clubs')
        .select('id, name, academy_id')
        .in('academy_id', academyIds);
      for (const c of (clubsForAcademies ?? [])) {
        if (c?.academy_id && !academyClubMap.has(c.academy_id)) {
          academyClubMap.set(c.academy_id, { clubId: c.id, clubName: c.name ?? '' });
        }
      }
    }
    for (const row of academyRows) {
      const link = academyClubMap.get(row.academy_id);
      if (!link) continue; // need a club for downstream scoping
      const academyName: string = row.academies?.name ?? '';
      contexts.push({
        kind: 'academy',
        id: row.academy_id,
        clubId: link.clubId,
        label: academyName || (link.clubName ? `${link.clubName} Academy` : 'Academy'),
        userGroupTier: tier,
      });
    }

    // 1b. Surface academy contexts derived from club access — but ONLY when
    //     the club is linked to a real academy row (clubs.academy_id is set).
    //     We do NOT fabricate academies for clubs that have no academy.
    const seenAcademyIds = new Set(contexts.map(c => c.id));
    for (const row of (clubResult.data ?? [])) {
      const club = row.clubs;
      if (!club?.academy_id) continue;
      if (seenAcademyIds.has(club.academy_id)) continue;
      seenAcademyIds.add(club.academy_id);
      contexts.push({
        kind: 'academy',
        id: club.academy_id,
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
