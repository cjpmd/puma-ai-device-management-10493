import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgType } from '@/contexts/OrgTypeContext';
import { PageHeader } from '@/components/layout/PageHeader';

type LogType = 'General' | 'Academic' | 'Pastoral' | 'Safeguarding' | 'Medical';
const LOG_TYPES: LogType[] = ['General', 'Academic', 'Pastoral', 'Safeguarding', 'Medical'];

interface LogForm {
  player_id: string;
  log_type: LogType;
  status: string;
  notes: string;
  tags: string;
}

const blankLog = (): LogForm => ({
  player_id: '', log_type: 'General', status: 'open', notes: '', tags: '',
});

export default function Welfare() {
  const { academyId } = useOrgType();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<LogForm>(blankLog());
  const [saving, setSaving]     = useState(false);

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('school_attendance')
        .select('player_id, attendance_pct, term, academic_year, players(name)')
        .order('recorded_at', { ascending: false });
      // Latest per player
      const seen = new Map<string, any>();
      for (const r of (data ?? [])) if (!seen.has(r.player_id)) seen.set(r.player_id, r);
      return Array.from(seen.values());
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['welfare-logs'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('welfare_log')
        .select('id, player_id, log_date, log_type, status, notes, tags, is_restricted, players(name)')
        .order('log_date', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: comms = [] } = useQuery({
    queryKey: ['parent-comms'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('parent_communication')
        .select('id, player_id, message, direction, sent_at, players(name)')
        .order('sent_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players-list'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('players').select('id, name').order('name');
      return data ?? [];
    },
  });

  const below80 = attendance.filter((a: any) => a.attendance_pct < 80);
  const openConcerns = logs.filter((l: any) => l.status === 'open');

  const handleSave = async () => {
    if (!form.player_id || !form.notes) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from('welfare_log').insert({
      player_id:    form.player_id,
      author_id:    user?.id,
      log_date:     new Date().toISOString().split('T')[0],
      log_type:     form.log_type,
      status:       form.status,
      notes:        form.notes,
      tags:         form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      // Safeguarding type is always restricted
      is_restricted: form.log_type === 'Safeguarding',
    });
    setSaving(false);
    setForm(blankLog());
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['welfare-logs'] });
  };

  const f = (k: keyof LogForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Welfare & Education"
        subtitle="Attendance, pastoral logs, parent communications"
        action={
          <button onClick={() => setShowForm(s => !s)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors">
            + New log
          </button>
        }
      />

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{attendance.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Players tracked</div>
        </div>
        <div className={`rounded-xl border p-4 ${ below80.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className={`text-2xl font-bold ${ below80.length > 0 ? 'text-red-700' : 'text-slate-900'}`}>{below80.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Below 80% attendance</div>
        </div>
        <div className={`rounded-xl border p-4 ${openConcerns.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <div className={`text-2xl font-bold ${openConcerns.length > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{openConcerns.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Open concerns</div>
        </div>
      </div>

      {/* Safeguarding RLS note */}
      <div className="mt-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
        <strong>Safeguarding RLS:</strong> rows with <code>is_restricted = true</code> are visible only to
        users with role <code>welfare_officer</code> or <code>head_of_academy</code>.
        Run <code>SELECT check_safeguarding_rls()</code> to verify access for the current user.
      </div>

      {/* Alert feed */}
      {below80.length > 0 && (
        <div className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Attendance alerts</h2>
          <div className="flex flex-col gap-1.5">
            {(below80 as any[]).map(a => (
              <div key={a.player_id} className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{a.players?.name ?? 'Unknown'}</span>
                <span className="text-slate-500">{a.term} {a.academic_year}</span>
                <span className="ml-auto font-bold text-red-700">{a.attendance_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New log form */}
      {showForm && (
        <div className="mt-5 bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-700 mb-4">New pastoral log</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Player</span>
              <select value={form.player_id} onChange={f('player_id')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="">Select…</option>
                {(players as any[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Type</span>
              <select value={form.log_type} onChange={f('log_type')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                {LOG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Status</span>
              <select value={form.status} onChange={f('status')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="open">Open</option>
                <option value="monitoring">Monitoring</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Tags (comma-separated)</span>
              <input value={form.tags} onChange={f('tags')} placeholder="e.g. exam, family"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-slate-500">Notes</span>
              <textarea value={form.notes} onChange={f('notes')} rows={3}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
            </label>
          </div>
          {form.log_type === 'Safeguarding' && (
            <p className="mt-2 text-xs text-red-600 font-medium">
              Safeguarding entries are automatically marked restricted and visible only to welfare officers.
            </p>
          )}
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.player_id || !form.notes}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : 'Save log'}
            </button>
          </div>
        </div>
      )}

      {/* Log feed */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Pastoral log</h2>
        {logs.length === 0
          ? <p className="text-sm text-slate-400 py-6 text-center">No logs yet.</p>
          : (
            <div className="flex flex-col gap-2">
              {(logs as any[]).map(l => (
                <div key={l.id} className={`bg-white rounded-xl border px-4 py-3 ${
                  l.is_restricted ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-slate-800">{l.players?.name ?? 'Unknown'}</span>
                    <span className="text-xs text-slate-400">{l.log_date}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{l.log_type}</span>
                    {l.is_restricted && <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-medium">🔒 Restricted</span>}
                    <span className={`ml-auto text-xs rounded px-1.5 py-0.5 ${
                      l.status === 'open' ? 'bg-amber-100 text-amber-700' :
                      l.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{l.status}</span>
                  </div>
                  <p className="text-sm text-slate-700">{l.notes}</p>
                  {l.tags?.length > 0 && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {l.tags.map((t: string) => (
                        <span key={t} className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Parent communications */}
      {comms.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Parent communications</h2>
          <div className="flex flex-col gap-2">
            {(comms as any[]).map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-start gap-3">
                <span className={`flex-shrink-0 mt-0.5 text-xs font-bold px-2 py-0.5 rounded ${
                  c.direction === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>{c.direction}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400 mb-0.5">{c.players?.name} · {new Date(c.sent_at).toLocaleDateString('en-GB')}</div>
                  <p className="text-sm text-slate-700">{c.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
