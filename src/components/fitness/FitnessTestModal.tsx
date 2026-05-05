import { useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

interface Benchmark { test_name: string; bio_age: number; p10: number; p25: number; p50: number; p75: number; p90: number; }
interface Props {
  players:    Array<{ id: string; name: string }>;
  benchmarks: Benchmark[];
  bioAgeMap:  Map<string, number>;
  onClose:    () => void;
  onSuccess:  () => void;
}

const COMMON_TESTS = [
  'Yo-Yo IR1', 'Yo-Yo IR2',
  '10m Sprint', '20m Sprint', '30m Sprint',
  'Countermovement Jump', 'Broad Jump',
  'Grip Strength (L)', 'Grip Strength (R)',
  'Sit & Reach', 'Illinois Agility', 'T-Test',
  'VO2 Max (Estimated)',
];

const LOWER_IS_BETTER = ['sprint', 'agility', 't-test', 'illinois', '505'];
function isLowerBetter(name: string) { return LOWER_IS_BETTER.some(t => name.toLowerCase().includes(t)); }

function calcPercentile(value: number, bm: Benchmark, testName: string): number {
  const lib = isLowerBetter(testName);
  const pts: Array<[number, number]> = lib
    ? [[bm.p10,90],[bm.p25,75],[bm.p50,50],[bm.p75,25],[bm.p90,10]]
    : [[bm.p10,10],[bm.p25,25],[bm.p50,50],[bm.p75,75],[bm.p90,90]];
  if (value <= pts[0][0]) return lib ? 95 : 5;
  if (value >= pts[pts.length-1][0]) return lib ? 5 : 95;
  for (let i = 0; i < pts.length - 1; i++) {
    const [v0,p0]=pts[i],[v1,p1]=pts[i+1];
    if (value >= v0 && value <= v1) return Math.round(p0 + ((value-v0)/(v1-v0))*(p1-p0));
  }
  return 50;
}

export default function FitnessTestModal({ players, benchmarks, bioAgeMap, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ player_id: '', test_date: new Date().toISOString().split('T')[0], test_name: '', custom_name: '', value: '', unit: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const testName = form.test_name === '__custom__' ? form.custom_name : form.test_name;

  const percentilePreview = (() => {
    if (!form.player_id || !testName || !form.value) return null;
    const v = parseFloat(form.value);
    if (isNaN(v)) return null;
    const bioAge = bioAgeMap.get(form.player_id);
    if (bioAge == null) return null;
    const ageBms = benchmarks.filter(b => b.test_name === testName);
    if (!ageBms.length) return null;
    const nearest = ageBms.reduce((best, b) => Math.abs(b.bio_age - bioAge) < Math.abs(best.bio_age - bioAge) ? b : best);
    return { percentile: calcPercentile(v, nearest, testName), bioAge };
  })();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.player_id || !testName || !form.value) return;
    setSaving(true);
    await sb.from('fitness_test_result').insert({
      player_id:  form.player_id,
      test_date:  form.test_date,
      test_name:  testName,
      value:      parseFloat(form.value),
      unit:       form.unit  || null,
      percentile: percentilePreview?.percentile ?? null,
      bio_age:    percentilePreview?.bioAge     ?? null,
      notes:      form.notes || null,
    });
    setSaving(false);
    onSuccess();
  }

  const sel = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Log Fitness Test</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Player *</label>
            <select value={form.player_id} onChange={e => setForm(f => ({ ...f, player_id: e.target.value }))} className={sel} required>
              <option value="">Select player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Test Date *</label>
            <input type="date" value={form.test_date} onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))} className={sel} required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Test *</label>
            <select value={form.test_name} onChange={e => setForm(f => ({ ...f, test_name: e.target.value }))} className={sel} required>
              <option value="">Select test…</option>
              {COMMON_TESTS.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">Custom test…</option>
            </select>
          </div>
          {form.test_name === '__custom__' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Test name *</label>
              <input type="text" value={form.custom_name} onChange={e => setForm(f => ({ ...f, custom_name: e.target.value }))} placeholder="e.g. 505 Agility" className={sel} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Result *</label>
              <input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. 18.5" className={sel} required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Unit</label>
              <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="m, s, cm…" className={sel} />
            </div>
          </div>
          {percentilePreview && (
            <div className={`px-3 py-2 rounded-lg text-sm text-center border ${
              percentilePreview.percentile < 25 ? 'bg-red-500/15 border-red-500/30 text-red-300'
              : percentilePreview.percentile < 50 ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            }`}>
              P{percentilePreview.percentile} for bio age {percentilePreview.bioAge}y
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={sel} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-white/10 rounded-lg text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
            <button type="submit" disabled={!form.player_id || !testName || !form.value || saving}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
