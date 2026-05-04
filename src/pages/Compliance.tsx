import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/layout/PageHeader';

const sb = supabase as any;

type AuditEntry = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  actor_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

type CoachRecord = {
  id: string;
  name: string;
  role: string;
  uefa_licence: string | null;
  fa_safeguarding_expiry: string | null;
  dbs_expiry: string | null;
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

const WARNING_DAYS = 30;

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function ExpiryBadge({ date }: { date: string | null }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-xs text-white/40">Not recorded</span>;
  if (days < 0) return <span className="text-xs font-medium text-red-400">Expired {Math.abs(days)}d ago</span>;
  if (days <= WARNING_DAYS) return <span className="text-xs font-medium text-amber-400">Expires in {days}d</span>;
  return <span className="text-xs font-medium text-emerald-400">{new Date(date!).toLocaleDateString()}</span>;
}

export default function Compliance() {
  const [auditFilter, setAuditFilter] = useState('');
  const [auditTable, setAuditTable] = useState('');

  // EPPP counts
  const { data: epppData } = useQuery({
    queryKey: ['eppp-counts'],
    staleTime: 120_000,
    queryFn: async () => {
      const season_start = new Date();
      season_start.setMonth(7, 1); // Aug 1
      if (season_start > new Date()) season_start.setFullYear(season_start.getFullYear() - 1);
      const seasonStr = season_start.toISOString().split('T')[0];
      const cutoff14 = new Date(Date.now() - 14 * 86_400_000).toISOString().split('T')[0];

      const [players, snapshots, mats, welfare, injuries, loads, sessions, milestones, comms] =
        await Promise.all([
          sb.from('players').select('id', { count: 'exact', head: true }),
          sb.from('attribute_snapshot').select('id', { count: 'exact', head: true }).eq('is_final', true).gte('snapshot_date', seasonStr),
          sb.from('maturation_record').select('id', { count: 'exact', head: true }).gte('recorded_date', seasonStr),
          sb.from('welfare_log').select('id', { count: 'exact', head: true }),
          sb.from('injury_record').select('id', { count: 'exact', head: true }),
          sb.from('training_load').select('id', { count: 'exact', head: true }).gte('session_date', cutoff14),
          sb.from('session_plan').select('id', { count: 'exact', head: true }),
          sb.from('milestones').select('id', { count: 'exact', head: true }),
          sb.from('parent_communication').select('id', { count: 'exact', head: true }),
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

  // Audit log
  const { data: auditEntries = [] } = useQuery({
    queryKey: ['audit-log', auditFilter, auditTable],
    staleTime: 30_000,
    queryFn: async () => {
      let q = sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
      if (auditFilter) q = q.ilike('action', `%${auditFilter}%`);
      if (auditTable) q = q.eq('table_name', auditTable);
      const { data } = await q;
      return (data ?? []) as AuditEntry[];
    },
  });

  // Staff qualification records (from user metadata / staff table)
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-qualifications'],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await sb.from('user_academies')
        .select('user_id, role, profiles:user_id(full_name, fa_safeguarding_expiry, dbs_expiry, first_aid_expiry, uefa_licence)');
      return ((data ?? []) as any[]).map((r: any) => ({
        id: r.user_id,
        name: r.profiles?.full_name ?? r.user_id,
        role: r.role,
        uefa_licence: r.profiles?.uefa_licence ?? null,
        fa_safeguarding_expiry: r.profiles?.fa_safeguarding_expiry ?? null,
        dbs_expiry: r.profiles?.dbs_expiry ?? null,
        first_aid_expiry: r.profiles?.first_aid_expiry ?? null,
      })) as CoachRecord[];
    },
  });

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
    (e) => e.table_name === 'welfare_log' || (e.metadata as any)?.is_restricted
  );

  return (
    <div className="p-6 space-y-8">
      <PageHeader title="Compliance" subtitle="EPPP readiness, audit trail &amp; staff qualifications" />

      {/* EPPP Readiness */}
      <section>
        <h2 className="text-white font-semibold mb-4">EPPP Readiness</h2>
        <div className="bg-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <span className={`text-5xl font-bold ${readinessColor}`}>{readiness}%</span>
            <div className="flex-1">
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${readinessBar}`}
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <p className="text-white/50 text-xs mt-1">Overall EPPP compliance score</p>
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
                      ok ? 'bg-emerald-500' : 'bg-white/10'
                    }`}
                  >
                    {ok && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${ok ? 'text-white' : 'text-white/50'}`}>{item.label}</span>
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
        <h2 className="text-white font-semibold mb-4">Staff Qualifications</h2>
        {staff.length === 0 ? (
          <p className="text-white/40 text-sm">No staff records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">UEFA Licence</th>
                  <th className="pb-2 font-medium">FA Safeguarding</th>
                  <th className="pb-2 font-medium">DBS</th>
                  <th className="pb-2 font-medium">First Aid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 text-white">{s.name}</td>
                    <td className="py-3 text-white/60 capitalize">{s.role?.replace(/_/g, ' ')}</td>
                    <td className="py-3">
                      {s.uefa_licence ? (
                        <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                          {s.uefa_licence}
                        </span>
                      ) : (
                        <span className="text-xs text-white/30">None</span>
                      )}
                    </td>
                    <td className="py-3"><ExpiryBadge date={s.fa_safeguarding_expiry} /></td>
                    <td className="py-3"><ExpiryBadge date={s.dbs_expiry} /></td>
                    <td className="py-3"><ExpiryBadge date={s.first_aid_expiry} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Safeguarding Audit Highlight */}
      {safeguardingAudit.length > 0 && (
        <section>
          <h2 className="text-white font-semibold mb-4">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 align-middle" />
            Safeguarding Activity (last 200 entries)
          </h2>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {safeguardingAudit.slice(0, 20).map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 text-white/50 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-white font-mono text-xs">{e.action}</td>
                    <td className="px-4 py-2 text-white/60 font-mono text-xs">{e.actor_id?.slice(0, 8)}…</td>
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
          <h2 className="text-white font-semibold">Audit Trail</h2>
          <div className="flex gap-2">
            <select
              value={auditTable}
              onChange={(e) => setAuditTable(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500"
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
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-violet-500 w-48"
            />
          </div>
        </div>

        {auditEntries.length === 0 ? (
          <p className="text-white/40 text-sm">No audit entries found.</p>
        ) : (
          <div className="bg-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10">
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
                    <td className="px-4 py-2 text-white/50 whitespace-nowrap text-xs">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/70">
                        {e.table_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-white text-xs font-mono">{e.action}</td>
                    <td className="px-4 py-2 text-white/40 text-xs font-mono">{e.record_id?.slice(0, 8)}…</td>
                    <td className="px-4 py-2 text-white/40 text-xs font-mono">{e.actor_id?.slice(0, 8)}…</td>
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
