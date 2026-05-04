import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';

const SEVERITIES = [1, 2, 3] as const;
const SEV_LABEL: Record<number, string> = { 1: 'Minor', 2: 'Moderate', 3: 'Severe' };
const SEV_STYLE: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-red-100 text-red-700',
};
const RTP_LABELS = ['', 'Gym only', 'Running', 'Non-contact training', 'Full training', 'Match ready'];

const ACWR_STYLE = (v: number | null) =>
  v == null ? 'bg-slate-100 text-slate-500'
  : v >= 1.5 ? 'bg-red-100 text-red-700'
  : v >= 1.3 ? 'bg-amber-100 text-amber-700'
  : 'bg-emerald-100 text-emerald-700';

type InjuryForm = {
  player_id: string;
  injury_type: string;
  body_part: string;
  severity: 1 | 2 | 3;
  date_of_injury: string;
  expected_return_date: string;
  mechanism: string;
  notes: string;
};

const blankForm = (): InjuryForm => ({
  player_id: '',
  injury_type: '',
  body_part: '',
  severity: 1,
  date_of_injury: new Date().toISOString().split('T')[0],
  expected_return_date: '',
  mechanism: '',
  notes: '',
});

export default function Medical() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<InjuryForm>(blankForm());
  const [saving, setSaving]     = useState(false);

  const { data: injuries = [] } = useQuery({
    queryKey: ['all-injuries'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('injury_record')
        .select('id, player_id, injury_type, body_part, severity, date_of_injury, expected_return_date, rtp_phase, is_resolved, players(name)')
        .order('date_of_injury', { ascending: false });
      return data ?? [];
    },
  });

  // Latest ACWR per player
  const { data: acwrAlerts = [] } = useQuery({
    queryKey: ['acwr-alerts'],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data } = await (supabase as any)
        .from('training_load')
        .select('player_id, acwr_at_time, session_date, players(name)')
        .gte('session_date', since.toISOString().split('T')[0])
        .not('acwr_at_time', 'is', null)
        .order('session_date', { ascending: false });
      // Latest per player
      const seen = new Set<string>();
      const out: any[] = [];
      for (const r of (data ?? [])) {
        if (!seen.has(r.player_id)) { seen.add(r.player_id); out.push(r); }
      }
      return out.filter((r: any) => r.acwr_at_time >= 1.3);
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players-list'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('players').select('id, name').order('name');
      return data ?? [];
    },
  });

  const open     = injuries.filter((i: any) => !i.is_resolved);
  const resolved = injuries.filter((i: any) =>  i.is_resolved);

  // Recurrence detection: same body_part within 12 months
  const recurrenceWarning = (inj: any): boolean => {
    const cutoff = new Date(inj.date_of_injury);
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    return injuries.some((other: any) =>
      other.id !== inj.id &&
      other.player_id === inj.player_id &&
      other.body_part === inj.body_part &&
      new Date(other.date_of_injury) >= cutoff
    );
  };

  const handleSave = async () => {
    if (!form.player_id || !form.injury_type || !form.body_part) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from('injury_record').insert({
      ...form,
      severity:             form.severity,
      expected_return_date: form.expected_return_date || null,
      mechanism:            form.mechanism || null,
      recorded_by:          user?.id ?? null,
    });
    setSaving(false);
    setForm(blankForm());
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['all-injuries'] });
  };

  const advanceRTP = async (id: string, phase: number) => {
    await (supabase as any).from('injury_record')
      .update({ rtp_phase: Math.min(phase + 1, 5) })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['all-injuries'] });
  };

  const markResolved = async (id: string) => {
    await (supabase as any).from('injury_record')
      .update({ is_resolved: true, actual_return_date: new Date().toISOString().split('T')[0] })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['all-injuries'] });
  };

  const f = (k: keyof InjuryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Medical"
        subtitle="Squad availability and injury management"
        action={
          <button onClick={() => setShowForm(s => !s)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors">
            + Log injury
          </button>
        }
      />

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{open.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Open injuries</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{acwrAlerts.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">ACWR alerts (≥1.3)</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{resolved.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Resolved this season</div>
        </div>
      </div>

      {/* ACWR alert section */}
      {acwrAlerts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">ACWR alerts</h2>
          <div className="flex flex-col gap-2">
            {(acwrAlerts as any[]).map(r => (
              <div key={r.player_id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                  r.acwr_at_time >= 1.5 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                }`}>
                <span className="font-medium text-slate-800">{r.players?.name ?? 'Unknown'}</span>
                <span className="text-slate-500">{r.session_date}</span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                  r.acwr_at_time >= 1.5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  ACWR {r.acwr_at_time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log injury form */}
      {showForm && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-700 mb-4">Log new injury</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-500">Player</span>
              <select value={form.player_id} onChange={f('player_id')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="">Select player…</option>
                {(players as any[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Injury type</span>
              <input value={form.injury_type} onChange={f('injury_type')} placeholder="e.g. Hamstring strain"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Body part</span>
              <input value={form.body_part} onChange={f('body_part')} placeholder="e.g. Left hamstring"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Severity</span>
              <select value={form.severity} onChange={f('severity')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                {SEVERITIES.map(s => <option key={s} value={s}>{s} — {SEV_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Date of injury</span>
              <input type="date" value={form.date_of_injury} onChange={f('date_of_injury')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Expected return</span>
              <input type="date" value={form.expected_return_date} onChange={f('expected_return_date')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-slate-500">Mechanism / notes</span>
              <textarea value={form.notes} onChange={f('notes')} rows={2}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
            </label>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.player_id || !form.injury_type}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : 'Save injury'}
            </button>
          </div>
        </div>
      )}

      {/* Open injuries */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Open injuries</h2>
        {open.length === 0
          ? <p className="text-sm text-slate-400 py-6 text-center">No open injuries.</p>
          : (
            <div className="flex flex-col gap-2">
              {(open as any[]).map(inj => (
                <div key={inj.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{inj.players?.name ?? 'Unknown'}</span>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${SEV_STYLE[inj.severity] ?? SEV_STYLE[1]}`}>
                        {SEV_LABEL[inj.severity] ?? `Sev ${inj.severity}`}
                      </span>
                      {recurrenceWarning(inj) && (
                        <span className="text-xs rounded-full px-2 py-0.5 bg-red-100 text-red-700 font-medium">⚠ Recurrence</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">{inj.body_part} — {inj.injury_type}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{inj.date_of_injury}{inj.expected_return_date ? ` · exp. return ${inj.expected_return_date}` : ''}</div>
                    {/* RTP phase bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(p => (
                          <div key={p} className={`w-6 h-1.5 rounded-full ${
                            p <= inj.rtp_phase ? 'bg-violet-500' : 'bg-slate-200'
                          }`} />
                        ))}
                      </div>
                      <span className="text-xs text-slate-400">{RTP_LABELS[inj.rtp_phase]}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => advanceRTP(inj.id, inj.rtp_phase)}
                      disabled={inj.rtp_phase >= 5}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                      Advance phase
                    </button>
                    <button onClick={() => markResolved(inj.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                      Mark resolved
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
