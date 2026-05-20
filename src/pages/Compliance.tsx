import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActiveContext } from '@/contexts/ActiveContextContext';

const sb = supabase as any;

type AuditEntry = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  user_id: string;
  created_at: string;
};

type CoachRecord = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  uefa_licence: string | null;
  fa_safeguarding_expiry: string | null;
  dbs_expiry: string | null;
  pvg_expiry: string | null;
  accessni_expiry: string | null;
  background_check_type: string | null;
  first_aid_expiry: string | null;
};

const EPPP_CHECKLIST = [
  { id: 'player_profiles', label: 'Player profiles ≥ 80% complete', table: 'players', weight: 15 },
  { id: 'attribute_snapshots', label: 'Attribute snapshots logged this season', table: 'attribute_snapshot', weight: 15 },
  { id: 'maturation_records', label: 'Maturation assessments recorded', table: 'maturation_record', weight: 10 },
  { id: 'welfare_logs', label: 'Welfare logs up to date', table: 'welfare_log', weight: 10 },
  { id: 'injury_records', label: 'Injury records maintained', table: 'injury_record', weight: 10 },
  { id: 'training_load', label: 'RPE / training load logged (14 days)', table: 'training_load', weight: 10 },
  { id: 'session_plans', label: 'Session plans filed', table: 'session_plan', weight: 10 },
  { id: 'milestones', label: 'Player milestones recorded', table: 'milestones', weight: 10 },
  { id: 'parent_comms', label: 'Parent communications logged', table: 'parent_communication', weight: 10 },
];

const JURISDICTION_LABELS: Record<string, { type: string; label: string }> = {
  england: { type: 'dbs', label: 'DBS' },
  scotland: { type: 'pvg', label: 'PVG' },
  wales: { type: 'dbs', label: 'DBS' },
  northern_ireland: { type: 'accessni', label: 'AccessNI' },
};

const BG_TYPE_LABEL: Record<string, string> = {
  dbs: 'DBS', pvg: 'PVG', accessni: 'AccessNI',
};

const WARNING_DAYS = 30;

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function ExpiryBadge({ date }: { date: string | null }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-xs text-slate-400">Not recorded</span>;
  if (days < 0) return <span className="text-xs font-medium text-red-400">Expired {Math.abs(days)}d ago</span>;
  if (days <= WARNING_DAYS) return <span className="text-xs font-medium text-amber-400">Expires in {days}d</span>;
  return <span className="text-xs font-medium text-emerald-400">{new Date(date!).toLocaleDateString()}</span>;
}

