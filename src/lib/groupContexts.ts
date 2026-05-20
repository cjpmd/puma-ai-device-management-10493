import type { ActiveContext } from '@/hooks/useActiveContext';

export interface ClubNode {
  clubId: string;
  label: string;
  clubCtx: ActiveContext | null;
  academies: ActiveContext[];
  teams: ActiveContext[];
}

/**
 * Group flat availableContexts into a Club → (Academies + Teams) tree.
 * Shared between iOS HierarchicalContextPicker and ProfileScreen "My Teams".
 */
export function groupContextsByClub(contexts: ActiveContext[]): ClubNode[] {
  const byId = new Map<string, ClubNode>();
  const ensure = (clubId: string, label: string, clubCtx: ActiveContext | null) => {
    let n = byId.get(clubId);
    if (!n) {
      n = { clubId, label, clubCtx, academies: [], teams: [] };
      byId.set(clubId, n);
    } else if (clubCtx && !n.clubCtx) {
      n.clubCtx = clubCtx;
      n.label = label;
    }
    return n;
  };
  for (const c of contexts) {
    if (c.kind === 'club') {
      ensure(c.clubId, c.label, c);
    } else if (c.kind === 'academy') {
      const node = ensure(c.clubId, c.label.replace(/\s+Academy$/, ''), null);
      if (!node.academies.find(a => a.id === c.id)) node.academies.push(c);
    } else if (c.kind === 'team') {
      const node = ensure(c.clubId, c.label, null);
      if (!node.teams.find(t => t.id === c.id)) node.teams.push(c);
    }
  }
  return Array.from(byId.values());
}