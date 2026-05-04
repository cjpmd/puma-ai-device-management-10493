import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { RadarChart } from '@/components/players/RadarChart';
import { AttributeSnapshotModal } from '@/components/players/AttributeSnapshotModal';
import { MaturationCalculator } from '@/components/players/MaturationCalculator';

const TABS = ['Overview', 'Attributes', 'History', 'Medical', 'Reviews'] as const;
type Tab = typeof TABS[number];

const currentSeason = (() => {
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`;
})();

function calcAge(dob?: string): string {
  if (!dob) return '—';
  return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)));
}

function posStyle(pos?: string): string {
  if (!pos) return 'bg-slate-100 text-slate-500';
  if (pos === 'GK') return 'bg-amber-100 text-amber-700';
  if (['CB','RB','LB','RWB','LWB'].includes(pos)) return 'bg-sky-100 text-sky-700';
  if (['CDM','CM','CAM'].includes(pos)) return 'bg-emerald-100 text-emerald-700';
  if (['RM','LM','RW','LW'].includes(pos)) return 'bg-violet-100 text-violet-700';
  if (['ST','CF'].includes(pos)) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-500';
}

function ACWRSparkline({ rows }: { rows: Array<{ session_date: string; acwr_at_time: number | null; load_au: number }> }) {
  if (!rows.length) return <p className="text-xs text-slate-400">No training load data.</p>;
  const W = 340, H = 80;
  const vals = rows.map(r => r.acwr_at_time ?? 0);
  const top  = Math.max(...vals, 2);
  const xOf  = (i: number) => (i / Math.max(rows.length - 1, 1)) * (W - 20) + 10;
  const yOf  = (v: number) => H - 10 - (v / top) * (H - 20);
  const pts  = rows.map((r, i) => `${xOf(i)},${yOf(r.acwr_at_time ?? 0)}`).join(' ');
  const line = (v: number, stroke: string) => (
    <line x1="0" y1={yOf(v)} x2={W} y2={yOf(v)} stroke={stroke} strokeDasharray="4 2" strokeWidth="1" />
  );
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      {line(1.5, '#fca5a5')} {line(1.3, '#fcd34d')}
      <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" />
      {rows.map((r, i) => {
        const a = r.acwr_at_time ?? 0;
        const fill = a >= 1.5 ? '#ef4444' : a >= 1.3 ? '#f59e0b' : '#7c3aed';
        return <circle key={i} cx={xOf(i)} cy={yOf(a)} r="3" fill={fill} />;
      })}
    </svg>
  );
}

export default function PlayerProfile() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [tab, setTab]           = useState<Tab>('Overview');
  const [showModal, setShowModal] = useState(false);

  // ── data queries ────────────────────────────────────────────────────────────
  const { data: player, isLoading } = useQuery({
    queryKey: ['player', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('players')
        .select('id, name, position, date_of_birth, team_id, teams(name, age_group), performance_summary')
        .eq('id', id!)
        .single();
      return data;
    },
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ['player-snapshots', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('attribute_snapshot')
        .select('id, scores, snapshot_date, season, is_final')
        .eq('player_id', id!)
        .eq('is_final', true)
        .order('snapshot_date', { ascending: false });
      return data ?? [];
    },
  });

  const { data: attrDefs = [] } = useQuery({
    queryKey: ['attr-defs'],
    enabled: !!player,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('attribute_definition')
        .select('id, name, category, max_value')
        .eq('is_active', true)
        .order('category');
      return data ?? [];
    },
  });

  const { data: matRecords = [] } = useQuery({
    queryKey: ['player-mat', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('maturation_record')
        .select('id, recorded_date, height_cm, weight_kg, seated_height_cm, bio_age_estimate, method_used')
        .eq('player_id', id!)
        .order('recorded_date', { ascending: false });
      return data ?? [];
    },
  });

  const { data: injuries = [] } = useQuery({
    queryKey: ['player-injuries', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('injury_record')
        .select('id, injury_type, body_part, severity, date_of_injury, expected_return_date, rtp_phase, is_resolved')
        .eq('player_id', id!)
        .order('date_of_injury', { ascending: false });
      return data ?? [];
    },
  });

  const { data: trainingLoad = [] } = useQuery({
    queryKey: ['player-load', id],
    enabled: !!id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 56);
      const { data } = await (supabase as any)
        .from('training_load')
        .select('session_date, load_au, acwr_at_time, session_type')
        .eq('player_id', id!)
        .gte('session_date', since.toISOString().split('T')[0])
        .order('session_date');
      return data ?? [];
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['player-milestones', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('milestones')
        .select('id, milestone_date, category, title, is_upcoming')
        .eq('player_id', id!)
        .order('milestone_date', { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  const { data: observations = [] } = useQuery({
    queryKey: ['player-obs', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('coach_observation')
        .select('id, observation_date, notes')
        .eq('player_id', id!)
        .order('observation_date', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // ── derived values ───────────────────────────────────────────────────────────
  if (isLoading) return <div className="p-6 text-slate-400 text-sm">Loading…</div>;
  if (!player)   return <div className="p-6 text-sm text-red-500">Player not found.</div>;

  const latestSnap = snapshots[0] ?? null;
  const prevSnap   = snapshots[1] ?? null;
  const latestMat  = matRecords[0] ?? null;
  const initials   = (player.name ?? '??').split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const activeInj  = injuries.filter((i: any) => !i.is_resolved);
  const latestACWR = trainingLoad.length ? (trainingLoad[trainingLoad.length - 1] as any).acwr_at_time : null;

  // Radar: average normalised score per category
  const radarData = (() => {
    if (!latestSnap?.scores || !attrDefs.length) return [];
    const cats: Record<string, number[]> = {};
    for (const def of attrDefs as any[]) {
      const score = latestSnap.scores[def.id];
      if (score == null) continue;
      (cats[def.category] ??= []).push(score / def.max_value);
    }
    return Object.entries(cats).map(([cat, vals]) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: vals.reduce((a, b) => a + b, 0) / vals.length,
      max: 1,
    }));
  })();

  const delta = (defId: string): number | null => {
    const curr = latestSnap?.scores?.[defId];
    const prev = prevSnap?.scores?.[defId];
    if (curr == null || prev == null) return null;
    return Math.round((curr - prev) * 10) / 10;
  };

  const rtp_labels = ['N/A', 'Gym only', 'Running', 'Training (non-contact)', 'Full training', 'Match ready'];

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/players')}
        className="text-xs text-slate-400 hover:text-slate-600 mb-4 inline-flex items-center gap-1 transition-colors"
      >
        ← Players
      </button>

      {/* Player header */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${posStyle(player.position)}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <PageHeader
            title={player.name}
            subtitle={[player.teams?.age_group, player.position, `Age ${calcAge(player.date_of_birth)}`].filter(Boolean).join(' · ')}
          />
        </div>
        {activeInj.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold flex-shrink-0">
            {activeInj.length} open {activeInj.length === 1 ? 'injury' : 'injuries'}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ════ OVERVIEW ════ */}
      {tab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Radar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Latest snapshot</div>
              {radarData.length
                ? <div className="flex justify-center"><RadarChart data={radarData} size={200} /></div>
                : <div className="py-10 text-center text-sm text-slate-400">No snapshot yet</div>}
            </div>

            {/* Maturation */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Maturation</div>
              {latestMat ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-slate-900">
                      {latestMat.bio_age_estimate > 0 ? '+' : ''}{latestMat.bio_age_estimate}
                    </span>
                    <span className="text-sm text-slate-400">yrs from PHV</span>
                    <span className={`ml-auto text-xs font-semibold border rounded px-2 py-0.5 ${
                      latestMat.bio_age_estimate > 1  ? 'bg-orange-50 text-orange-700 border-orange-200'
                      : latestMat.bio_age_estimate < -1 ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {latestMat.bio_age_estimate > 1 ? 'Early' : latestMat.bio_age_estimate < -1 ? 'Late' : 'On time'}
                    </span>
                  </div>
                  {/* PHV slider bar */}
                  <div className="relative h-3 bg-slate-100 rounded-full">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
                    <div
                      className={`absolute top-1 bottom-1 w-2 rounded-full ${
                        latestMat.bio_age_estimate > 1 ? 'bg-orange-400' : latestMat.bio_age_estimate < -1 ? 'bg-sky-400' : 'bg-emerald-400'
                      }`}
                      style={{ left: `calc(${Math.max(5, Math.min(95, 50 + (latestMat.bio_age_estimate / 3) * 45))}% - 4px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-300">
                    <span>−3 yrs</span><span>PHV</span><span>+3 yrs</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {latestMat.height_cm}cm · {latestMat.weight_kg}kg · {latestMat.method_used} · {latestMat.recorded_date}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">No maturation record yet.</p>
              )}
              <MaturationCalculator
                playerId={player.id}
                dob={player.date_of_birth}
                onSaved={() => qc.invalidateQueries({ queryKey: ['player-mat', id] })}
              />
            </div>
          </div>

          {/* Milestone timeline */}
          {milestones.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Milestone timeline</div>
              <div className="space-y-2">
                {(milestones as any[]).map(m => (
                  <div key={m.id} className="flex items-start gap-3 text-sm">
                    <span className="w-24 flex-shrink-0 text-xs text-slate-400 pt-0.5">{m.milestone_date}</span>
                    <span className={`flex-shrink-0 text-xs rounded px-1.5 py-0.5 ${
                      m.is_upcoming ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'
                    }`}>{m.category}</span>
                    <span className="text-slate-700">{m.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ ATTRIBUTES ════ */}
      {tab === 'Attributes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {latestSnap
                ? `Latest: ${latestSnap.snapshot_date} · ${latestSnap.season ?? ''}`
                : 'No finalised snapshots yet'}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              + New snapshot
            </button>
          </div>

          {attrDefs.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No attribute definitions configured.</p>
          ) : (
            ['technical','physical','tactical','mental'].map(cat => {
              const defs = (attrDefs as any[]).filter(d => d.category === cat);
              if (!defs.length) return null;
              return (
                <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">
                    {cat}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {defs.map((def: any) => {
                      const score = latestSnap?.scores?.[def.id];
                      const d     = delta(def.id);
                      return (
                        <div key={def.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="flex-1 text-sm text-slate-700">{def.name}</span>
                          <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            {score != null && (
                              <div className="h-full bg-violet-500 rounded-full"
                                style={{ width: `${(score / def.max_value) * 100}%` }} />
                            )}
                          </div>
                          <span className="w-8 text-right text-sm font-semibold text-slate-700">
                            {score ?? '—'}
                          </span>
                          {d != null && (
                            <span className={`w-9 text-right text-xs font-medium ${
                              d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-500' : 'text-slate-400'
                            }`}>
                              {d > 0 ? `+${d}` : d}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {showModal && (
            <AttributeSnapshotModal
              playerId={player.id}
              season={currentSeason}
              onClose={() => setShowModal(false)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['player-snapshots', id] });
                setShowModal(false);
              }}
            />
          )}
        </div>
      )}

      {/* ════ HISTORY ════ */}
      {tab === 'History' && (
        <div>
          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No snapshot history yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Season</th>
                    <th className="text-right px-4 py-3">Avg rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(snapshots as any[]).map(s => {
                    const vals = s.scores
                      ? Object.values(s.scores as Record<string, number>).filter((v): v is number => typeof v === 'number')
                      : [];
                    const avg  = vals.length
                      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
                      : null;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-700">{s.snapshot_date}</td>
                        <td className="px-4 py-2.5 text-slate-500">{s.season ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-700">
                          {avg != null ? `${avg}/10` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════ MEDICAL ════ */}
      {tab === 'Medical' && (
        <div className="space-y-5">
          {/* ACWR chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">ACWR — last 8 weeks</div>
              {latestACWR != null && (
                <span className={`text-xs font-semibold border rounded px-2 py-0.5 ${
                  latestACWR >= 1.5 ? 'bg-red-50 text-red-700 border-red-200'
                  : latestACWR >= 1.3 ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Current: {latestACWR}
                </span>
              )}
            </div>
            <ACWRSparkline rows={trainingLoad as any[]} />
            <div className="mt-1 flex gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed border-red-300 inline-block" /> 1.5 danger</span>
              <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed border-yellow-300 inline-block" /> 1.3 caution</span>
            </div>
          </div>

          {/* Injury list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Injury records</div>
              <span className="text-xs text-slate-400">{injuries.length} total · {activeInj.length} open</span>
            </div>
            {injuries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No injuries recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(injuries as any[]).map(inj => (
                  <div key={inj.id} className="px-4 py-3 flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${inj.is_resolved ? 'bg-slate-300' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-700">{inj.body_part} — {inj.injury_type}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {inj.date_of_injury}
                        {inj.expected_return_date ? ` · exp. return ${inj.expected_return_date}` : ''}
                        {' · '}{rtp_labels[inj.rtp_phase] ?? `Phase ${inj.rtp_phase}`}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      inj.is_resolved ? 'bg-slate-100 text-slate-500'
                      : inj.severity >= 3 ? 'bg-red-100 text-red-700'
                      : inj.severity === 2 ? 'bg-amber-100 text-amber-700'
                      : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {inj.is_resolved ? 'Resolved' : `Sev ${inj.severity}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ REVIEWS ════ */}
      {tab === 'Reviews' && (
        <div className="space-y-3">
          {observations.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">No coach observations yet.</p>
          ) : (
            (observations as any[]).map(obs => (
              <div key={obs.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-400 mb-2">{obs.observation_date}</div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{obs.notes || 'No notes.'}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