export default function Compliance() {
  const { activeContext } = useActiveContext();
  const clubId = activeContext?.clubId ?? null;
  const teamId = activeContext?.kind === 'team' ? activeContext.id : null;
  const academyId = activeContext?.kind === 'academy' ? activeContext.id : null;
  const col = teamId ? 'team_id' : 'club_id';
  const val = teamId ?? clubId;

  const [auditFilter, setAuditFilter] = useState('');
  const [auditTable, setAuditTable] = useState('');

  // EPPP counts — scoped to active context via players!inner join.
  // session_plan scoped directly via academy_id (confirmed in schema).
  const { data: epppData } = useQuery({
    queryKey: ['eppp-counts', activeContext?.id],
    enabled: !!activeContext,
    staleTime: 120_000,
    queryFn: async () => {
      const season_start = new Date();
      season_start.setMonth(7, 1); // Aug 1
      if (season_start > new Date()) season_start.setFullYear(season_start.getFullYear() - 1);
      const seasonStr = season_start.toISOString().split('T')[0];
      const cutoff14 = new Date(Date.now() - 14 * 86_400_000).toISOString().split('T')[0];

      const [players, snapshots, mats, welfare, injuries, loads, sessions, milestones, comms] =
        await Promise.all([
          sb.from('players')
            .select('id', { count: 'exact', head: true })
            .eq(col, val),
          sb.from('attribute_snapshot')
            .select('players!inner(club_id, team_id)', { count: 'exact', head: true })
            .eq(`players.${col}`, val).eq('is_final', true).gte('snapshot_date', seasonStr),
          sb.from('maturation_record')
            .select('players!inner(club_id, team_id)', { count: 'exact', head: true })
            .eq(`players.${col}`, val).gte('recorded_date', seasonStr),
          sb.from('welfare_log')
            .select('players!inner(club_id, team_id)', { count: 'exact', head: true })
            .eq(`players.${col}`, val),
          sb.from('injury_record')
            .select('players!inner(club_id, team_id)', { count: 'exact', head: true })
            .eq(`players.${col}`, val),
          sb.from('training_load')
            .select('players!inner(club_id, team_id)', { count: 'exact', head: true })
            .eq(`players.${col}`, val).gte('session_date', cutoff14),
          sb.from('session_plan')
            .select('id', { count: 'exact', head: true })
            .eq('academy_id', academyId!),
          sb.from('milestones')
            .select('players!inner(club_id, team_id)', { count: 'exact', head: true })
            .eq(`players.${col}`, val),
          sb.from('parent_communication')
            .select('players!inner(club_id, team_id)', { count: 'exact', head: true })
            .eq(`players.${col}`, val),
        ]);

      return {
        player_profiles: (players.count ?? 0) > 0 ? 100 : 0,
        attribute_snapshots: (snapshots.count ?? 0) > 0 ? 100 : 0,
        maturation_records: (mats.count ?? 0) > 0 ? 100 : 0,
        welfare_logs: (welfare.count ?? 0) > 0 ? 100 : 0,
        injury_records: (injuries.count ?? 0) > 0 ? 100 : 0,
        training_load: (loads.count ?? 0) >= 5 ? 100 : Math.round(((loads.count ?? 0) / 5) * 100),
        session_plans: (sessions.count ?? 0) > 0 ? 100 : 0,
        milestones: (milestones.count ?? 0) > 0 ? 100 : 0,
        parent_comms: (comms.count ?? 0) > 0 ? 100 : 0,
      } as Record<string, number>;
    },
  });

  // Audit log — scoped by RLS policy "al_select_academy_members": authenticated
  // users see their own entries plus entries from co-members of any shared academy.
  // activeContext?.id in the queryKey busts cache on context switch.
  const { data: auditEntries = [] } = useQuery({
    queryKey: ['audit-log', activeContext?.id, auditFilter, auditTable],
    staleTime: 30_000,
    queryFn: async () => {
      let q = sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
      if (auditFilter) q = q.ilike('action', `%${auditFilter}%`);
      if (auditTable) q = q.eq('table_name', auditTable);
      const { data } = await q;
      return (data ?? []) as AuditEntry[];
    },
  });

  // Staff qualification records — academy-specific; empty for club/team contexts.
  const { data: staffData } = useQuery({
    queryKey: ['staff-qualifications', activeContext?.id],
    enabled: !!activeContext,
    staleTime: 300_000,
    queryFn: async () => {
      if (activeContext?.kind !== 'academy') {
        return { staff: [] as CoachRecord[], jurisdiction: 'england' };
      }
      const { data, error } = await supabase.functions.invoke('get-academy-staff', {
        body: { academy_id: activeContext.id },
      });
      if (error) throw error;
      const payload = data as any;
      const staff = ((payload?.staff ?? []) as any[]).map((r) => ({
        id: r.user_id,
        name: r.full_name ?? r.email ?? r.user_id,
        email: r.email ?? null,
        role: r.role,
        uefa_licence: r.uefa_licence ?? null,
        fa_safeguarding_expiry: r.fa_safeguarding_expiry ?? null,
        dbs_expiry: r.dbs_expiry ?? null,
        pvg_expiry: r.pvg_expiry ?? null,
        accessni_expiry: r.accessni_expiry ?? null,
        background_check_type: r.background_check_type ?? null,
        first_aid_expiry: r.first_aid_expiry ?? null,
      })) as CoachRecord[];
      return {
        staff,
        jurisdiction: payload?.academy?.background_check_jurisdiction ?? 'england',
      };
    },
  });
  const staff = staffData?.staff ?? [];
  const jurisdiction = staffData?.jurisdiction ?? 'england';
  const defaultBg = JURISDICTION_LABELS[jurisdiction] ?? JURISDICTION_LABELS.england;

  // Profile lookup for audit-trail actors
  const actorIds = Array.from(new Set(
    auditEntries.map((e) => e.user_id).filter(Boolean),
  ));
  const { data: actorProfiles = [] } = useQuery({
    queryKey: ['audit-actor-profiles', actorIds.join(',')],
    enabled: actorIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await sb.from('profiles')
        .select('id, full_name, email').in('id', actorIds);
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });
  const actorById = new Map(actorProfiles.map((p) => [p.id, p]));
  function actorLabel(userId: string | null): { name: string; email: string | null } {
    if (!userId) return { name: 'Unknown', email: null };
    const p = actorById.get(userId);
    if (p) return { name: p.full_name || p.email || `${userId.slice(0, 8)}…`, email: p.email };
    return { name: `${userId.slice(0, 8)}…`, email: null };
  }

  const readiness = epppData
    ? Math.round(
        EPPP_CHECKLIST.reduce((sum, item) => sum + (epppData[item.id] ?? 0) * item.weight, 0) /
          EPPP_CHECKLIST.reduce((sum, item) => sum + item.weight * 100, 0) *
          100
      )
    : 0;

  const readinessColor =
    readiness >= 80 ? 'text-emerald-400' : readiness >= 50 ? 'text-amber-400' : 'text-red-400';
  const readinessBar =
    readiness >= 80 ? 'bg-emerald-500' : readiness >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const uniqueTables = [...new Set(auditEntries.map((e) => e.table_name))].sort();

  const safeguardingAudit = auditEntries.filter(
    (e) => e.table_name === 'welfare_log'
  );

  return (
    <div className="p-6 space-y-8">
      <PageHeader title="Compliance" subtitle="EPPP readiness, audit trail &amp; staff qualifications" />

      {/* EPPP Readiness */}
      <section>
        <h2 className="text-slate-900 font-semibold mb-4">EPPP Readiness</h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <span className={`text-5xl font-bold ${readinessColor}`}>{readiness}%</span>
            <div className="flex-1">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${readinessBar}`}
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs mt-1">Overall EPPP compliance score</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EPPP_CHECKLIST.map((item) => {
              const score = epppData?.[item.id] ?? 0;
              const ok = score === 100;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      ok ? 'bg-emerald-500' : 'bg-slate-100'
                    }`}
                  >
                    {ok && (
                      <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${ok ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</span>
                  {!ok && score > 0 && (
                    <span className="ml-auto text-xs text-amber-400">{score}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Staff Qualifications */}
      <section>
        <h2 className="text-slate-900 font-semibold mb-4">Staff Qualifications</h2>
        {staff.length === 0 ? (
          <p className="text-slate-400 text-sm">No staff records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">UEFA Licence</th>
                  <th className="pb-2 font-medium">FA Safeguarding</th>
                  <th className="pb-2 font-medium">Background check</th>
                  <th className="pb-2 font-medium">First Aid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {staff.map((s) => {
                  const resolvedType = s.background_check_type || defaultBg.type;
                  const bgLabel = BG_TYPE_LABEL[resolvedType] ?? defaultBg.label;
                  const bgExpiry =
                    resolvedType === 'pvg' ? s.pvg_expiry
                    : resolvedType === 'accessni' ? s.accessni_expiry
                    : s.dbs_expiry;
                  return (
                  <tr key={s.id}>
                    <td className="py-3 text-slate-900">
                      <div>{s.name}</div>
                      {s.email && <div className="text-xs text-slate-500">{s.email}</div>}
                    </td>
                    <td className="py-3 text-slate-600 capitalize">{s.role?.replace(/_/g, ' ')}</td>
                    <td className="py-3">
                      {s.uefa_licence ? (
                        <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                          {s.uefa_licence}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">None</span>
                      )}
                    </td>
                    <td className="py-3"><ExpiryBadge date={s.fa_safeguarding_expiry} /></td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{bgLabel}</span>
                        <ExpiryBadge date={bgExpiry} />
                      </div>
                    </td>
                    <td className="py-3"><ExpiryBadge date={s.first_aid_expiry} /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Safeguarding Audit Highlight */}
      {safeguardingAudit.length > 0 && (
        <section>
          <h2 className="text-slate-900 font-semibold mb-4">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 align-middle" />
            Safeguarding Activity (last 200 entries)
          </h2>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {safeguardingAudit.slice(0, 20).map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-900 font-mono text-xs">{e.action}</td>
                    <td className="px-4 py-2 text-slate-700 text-xs">
                      {(() => { const a = actorLabel(e.user_id); return (
                        <>
                          <div>{a.name}</div>
                          {a.email && <div className="text-slate-500">{a.email}</div>}
                        </>
                      ); })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Full Audit Trail */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-900 font-semibold">Audit Trail</h2>
          <div className="flex gap-2">
            <select
              value={auditTable}
              onChange={(e) => setAuditTable(e.target.value)}
              className="bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-violet-500"
            >
              <option value="">All tables</option>
              {uniqueTables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search action…"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="bg-white border border-slate-200 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-500 w-48"
            />
          </div>
        </div>

        {auditEntries.length === 0 ? (
          <p className="text-slate-400 text-sm">No audit entries found.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Table</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditEntries.map((e) => (
                  <tr
                    key={e.id}
                    className={`${
                      e.table_name === 'welfare_log' ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                        {e.table_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-900 text-xs font-mono">{e.action}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs font-mono">{e.record_id?.slice(0, 8)}…</td>
                    <td className="px-4 py-2 text-xs text-slate-700">
                      {(() => { const a = actorLabel(e.user_id); return (
                        <>
                          <div>{a.name}</div>
                          {a.email && <div className="text-[10px] text-slate-500">{a.email}</div>}
                        </>
                      ); })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
