import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function LogRPE() {
  const { token } = useParams<{ token: string }>();
  const [player, setPlayer]   = useState<{ id: string; name: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [rpe, setRpe]         = useState(6);
  const [duration, setDuration] = useState(60);
  const [sessionType, setSessionType] = useState('Training');
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); return; }
    (supabase as any)
      .from('rpe_token')
      .select('player_id, expires_at, players(id, name)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
      .then(({ data }: any) => {
        if (!data) { setInvalid(true); return; }
        setPlayer(data.players);
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!player) return;
    setSaving(true);
    await (supabase as any).from('training_load').insert({
      player_id:        player.id,
      session_date:     date,
      session_type:     sessionType,
      duration_minutes: duration,
      rpe,
    });
    setSaving(false);
    setSaved(true);
  };

  if (invalid) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="text-base font-semibold text-slate-700">Link expired or invalid</div>
        <p className="text-sm text-slate-400 mt-1">Ask your coach to send a new RPE link.</p>
      </div>
    </div>
  );

  if (!player) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
  );

  if (saved) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-emerald-200 p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">✅</div>
        <div className="text-base font-semibold text-slate-700">Session logged!</div>
        <p className="text-sm text-slate-400 mt-1">Load AU: {duration * rpe} · RPE {rpe}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full">
        <div className="text-xs text-slate-400 mb-1">RPE self-report</div>
        <div className="text-lg font-bold text-slate-800 mb-5">{player.name}</div>

        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Session type</span>
            <select value={sessionType} onChange={e => setSessionType(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
              {['Training','Match','Gym','Recovery','Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Duration (minutes)</span>
            <input type="number" min={5} max={300} value={duration} onChange={e => setDuration(+e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Perceived effort (RPE)</span>
              <span className="text-sm font-bold text-violet-700">{rpe} / 10</span>
            </div>
            <input type="range" min={1} max={10} value={rpe} onChange={e => setRpe(+e.target.value)}
              className="w-full accent-violet-600" />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 — Very easy</span><span>5 — Hard</span><span>10 — Max</span>
            </div>
          </div>

          <div className="pt-1 text-xs text-slate-400 text-center">
            Load AU: <strong className="text-slate-700">{duration * rpe}</strong>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={saving}
          className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white
                     hover:bg-violet-700 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
