import { useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

interface Props {
  playerId: string | null;
  players: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const BODY_PARTS = [
  'Head/Neck', 'Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand/Finger',
  'Chest', 'Abdomen', 'Lower Back', 'Hip/Groin', 'Thigh (Front)', 'Hamstring',
  'Knee', 'Shin/Calf', 'Ankle', 'Foot/Toe',
];
const INJURY_TYPES = ['Muscle strain', 'Ligament sprain', 'Fracture', 'Contusion', 'Concussion', 'Overuse', 'Other'];
const SEVERITIES   = ['Minor (1–3 days)', 'Mild (4–7 days)', 'Moderate (1–4 weeks)', 'Severe (>4 weeks)'];
const MECHANISMS   = ['Contact', 'Non-contact', 'Overuse', 'Unknown'];
const RTP_LABELS   = [
  'Phase 1 — Rest & Protection',
  'Phase 2 — Active Recovery',
  'Phase 3 — Strength & Conditioning',
  'Phase 4 — Sport-Specific Training',
  'Phase 5 — Full Return',
];

export default function InjuryLogModal({ playerId, players, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    player_id:    playerId ?? '',
    injury_date:  new Date().toISOString().split('T')[0],
    body_part:    '',
    injury_type:  '',
    severity:     '',
    mechanism:    '',
    rtp_phase:    1,
    notes:        '',
  });
  const [saving, setSaving]       = useState(false);
  const [recurrence, setRecurrence] = useState<{ count: number; last_date: string } | null>(null);

  async function checkRecurrence(bodyPart: string, pid: string) {
    if (!bodyPart || !pid) { setRecurrence(null); return; }
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const { data } = await sb
      .from('injury_record')
      .select('injury_date')
      .eq('player_id', pid)
      .eq('body_part', bodyPart)
      .gte('injury_date', cutoff.toISOString().split('T')[0])
      .order('injury_date', { ascending: false });
    setRecurrence(data?.length ? { count: data.length, last_date: data[0].injury_date } : null);
  }

  function update(field: string, value: string | number) {
    const next = { ...form, [field]: value };
    setForm(next);
    if (field === 'body_part') checkRecurrence(value as string, next.player_id);
    if (field === 'player_id') checkRecurrence(next.body_part, value as string);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.player_id || !form.body_part) return;
    setSaving(true);
    await sb.from('injury_record').insert({
      player_id:    form.player_id,
      injury_date:  form.injury_date,
      body_part:    form.body_part,
      injury_type:  form.injury_type  || null,
      severity:     form.severity     || null,
      mechanism:    form.mechanism    || null,
      rtp_phase:    form.rtp_phase,
      notes:        form.notes        || null,
    });
    setSaving(false);
    onSuccess();
  }

  const sel = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Log Injury</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Player *</label>
            <select value={form.player_id} onChange={e => update('player_id', e.target.value)} className={sel} required>
              <option value="">Select player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Injury Date *</label>
              <input type="date" value={form.injury_date} onChange={e => update('injury_date', e.target.value)} className={sel} required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Initial RTP Phase</label>
              <select value={form.rtp_phase} onChange={e => update('rtp_phase', parseInt(e.target.value))} className={sel}>
                {RTP_LABELS.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Body Part *</label>
            <select value={form.body_part} onChange={e => update('body_part', e.target.value)} className={sel} required>
              <option value="">Select…</option>
              {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {recurrence && (
            <div className="px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
              ⚠ Recurrence: {recurrence.count} prior {form.body_part} injury in the last 12 months
              (most recent: {recurrence.last_date})
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Injury Type</label>
              <select value={form.injury_type} onChange={e => update('injury_type', e.target.value)} className={sel}>
                <option value="">Select…</option>
                {INJURY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Severity</label>
              <select value={form.severity} onChange={e => update('severity', e.target.value)} className={sel}>
                <option value="">Select…</option>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Mechanism</label>
            <select value={form.mechanism} onChange={e => update('mechanism', e.target.value)} className={sel}>
              <option value="">Select…</option>
              {MECHANISMS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              placeholder="Additional details…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-white/10 rounded-lg text-slate-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.player_id || !form.body_part || saving}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Log Injury'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
