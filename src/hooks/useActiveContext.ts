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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAvailableContexts([]);
        setActiveContextState(null);
        return;
      }

      const sb = supabase as any;

      // Resolve tier; default to amateur_professional so access isn't accidentally
      // stripped if the column hasn't been populated yet.
      let tier: UserGroupTier = 'amateur_professional';
      try {
        const { data: profile, error: profileErr } = await sb
          .from('profiles')
          .select('user_group_tier')
          .eq('id', user.id)
          .maybeSingle();
        if (profileErr) console.warn('[useActiveContext] profiles query failed:', profileErr);
        if (profile?.user_group_tier) tier = profile.user_group_tier as UserGroupTier;
      } catch (e) {
        console.warn('[useActiveContext] profiles query threw:', e);
      }

      // ── Fetch membership tables in parallel, each isolated so one failure
      //    can't take down the whole context loader.
      const safeQuery = async (label: string, p: Promise<any>): Promise<any[]> => {
        try {
          const { data, error } = await p;
          if (error) {
            console.warn(`[useActiveContext] ${label} failed:`, error);
            return [];
          }
          return data ?? [];
        } catch (e) {
          console.warn(`[useActiveContext] ${label} threw:`, e);
          return [];
        }
      };

      const [teamRows, clubRows, academyRows] = await Promise.all([
        safeQuery('user_team_access',
          sb.from('user_team_access')
            .select('team_id, teams!inner(id, name, club_id)')
            .eq('user_id', user.id)),
        safeQuery('user_club_access',
          sb.from('user_club_access')
            .select('club_id, clubs!inner(id, name, academy_id)')
            .eq('user_id', user.id)),
        tier === 'amateur_professional'
          ? safeQuery('user_academies',
              sb.from('user_academies')
                .select('academy_id, role')
                .eq('user_id', user.id))
          : Promise.resolve([] as any[]),
      ]);

      const contexts: ActiveContext[] = [];

      // 1. Academy contexts from user_academies. Resolve names + owning club
      //    via plain follow-up queries (no nested embed, so no FK required).
      const academyIds = Array.from(
        new Set(academyRows.map((r: any) => r.academy_id).filter(Boolean))
      );
      const academyNameMap = new Map<string, string>();
      const academyClubMap = new Map<string, { clubId: string; clubName: string }>();
      if (academyIds.length > 0) {
        const academiesData = await safeQuery('academies lookup',
          sb.from('academies').select('id, name').in('id', academyIds));
        for (const a of academiesData) {
          if (a?.id) academyNameMap.set(a.id, a.name ?? '');
        }
        const clubsForAcademies = await safeQuery('clubs reverse lookup',
          sb.from('clubs').select('id, name, academy_id').in('academy_id', academyIds));
        for (const c of clubsForAcademies) {
          if (c?.academy_id && !academyClubMap.has(c.academy_id)) {
            academyClubMap.set(c.academy_id, { clubId: c.id, clubName: c.name ?? '' });
          }
        }
      }
      for (const row of academyRows) {
        const link = academyClubMap.get(row.academy_id);
        if (!link) continue; // need a club for downstream scoping
        const academyName = academyNameMap.get(row.academy_id) || '';
        contexts.push({
          kind: 'academy',
          id: row.academy_id,
          clubId: link.clubId,
          label: academyName || (link.clubName ? `${link.clubName} Academy` : 'Academy'),
          userGroupTier: tier,
        });
      }

      // 1b. Surface academy contexts derived from club access — only when
      //     clubs.academy_id is set. Skip duplicates from step 1.
      const seenAcademyIds = new Set(contexts.map(c => c.id));
      for (const row of clubRows) {
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
      for (const row of clubRows) {
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

      // 3. Team contexts
      for (const row of teamRows) {
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
    } catch (e) {
      console.error('[useActiveContext] load() failed:', e);
      setAvailableContexts([]);
      setActiveContextState(null);
    } finally {
      setLoading(false);
    }
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
