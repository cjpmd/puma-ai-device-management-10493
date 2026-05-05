import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

const SESSION_TYPES = ['Training', 'Match', 'Gym', 'Recovery', 'Friendly', 'Other'];
const RPE_LABELS: Record<number, string> = {
  1: 'Rest', 2: 'Very Light', 3: 'Light', 4: 'Moderate', 5: 'Somewhat Hard',
  6: 'Hard', 7: 'Very Hard', 8: 'Very Hard+', 9: 'Extremely Hard', 10: 'Maximum',
};

async function calcAcwr(playerId: string, sessionDate: string, todayLoad: number): Promise<number | null> {
  const base = new Date(sessionDate);
  const acuteCutoff   = new Date(base); acuteCutoff.setDate(acuteCutoff.getDate() - 6);
  const chronicCutoff = new Date(base); chronicCutoff.setDate(chronicCutoff.getDate() - 27);

  const { data } = await sb
    .from('training_load')
    .select('session_date, load_au')
    .eq('player_id', playerId)
    .gte('session_date', chronicCutoff.toISOString().split('T')[0])
    .lt('session_date', sessionDate);

  const rows = (data ?? []) as Array<{ session_date: string; load_au: number }>;
  const acuteRows = rows.filter(r => r.session_date >= acuteCutoff.toISOString().split('T')[0]);

  const acuteSum  = acuteRows.reduce((s, r) => s + (r.load_au ?? 0), 0) + todayLoad;
  const chronicSum = rows.reduce((s, r) => s + (r.load_au ?? 0), 0) + todayLoad;
  const chronicAvg = chronicSum / 28;

  if (chronicAvg === 0) return null;
  return Math.round((acuteSum / 7 / chronicAvg) * 100) / 100;
}

export default function LogRPE() {
  const { token } = useParams<{ token: string }>();
  const [rpe, setRpe]   = useState(0);
  const [form, setForm] = useState({
    session_date: new Date().toISOString().split('T')[0],
    session_type: 'Training',
    duration: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const { data: player, isLoading } = useQuery({
    queryKey: ['player-by-token', token],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await sb
        .from('players')
        .select('id, name, position')
        .eq('log_token', token)
        .maybeSingle();
      return data as { id: string; name: string; position?: string } | null;
    },
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!player || !rpe || !form.duration) return;
    setSaving(true);
    setError(null);

    const load_au = rpe * parseInt(form.duration);
    const acwr    = await calcAcwr(player.id, form.session_date, load_au);

    const { error: err } = await sb.from('training_load').insert({
      player_id:    player.id,
      session_date: form.session_date,
      session_type: form.session_type,
      rpe,
      duration:     parseInt(form.duration),
      load_au,
      acwr_at_time: acwr,
      notes:        form.notes || null,
    });

    setSaving(false);
    if (err) setError('Failed to save. Please try again.');
    else setDone(true);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-center p-4">
        <div>
          <div className="text-rose-400 text-lg font-semibold">Invalid link</div>
          <div className="text-slate-500 text-sm mt-1">This RPE log link is not recognised.</div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-center p-4">
        <div className="space-y-3">
          <div className="text-5xl">✓</div>
          <div className="text-emerald-400 text-xl font-semibold">Session logged</div>
          <div className="text-slate-400 text-sm">Thanks {player.name} — your session has been recorded.</div>
          <button
            onClick={() => { setDone(false); setRpe(0); setForm(f => ({ ...f, duration: '', notes: '' })); }}
            className="mt-4 px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
          >
            Log another
          </button>
        </div>
      </div>
    );
  }

  const loadPreview = rpe && form.duration ? rpe * parseInt(form.duration) : null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{player.name}</div>
          {player.position && <div className="text-slate-400 text-sm">{player.position}</div>}
          <div className="text-slate-600 text-xs mt-0.5">Session RPE Log</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={form.session_date}
                onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Session Type</label>
              <select
                value={form.session_type}
                onChange={e => setForm(f => ({ ...f, session_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">
              RPE{rpe > 0 ? ` — ${rpe} · ${RPE_LABELS[rpe]}` : ' (select below)'}
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpe(n)}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    rpe === n
                      ? n <= 3 ? 'bg-emerald-500 text-white shadow-lg'
                        : n <= 6 ? 'bg-amber-500 text-white shadow-lg'
                        : 'bg-red-500 text-white shadow-lg'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Duration (minutes)</label>
            <input
              type="number"
              min="1"
              max="300"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              placeholder="e.g. 90"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              required
            />
          </div>

          {loadPreview !== null && (
            <div className="text-center py-1.5 bg-white/5 rounded-lg text-sm">
              <span className="text-slate-400">Session load: </span>
              <span className="text-white font-bold">{loadPreview} AU</span>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any comments…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving || !rpe || !form.duration}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Submit Session'}
          </button>
        </form>
      </div>
    </div>
  );
}
