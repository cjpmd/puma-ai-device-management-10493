import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrgType } from '@/contexts/OrgTypeContext';
import { PageHeader } from '@/components/layout/PageHeader';

const STAGES = ['identified', 'watching', 'on_trial', 'offer', 'signed', 'rejected'] as const;
type Stage = typeof STAGES[number];

const STAGE_LABEL: Record<Stage, string> = {
  identified: 'Identified',
  watching:   'Watching',
  on_trial:   'On Trial',
  offer:      'Offer / Signed',
  signed:     'Signed',
  rejected:   'Rejected',
};

const KANBAN_STAGES: Stage[] = ['identified', 'watching', 'on_trial', 'offer'];

const STAGE_STYLE: Record<string, string> = {
  identified: 'border-slate-200 bg-slate-50',
  watching:   'border-blue-200 bg-blue-50',
  on_trial:   'border-violet-200 bg-violet-50',
  offer:      'border-emerald-200 bg-emerald-50',
};

const STAGE_HDR: Record<string, string> = {
  identified: 'text-slate-600',
  watching:   'text-blue-700',
  on_trial:   'text-violet-700',
  offer:      'text-emerald-700',
};

interface ProspectForm {
  first_name: string;
  last_name: string;
  dob: string;
  position: string;
  current_club: string;
  parent_contact: string;
}

const blankProspect = (): ProspectForm => ({
  first_name: '', last_name: '', dob: '', position: '', current_club: '', parent_contact: '',
});

export default function Scouting() {
  const { academyId } = useOrgType();
  const qc = useQueryClient();
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState<ProspectForm>(blankProspect());
  const [saving, setSaving]     = useState(false);

  const { data: prospects = [] } = useQuery({
    queryKey: ['prospects', academyId],
    enabled: !!academyId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('prospect')
        .select('id, first_name, last_name, dob, position, current_club, pipeline_stage, competing_interest, international_eligibility_confirmed, approach_date')
        .eq('academy_id', academyId!)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: reportCounts = {} } = useQuery({
    queryKey: ['scout-report-counts', academyId],
    enabled: prospects.length > 0,
    queryFn: async () => {
      const ids = (prospects as any[]).map(p => p.id);
      const { data } = await (supabase as any)
        .from('scout_report')
        .select('prospect_id')
        .in('prospect_id', ids);
      const counts: Record<string, number> = {};
      for (const r of (data ?? [])) counts[r.prospect_id] = (counts[r.prospect_id] ?? 0) + 1;
      return counts;
    },
  });

  const moveStage = async (id: string, stage: Stage) => {
    await (supabase as any).from('prospect').update({ pipeline_stage: stage }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['prospects', academyId] });
  };

  const handleAdd = async () => {
    if (!academyId || !form.first_name || !form.last_name) return;
    setSaving(true);
    await (supabase as any).from('prospect').insert({
      academy_id:    academyId,
      first_name:    form.first_name,
      last_name:     form.last_name,
      dob:           form.dob || null,
      position:      form.position || null,
      current_club:  form.current_club || null,
      parent_contact: form.parent_contact || null,
      pipeline_stage: 'identified',
    });
    setSaving(false);
    setForm(blankProspect());
    setShowAdd(false);
    qc.invalidateQueries({ queryKey: ['prospects', academyId] });
  };

  const f = (k: keyof ProspectForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const byStage = (stage: Stage) => (prospects as any[]).filter(p => p.pipeline_stage === stage);

  return (
    <div className="p-6">
      <PageHeader
        title="Scouting"
        subtitle={`${prospects.length} prospects in pipeline`}
        action={
          <button onClick={() => setShowAdd(s => !s)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors">
            + Add prospect
          </button>
        }
      />

      {/* Add prospect form */}
      {showAdd && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-700 mb-4">New prospect</div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { k: 'first_name',     label: 'First name',     ph: 'John' },
              { k: 'last_name',      label: 'Last name',      ph: 'Smith' },
              { k: 'position',       label: 'Position',       ph: 'ST' },
              { k: 'current_club',   label: 'Current club',   ph: 'Grassroots FC' },
              { k: 'parent_contact', label: 'Parent contact', ph: 'email or phone' },
            ] as const).map(({ k, label, ph }) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">{label}</span>
                <input value={form[k]} onChange={f(k)} placeholder={ph}
                  className="rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </label>
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">DOB</span>
              <input type="date" value={form.dob} onChange={f('dob')}
                className="rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </label>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.first_name || !form.last_name}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : 'Add prospect'}
            </button>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {KANBAN_STAGES.map(stage => {
          const cards = byStage(stage);
          return (
            <div key={stage} className={`rounded-xl border p-3 ${STAGE_STYLE[stage]}`}>
              <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${STAGE_HDR[stage]}`}>
                {STAGE_LABEL[stage]} <span className="font-normal opacity-60">({cards.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.map((p: any) => {
                  const reports = (reportCounts as any)[p.id] ?? 0;
                  const age = p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
                  return (
                    <div key={p.id} className="bg-white rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="font-semibold text-slate-800">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {[p.position, age ? `${age}y` : null, p.current_club].filter(Boolean).join(' · ')}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.competing_interest && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">Competing interest</span>
                        )}
                        {!p.international_eligibility_confirmed && (
                          <span className="text-[10px] bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-medium">Eligibility TBC</span>
                        )}
                        <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                          {reports} report{reports !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {/* Stage advance buttons */}
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {KANBAN_STAGES.filter(s => s !== stage).map(s => (
                          <button key={s} onClick={() => moveStage(p.id, s)}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700 transition-colors">
                            → {STAGE_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-4">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
