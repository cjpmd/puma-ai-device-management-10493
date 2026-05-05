import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Bar,
  ReferenceLine,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import AttributeSnapshotModal from '../components/players/AttributeSnapshotModal';
import MaturationCalculator from '../components/players/MaturationCalculator';

const sb = supabase as any;

type Tab = 'overview' | 'attributes' | 'history' | 'medical' | 'reviews';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',    label: 'Overview'    },
  { id: 'attributes',  label: 'Attributes'  },
  { id: 'history',     label: 'History'     },
  { id: 'medical',     label: 'Medical'     },
  { id: 'reviews',     label: 'Reviews'     },
];

const CATEGORIES = ['technical', 'physical', 'tactical', 'mental'] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLORS: Record<Category, string> = {
  technical: '#8b5cf6',
  physical:  '#10b981',
  tactical:  '#3b82f6',
  mental:    '#f59e0b',
};

const RTP_LABELS = ['', 'Gym only', 'Running', 'Non-contact training', 'Full training', 'Match ready'];
const REVIEW_TYPES = ['general', 'technical', 'physical', 'tactical', 'mental'];
const REVIEW_BADGE: Record<string, string> = {
  technical: 'bg-violet-500/20 text-violet-300',
  physical:  'bg-emerald-500/20 text-emerald-300',
  tactical:  'bg-blue-500/20 text-blue-300',
  mental:    'bg-amber-500/20 text-amber-300',
  general:   'bg-white/10 text-white/60',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function seasonStart(): string {
  const d = new Date();
  d.setMonth(7, 1);
  if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

function chronoAge(dob: string): number {
  return (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000);
}

type AttrDef = { id: string; name: string; category: string; max_value: number };

function snapshotAverage(scores: Record<string, number>, defs: AttrDef[]): number {
  const defMap = new Map(defs.map((d) => [d.id, d.max_value]));
  const vals = Object.entries(scores)
    .filter(([id]) => defMap.has(id))
    .map(([id, v]) => (v / (defMap.get(id) ?? 10)) * 10);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function categoryAverages(scores: Record<string, number>, defs: AttrDef[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    const catDefs = defs.filter((d) => d.category === cat);
    if (!catDefs.length) { result[cat] = 0; continue; }
    const vals = catDefs.map((d) => ((scores[d.id] ?? 0) / d.max_value) * 10);
    result[cat] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
  }
  return result;
}

// ── Maturation Bar ────────────────────────────────────────────────────────────

function MaturationBar({ bioAge, ca }: { bioAge: number; ca: number }) {
  const MIN = 9, MAX = 18;
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v - MIN) / (MAX - MIN)) * 100));
  const offset = bioAge - ca;
  const badge =
    offset > 1.0  ? { label: 'Early',   cls: 'bg-orange-500/20 text-orange-300' } :
    offset < -1.0 ? { label: 'Late',    cls: 'bg-sky-500/20 text-sky-300' } :
                    { label: 'On time', cls: 'bg-emerald-500/20 text-emerald-300' };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        <span className="text-white/50 text-xs">
          Maturity offset: {offset >= 0 ? '+' : ''}{offset.toFixed(2)} yrs
        </span>
      </div>
      <div className="relative h-4 bg-white/10 rounded-full mx-1">
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-sky-400 border-2 border-slate-900 z-10"
          style={{ left: `calc(${clamp(ca)}% - 6px)` }} title={`Chrono: ${ca.toFixed(1)}`} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-orange-400 border-2 border-slate-900 z-10"
          style={{ left: `calc(${clamp(bioAge)}% - 6px)` }} title={`Bio: ${bioAge.toFixed(1)}`} />
      </div>
      <div className="flex justify-between text-xs text-white/25 px-1">
        {[9,10,11,12,13,14,15,16,17,18].map((y) => <span key={y}>{y}</span>)}
      </div>
      <div className="flex gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Chrono {ca.toFixed(1)}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Bio {bioAge.toFixed(1)}</span>
      </div>
      <p className="text-white/40 text-xs">
        {offset > 1.0  ? 'Biologically advanced — consider relative age when interpreting performance metrics.' :
         offset < -1.0 ? 'Late developer — potential likely to emerge post-PHV. Monitor training load carefully.' :
                          'Developing in line with chronological age.'}
      </p>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ playerId, dob, defs }: { playerId: string; dob: string; defs: AttrDef[] }) {
  const qc = useQueryClient();
  const season = seasonStart();
  const ca = chronoAge(dob);
  const [showMatCalc, setShowMatCalc] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['player-season-stats', playerId, season],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await sb
        .from('team_event_player_stats')
        .select('appearances, minutes_played, goals, assists')
        .eq('player_id', playerId)
        .gte('season_start', season);
      if (!data?.length) return { appearances: 0, minutes: 0, goals: 0, assists: 0 };
      return data.reduce(
        (acc: any, r: any) => ({
          appearances: acc.appearances + (r.appearances ?? 0),
          minutes:     acc.minutes     + (r.minutes_played ?? 0),
          goals:       acc.goals       + (r.goals ?? 0),
          assists:     acc.assists     + (r.assists ?? 0),
        }),
        { appearances: 0, minutes: 0, goals: 0, assists: 0 },
      );
    },
  });

  const { data: matRecord, refetch: refetchMat } = useQuery({
    queryKey: ['player-mat-latest', playerId],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb
        .from('maturation_record')
        .select('bio_age_estimate, recorded_date')
        .eq('player_id', playerId)
        .order('recorded_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ['player-snapshots-radar', playerId],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await sb
        .from('attribute_snapshot')
        .select('scores, snapshot_date')
        .eq('player_id', playerId)
        .eq('is_final', true)
        .order('snapshot_date', { ascending: false })
        .limit(2);
      return (data ?? []) as { scores: Record<string, number>; snapshot_date: string }[];
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['player-milestones', playerId],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await sb
        .from('milestones')
        .select('id, title, description, achieved_date, is_upcoming')
        .eq('player_id', playerId)
        .order('achieved_date', { ascending: false });
      return data ?? [];
    },
  });

  const statCards = [
    { label: 'Appearances', value: stats?.appearances ?? 0 },
    { label: 'Minutes',     value: stats?.minutes     ?? 0 },
    { label: 'Goals',       value: stats?.goals       ?? 0 },
    { label: 'Assists',     value: stats?.assists     ?? 0 },
  ];

  const radarData = CATEGORIES.map((cat) => ({
    subject:  cat.charAt(0).toUpperCase() + cat.slice(1),
    current:  snapshots[0]?.scores ? categoryAverages(snapshots[0].scores, defs)[cat] : 0,
    previous: snapshots[1]?.scores ? categoryAverages(snapshots[1].scores, defs)[cat] : 0,
  }));

  function handleMatSuccess() {
    refetchMat();
    qc.invalidateQueries({ queryKey: ['player-mat-latest', playerId] });
    setShowMatCalc(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{c.value.toLocaleString()}</p>
            <p className="text-white/50 text-xs mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Maturation</h3>
        {matRecord ? (
          <div className="space-y-4">
            <MaturationBar bioAge={matRecord.bio_age_estimate} ca={ca} />
            <button onClick={() => setShowMatCalc(true)} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Update measurement
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-white/40 text-sm">No maturation record — add one</p>
            <button onClick={() => setShowMatCalc(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Add maturation record
            </button>
          </div>
        )}
      </div>

      {showMatCalc && (
        <MaturationCalculator
          playerId={playerId}
          playerDob={dob}
          onClose={() => setShowMatCalc(false)}
          onSuccess={handleMatSuccess}
        />
      )}

      <div className="bg-white/5 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Attribute Radar</h3>
        {snapshots.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">No attribute snapshots recorded yet.</p>
        ) : (
          <>
            {snapshots.length < 2 && (
              <p className="text-white/40 text-xs mb-3">Only one snapshot — add another to see progression.</p>
            )}
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                {snapshots.length >= 2 && (
                  <Radar name="Previous" dataKey="previous" stroke="rgba(148,163,184,0.6)" fill="rgba(148,163,184,0.1)" strokeDasharray="4 2" />
                )}
                <Radar name="Current" dataKey="current" stroke="#8b5cf6" fill="rgba(139,92,246,0.25)" />
              </RadarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="bg-white/5 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Milestones</h3>
        {(milestones as any[]).length === 0 ? (
          <p className="text-white/40 text-sm">No milestones recorded.</p>
        ) : (
          <div className="space-y-3">
            {(milestones as any[]).map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.is_upcoming ? 'opacity-55' : ''}`}>
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${m.is_upcoming ? 'bg-white/20 border border-white/30' : 'bg-violet-400'}`} />
                <div>
                  <p className="text-white text-sm">{m.title}</p>
                  {m.description && <p className="text-white/40 text-xs mt-0.5">{m.description}</p>}
                  <p className="text-white/30 text-xs mt-0.5">
                    {m.is_upcoming ? 'Upcoming' : m.achieved_date ? new Date(m.achieved_date).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Attributes Tab ────────────────────────────────────────────────────────────

function AttributesTab({ playerId, defs }: { playerId: string; defs: AttrDef[] }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: snapshots = [], refetch } = useQuery({
    queryKey: ['player-snapshots-attrs', playerId],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await sb
        .from('attribute_snapshot')
        .select('id, scores, snapshot_date')
        .eq('player_id', playerId)
        .eq('is_final', true)
        .order('snapshot_date', { ascending: false })
        .limit(2);
      return (data ?? []) as { id: string; scores: Record<string, number>; snapshot_date: string }[];
    },
  });

  const current  = snapshots[0]?.scores ?? {};
  const previous = snapshots[1]?.scores ?? {};

  function handleSuccess() {
    setShowModal(false);
    refetch();
    qc.invalidateQueries({ queryKey: ['player-snapshots-radar', playerId] });
    qc.invalidateQueries({ queryKey: ['player-snapshot-latest', playerId] });
  }

  return (
    <>
      {showModal && (
        <AttributeSnapshotModal
          playerId={playerId}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-white/40 text-sm">
            {snapshots[0] ? `Latest: ${new Date(snapshots[0].snapshot_date).toLocaleDateString()}` : 'No snapshots'}
          </p>
          <button onClick={() => setShowModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            New Snapshot
          </button>
        </div>
        {CATEGORIES.map((cat) => {
          const catDefs = defs.filter((d) => d.category === cat);
          if (!catDefs.length) return null;
          return (
            <div key={cat} className="bg-white/5 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4 capitalize">{cat}</h3>
              <div className="space-y-3">
                {catDefs.map((def) => {
                  const score = current[def.id]  ?? 0;
                  const prev  = previous[def.id] ?? null;
                  const pct   = (score / def.max_value) * 100;
                  const delta = prev !== null ? Math.round((score - prev) * 10) / 10 : null;
                  return (
                    <div key={def.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-sm">{def.name}</span>
                        <div className="flex items-center gap-2">
                          {delta !== null && delta !== 0 && (
                            <span className={`text-xs font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {delta > 0 ? '+' : ''}{delta}
                            </span>
                          )}
                          <span className="text-white font-medium text-sm w-12 text-right">{score}/{def.max_value}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: CAT_COLORS[cat] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ playerId, defs }: { playerId: string; defs: AttrDef[] }) {
  const { data: allSnapshots = [] } = useQuery({
    queryKey: ['player-snapshots-history', playerId],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb
        .from('attribute_snapshot')
        .select('scores, snapshot_date')
        .eq('player_id', playerId)
        .eq('is_final', true)
        .order('snapshot_date', { ascending: true });
      return (data ?? []) as { scores: Record<string, number>; snapshot_date: string }[];
    },
  });

  const { data: seasonHistory = [] } = useQuery({
    queryKey: ['player-season-history', playerId],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb
        .from('team_event_player_stats')
        .select('season_start, age_group, appearances, minutes_played')
        .eq('player_id', playerId)
        .order('season_start', { ascending: false });
      return data ?? [];
    },
  });

  const lineData = allSnapshots.map((s) => ({
    date:   s.snapshot_date,
    rating: snapshotAverage(s.scores, defs),
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Rating Over Time</h3>
        {lineData.length < 2 ? (
          <p className="text-white/40 text-sm text-center py-8">Need at least 2 snapshots to show trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={(v) => v.slice(0, 7)} />
              <YAxis domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e1b4b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
              <Line type="monotone" dataKey="rating" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white/5 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Season History</h3>
        {(seasonHistory as any[]).length === 0 ? (
          <p className="text-white/40 text-sm">No season data recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="pb-2 font-medium">Season</th>
                <th className="pb-2 font-medium">Age Group</th>
                <th className="pb-2 font-medium text-right">Apps</th>
                <th className="pb-2 font-medium text-right">Minutes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(seasonHistory as any[]).map((r, i) => (
                <tr key={i}>
                  <td className="py-2 text-white">{r.season_start ? String(r.season_start).slice(0, 4) : '—'}</td>
                  <td className="py-2 text-white/60">{r.age_group ?? '—'}</td>
                  <td className="py-2 text-white text-right">{r.appearances ?? 0}</td>
                  <td className="py-2 text-white/60 text-right">{r.minutes_played ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Medical Tab ───────────────────────────────────────────────────────────────

function MedicalTab({ playerId, dob }: { playerId: string; dob?: string }) {
  const qc = useQueryClient();
  const [showMatCalc, setShowMatCalc] = useState(false);
  const eightWeeksAgo = new Date(Date.now() - 56 * 86_400_000).toISOString().split('T')[0];

  const { data: injuries = [] } = useQuery({
    queryKey: ['player-injuries', playerId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('injury_record')
        .select('*')
        .eq('player_id', playerId)
        .order('injury_date', { ascending: false });
      return data ?? [];
    },
  });

  const { data: loads = [] } = useQuery({
    queryKey: ['player-loads-8w', playerId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('training_load')
        .select('session_date, load_au, acwr_at_time')
        .eq('player_id', playerId)
        .gte('session_date', eightWeeksAgo)
        .order('session_date', { ascending: true });
      return data ?? [];
    },
  });

  const active   = (injuries as any[]).find((i) => !i.resolved_at) ?? null;
  const resolved = (injuries as any[]).filter((i) => !!i.resolved_at);

  const recurrenceIds = new Set<string>();
  for (const inj of resolved) {
    for (const prev of resolved) {
      if (prev.id === inj.id || prev.body_part !== inj.body_part || !prev.resolved_at) continue;
      const gap = (new Date(inj.injury_date).getTime() - new Date(prev.resolved_at).getTime()) / 86_400_000;
      if (gap >= 0 && gap <= 56) recurrenceIds.add(inj.id);
    }
  }

  const loadChartData = (loads as any[]).map((l) => ({
    date: (l.session_date as string).slice(5),
    load: l.load_au,
    acwr: l.acwr_at_time ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          active ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
        }`}>
          {active ? 'Injured' : 'Available'}
        </span>
        {dob && (
          <button onClick={() => setShowMatCalc(true)} className="ml-auto text-sm text-white/40 hover:text-white/70 transition-colors">
            Update maturation record
          </button>
        )}
      </div>

      {showMatCalc && dob && (
        <MaturationCalculator
          playerId={playerId}
          playerDob={dob}
          onClose={() => setShowMatCalc(false)}
          onSuccess={() => {
            setShowMatCalc(false);
            qc.invalidateQueries({ queryKey: ['player-mat-latest', playerId] });
          }}
        />
      )}

      {active && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <h3 className="text-white font-medium mb-3">Active Injury</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-white/40 text-xs mb-0.5">Type</p><p className="text-white">{active.injury_type ?? '—'}</p></div>
            <div><p className="text-white/40 text-xs mb-0.5">Body part</p><p className="text-white">{active.body_part ?? '—'}</p></div>
            <div><p className="text-white/40 text-xs mb-0.5">Since</p><p className="text-white">{new Date(active.injury_date).toLocaleDateString()}</p></div>
            <div>
              <p className="text-white/40 text-xs mb-0.5">RTP phase</p>
              <p className="text-white">{active.rtp_phase ? `${active.rtp_phase} — ${RTP_LABELS[active.rtp_phase] ?? ''}` : 'Not started'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">8-week Load</h3>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-violet-500 inline-block" /> Load (AU)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" /> ACWR</span>
          </div>
        </div>
        {loadChartData.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">No load data in the last 8 weeks.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={loadChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
              <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 2.5]} tickCount={6} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e1b4b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="load" name="Load (AU)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="acwr" name="ACWR" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
              <ReferenceLine yAxisId="right" y={1.5} stroke="rgba(239,68,68,0.5)"  strokeDasharray="4 2" />
              <ReferenceLine yAxisId="right" y={1.3} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white/5 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Injury History</h3>
        {resolved.length === 0 ? (
          <p className="text-white/40 text-sm">No resolved injuries.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Body part</th>
                <th className="pb-2 font-medium">Resolved</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {resolved.map((inj: any) => (
                <tr key={inj.id}>
                  <td className="py-2 text-white/60">{new Date(inj.injury_date).toLocaleDateString()}</td>
                  <td className="py-2 text-white">{inj.injury_type ?? '—'}</td>
                  <td className="py-2 text-white/60">{inj.body_part ?? '—'}</td>
                  <td className="py-2 text-white/60">{inj.resolved_at ? new Date(inj.resolved_at).toLocaleDateString() : '—'}</td>
                  <td className="py-2">
                    {recurrenceIds.has(inj.id) && (
                      <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">Recurrence</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Reviews Tab ───────────────────────────────────────────────────────────────

function ReviewsTab({ playerId }: { playerId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: 'general', notes: '', tags: '' });
  const [saving, setSaving] = useState(false);

  const { data: reviews = [] } = useQuery({
    queryKey: ['player-reviews', playerId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb
        .from('coach_observation')
        .select('*')
        .eq('player_id', playerId)
        .order('observed_at', { ascending: false });
      return data ?? [];
    },
  });

  async function addReview() {
    if (!form.notes.trim()) return;
    setSaving(true);
    await sb.from('coach_observation').insert({
      player_id:        playerId,
      observation_type: form.type,
      notes:            form.notes.trim(),
      tags:             form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      observed_at:      new Date().toISOString(),
    });
    qc.invalidateQueries({ queryKey: ['player-reviews', playerId] });
    setForm({ type: 'general', notes: '', tags: '' });
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-2xl p-5 space-y-3">
        <h3 className="text-white font-medium">Add Review</h3>
        <div className="flex gap-3">
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
            {REVIEW_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <input placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500" />
        </div>
        <textarea placeholder="Observation notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 resize-none" />
        <button onClick={addReview} disabled={saving || !form.notes.trim()}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Add review'}
        </button>
      </div>

      {(reviews as any[]).length === 0 ? (
        <p className="text-white/40 text-sm">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {(reviews as any[]).map((r) => (
            <div key={r.id} className="bg-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${REVIEW_BADGE[r.observation_type] ?? REVIEW_BADGE.general}`}>{r.observation_type}</span>
                <span className="text-white/30 text-xs">{new Date(r.observed_at).toLocaleDateString()}</span>
              </div>
              <p className="text-white/80 text-sm">{r.notes}</p>
              {Array.isArray(r.tags) && r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(r.tags as string[]).map((tag) => (
                    <span key={tag} className="text-xs bg-white/5 text-white/40 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PlayerProfile() {
  const { id: playerId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: player } = useQuery({
    queryKey: ['player-detail', playerId],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb
        .from('players')
        .select('id, name, date_of_birth, dominant_foot, position, team_id, teams(name, age_group)')
        .eq('id', playerId)
        .single();
      return data;
    },
  });

  const { data: defs = [] } = useQuery<AttrDef[]>({
    queryKey: ['attribute-defs'],
    staleTime: 600_000,
    queryFn: async () => {
      const { data } = await sb
        .from('attribute_definition')
        .select('id, name, category, max_value')
        .eq('is_active', true)
        .order('category')
        .order('name');
      return (data ?? []) as AttrDef[];
    },
  });

  const { data: latestSnaps = [] } = useQuery({
    queryKey: ['player-snapshot-latest', playerId],
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await sb
        .from('attribute_snapshot')
        .select('scores, snapshot_date')
        .eq('player_id', playerId)
        .eq('is_final', true)
        .order('snapshot_date', { ascending: false })
        .limit(2);
      return (data ?? []) as { scores: Record<string, number>; snapshot_date: string }[];
    },
  });

  const overallRating = latestSnaps[0] && defs.length ? snapshotAverage(latestSnaps[0].scores, defs) : null;
  const prevRating    = latestSnaps[1] && defs.length ? snapshotAverage(latestSnaps[1].scores, defs) : null;
  const delta = overallRating !== null && prevRating !== null ? Math.round((overallRating - prevRating) * 10) / 10 : null;

  const initials = player?.name
    ? player.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const tabContent: Record<Tab, React.ReactNode> = {
    overview:   player ? <OverviewTab  playerId={playerId!} dob={player.date_of_birth} defs={defs} /> : null,
    attributes: <AttributesTab playerId={playerId!} defs={defs} />,
    history:    <HistoryTab    playerId={playerId!} defs={defs} />,
    medical:    <MedicalTab    playerId={playerId!} dob={player?.date_of_birth} />,
    reviews:    <ReviewsTab    playerId={playerId!} />,
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link to="/players" className="inline-block text-white/40 hover:text-white/70 text-sm transition-colors">
        ← Players
      </Link>

      <div className="flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white text-2xl font-bold leading-tight">{player?.name ?? 'Loading…'}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-white/50">
            {player?.date_of_birth && <span>DOB: {new Date(player.date_of_birth).toLocaleDateString()}</span>}
            {player?.teams?.name && <span>{player.teams.name}{player.teams.age_group ? ` · ${player.teams.age_group}` : ''}</span>}
            {player?.dominant_foot && <span>Foot: {player.dominant_foot}</span>}
            {player?.position && <span>{player.position}</span>}
          </div>
        </div>
        {overallRating !== null && (
          <div className="text-right flex-shrink-0">
            <p className="text-5xl font-bold text-white tabular-nums">{overallRating}</p>
            {delta !== null && (
              <p className={`text-sm font-medium mt-1 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {delta >= 0 ? '+' : ''}{delta} season
              </p>
            )}
            <p className="text-white/30 text-xs mt-0.5">Overall</p>
          </div>
        )}
      </div>

      <div className="flex gap-0 border-b border-white/10">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id ? 'border-violet-500 text-white' : 'border-transparent text-white/50 hover:text-white/80'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div>{tabContent[activeTab]}</div>
    </div>
  );
}
