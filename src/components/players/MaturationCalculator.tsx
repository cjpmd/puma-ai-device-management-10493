import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  playerId: string;
  dob?: string;
  onSaved?: () => void;
}

// Mirwald 2002: returns maturity offset (years from PHV)
function mirwald(heightCm: number, seatedCm: number, weightKg: number, age: number, sex: 'male' | 'female'): number {
  const leg = heightCm - seatedCm;
  if (sex === 'male') {
    return (
      -9.236
      + 0.0002708 * (leg * seatedCm)
      - 0.001663  * (age * leg)
      + 0.007216  * (age * seatedCm)
      + 0.02292   * ((weightKg / heightCm) * 100)
    );
  }
  // Female equation (Mirwald 2002)
  return (
    -7.709133
    + 0.0042232  * (age * heightCm)
    - 0.0107529  * (age * ((weightKg / heightCm) * 100))
    + 0.0005161  * (leg * seatedCm)
  );
}

export function MaturationCalculator({ playerId, dob, onSaved }: Props) {
  const [height, setHeight] = useState('');
  const [seated, setSeated] = useState('');
  const [weight, setWeight] = useState('');
  const [sex,    setSex]    = useState<'male' | 'female'>('male');
  const [result, setResult] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const chronoAge = dob
    ? (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)
    : null;

  const canCalc = !!(height && seated && weight && chronoAge != null);

  const handleCalc = () => {
    if (!canCalc) return;
    const offset = mirwald(+height, +seated, +weight, chronoAge!, sex);
    setResult(Math.round(offset * 100) / 100);
    setSaved(false);
  };

  const handleSave = async () => {
    if (result == null) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from('maturation_record').insert({
      player_id:        playerId,
      recorded_date:    new Date().toISOString().split('T')[0],
      height_cm:        +height,
      seated_height_cm: +seated,
      weight_kg:        +weight,
      bio_age_estimate: result,
      method_used:      'Mirwald_2002',
      recorded_by:      user?.id ?? null,
    });
    setSaving(false);
    setSaved(true);
    onSaved?.();
  };

  const badge =
    result == null         ? null
    : result > 1.0         ? { label: 'Early maturer',  style: 'bg-orange-50 text-orange-700 border-orange-200' }
    : result < -1.0        ? { label: 'Late maturer',   style: 'bg-sky-50 text-sky-700 border-sky-200' }
    :                        { label: 'On-time maturer', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
      <div className="text-sm font-semibold text-slate-700">
        Maturation calculator{' '}
        <span className="text-xs font-normal text-slate-400">(Mirwald 2002)</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          { label: 'Height (cm)',        val: height, set: setHeight, min: 100, max: 220 },
          { label: 'Seated height (cm)', val: seated, set: setSeated, min:  50, max: 120 },
          { label: 'Weight (kg)',        val: weight, set: setWeight, min:  20, max: 120 },
        ] as const).map(({ label, val, set, min, max }) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">{label}</span>
            <input
              type="number" min={min} max={max} step="0.1"
              value={val} onChange={e => set(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Sex</span>
          <select value={sex} onChange={e => setSex(e.target.value as 'male' | 'female')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-violet-300">
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
      </div>

      {!chronoAge && (
        <p className="text-xs text-amber-600">Date of birth not set — required for calculation.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCalc}
          disabled={!canCalc}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-white
                     hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          Calculate
        </button>

        {result != null && (
          <>
            <span className="text-sm font-semibold text-slate-700">
              {result > 0 ? `+${result}` : result} yrs from PHV
            </span>
            {badge && (
              <span className={`text-xs border rounded px-2 py-0.5 font-medium ${badge.style}`}>
                {badge.label}
              </span>
            )}
            {!saved ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white
                           hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save to record'}
              </button>
            ) : (
              <span className="ml-auto text-xs text-emerald-600 font-medium">Saved ✓</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
