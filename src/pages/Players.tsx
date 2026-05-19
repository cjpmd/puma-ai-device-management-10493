import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActiveContext } from '@/contexts/ActiveContextContext';

const POSITIONS = ['GK','CB','RB','LB','RWB','LWB','CDM','CM','CAM','RM','LM','RW','LW','ST','CF'];
const MAT_OPTIONS = ['', 'Early', 'On time', 'Late'] as const;

function positionStyle(pos?: string): string {
  if (!pos) return 'bg-slate-100 text-slate-500';
  if (pos === 'GK') return 'bg-amber-100 text-amber-700';
  if (['CB','RB','LB','RWB','LWB'].includes(pos)) return 'bg-sky-100 text-sky-700';
  if (['CDM','CM','CAM'].includes(pos)) return 'bg-emerald-100 text-emerald-700';
  if (['RM','LM','RW','LW'].includes(pos)) return 'bg-violet-100 text-violet-700';
  if (['ST','CF'].includes(pos)) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-500';
}

function overallRating(scores?: Record<string, number> | null): number | null {
  if (!scores) return null;
  const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

type MatBadge = { label: 'Early' | 'On time' | 'Late'; style: string };
function matBadge(offset?: number | null): MatBadge | null {
  if (offset == null) return null;
  if (offset > 1.0)  return { label: 'Early',   style: 'bg-orange-50 text-orange-700 border-orange-200' };
  if (offset < -1.0) return { label: 'Late',    style: 'bg-sky-50 text-sky-700 border-sky-200' };
  return               { label: 'On time', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

export default function Players() {
  const { activeContext } = useActiveContext();
  const clubId = activeContext?.clubId ?? null;
  const teamId = activeContext?.kind === 'team' ? activeContext.id : null;

  const [search,    setSearch]    = useState('');
  const [ageGroup,  setAgeGroup]  = useState('');
  const [position,  setPosition]  = useState('');
  const [matFilter, setMatFilter] = useState('');

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players-directory', activeContext?.id],
    enabled: !!activeContext,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = supabase as any;
      const col = teamId ? 'team_id' : 'club_id';
      const val = teamId ?? clubId;
      const [{ data: pl }, { data: snaps }, { data: mats }] = await Promise.all([
        sb.from('players')
          .select('id, name, position, date_of_birth, team_id, teams(name, age_group)')
          .eq(col, val)
          .order('name'),
        sb.from('attribute_snapshot')
          .select('player_id, scores, snapshot_date, players!inner(club_id, team_id)')
          .eq(`players.${col}`, val)
          .eq('is_final', true)
          .order('snapshot_date', { ascending: false }),
        sb.from('maturation_record')
          .select('player_id, bio_age_estimate, recorded_date, players!inner(club_id, team_id)')
          .eq(`players.${col}`, val)
          .order('recorded_date', { ascending: false }),
      ]);

      // Index only the most recent record per player for each data set
      const snapMap = new Map<string, any>();
      for (const s of (snaps ?? [])) if (!snapMap.has(s.player_id)) snapMap.set(s.player_id, s);

      const matMap = new Map<string, any>();
      for (const m of (mats ?? [])) if (!matMap.has(m.player_id)) matMap.set(m.player_id, m);

      return (pl ?? []).map((p: any) => ({
        ...p,
        latestSnapshot: snapMap.get(p.id) ?? null,
        latestMat:      matMap.get(p.id)  ?? null,
      }));
    },
  });

  const ageGroups = useMemo(() => {
    const s = new Set<string>();
    for (const p of players) if (p.teams?.age_group) s.add(p.teams.age_group);
    return Array.from(s).sort();
  }, [players]);

  const filtered = useMemo(() => players.filter((p: any) => {
    if (search    && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (ageGroup  && p.teams?.age_group !== ageGroup)                       return false;
    if (position  && p.position !== position)                               return false;
    if (matFilter) {
      const b = matBadge(p.latestMat?.bio_age_estimate);
      if (!b || b.label !== matFilter) return false;
    }
    return true;
  }), [players, search, ageGroup, position, matFilter]);

  if (isLoading) return <div className="p-6 text-slate-400 text-sm">Loading players…</div>;

  const hasFilters = search || ageGroup || position || matFilter;

  return (
    <div className="p-6">
      <PageHeader
        title="Players"
        subtitle={
          filtered.length !== players.length
            ? `${filtered.length} of ${players.length} players`
            : `${players.length} players`
        }
      />

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm w-44
                     focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-slate-400"
          placeholder="Search name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-violet-300"
          value={ageGroup}
          onChange={e => setAgeGroup(e.target.value)}
        >
          <option value="">All age groups</option>
          {ageGroups.map(ag => <option key={ag} value={ag}>{ag}</option>)}
        </select>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-violet-300"
          value={position}
          onChange={e => setPosition(e.target.value)}
        >
          <option value="">All positions</option>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-violet-300"
          value={matFilter}
          onChange={e => setMatFilter(e.target.value)}
        >
          <option value="">All maturation</option>
          {MAT_OPTIONS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {hasFilters && (
          <button
            className="px-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => { setSearch(''); setAgeGroup(''); setPosition(''); setMatFilter(''); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Player grid */}
      {filtered.length === 0 ? (
        <div className="mt-20 text-center text-sm text-slate-400">
          No players match the current filters.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((p: any) => {
            const pStyle  = positionStyle(p.position);
            const rating  = overallRating(p.latestSnapshot?.scores);
            const badge   = matBadge(p.latestMat?.bio_age_estimate);
            const initials = (p.name ?? '??')
              .split(' ')
              .map((w: string) => w[0] ?? '')
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <Link
                key={p.id}
                to={`/players/${p.id}`}
                className="bg-white rounded-xl border border-slate-200 p-4
                           hover:border-violet-300 hover:shadow-sm transition-all
                           flex flex-col gap-2 group"
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center
                                 text-sm font-bold flex-shrink-0 ${pStyle}`}>
                  {initials}
                </div>

                {/* Name + squad */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate
                                  group-hover:text-violet-700 transition-colors">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {[p.teams?.age_group, p.position].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>

                {/* Rating + maturation badge */}
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-600">
                    {rating != null ? `${rating}/10` : '—'}
                  </span>
                  {badge && (
                    <span className={`text-[10px] font-semibold border rounded px-1.5 py-0.5 ${badge.style}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
