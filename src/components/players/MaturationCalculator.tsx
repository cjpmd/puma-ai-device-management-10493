import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

const SCALE_MIN = 9;
const SCALE_MAX = 18;

interface Props {
  playerId: string;
  playerDob: string;
  onClose: () => void;
  onSuccess: () => void;
}

function decimalAge(dob: string): number {
  return (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000);
}

function mirwaldOffset(
  height: number,
  seated: number,
  mass: number,
  age: number,
): number {
  const leg = height - seated;
  return (
    -9.236
    + 0.0002708 * (leg * seated)
    - 0.001663  * (age * leg)
    + 0.007216  * (age * seated)
    + 0.02292   * ((mass / height) * 100)
  );
}

function getBadge(offset: number): { label: string; cls: string } {
  if (offset > 1.0)  return { label: 'Early developer',    cls: 'bg-orange-500/20 text-orange-300' };
  if (offset > 0.5)  return { label: 'Slightly advanced',  cls: 'bg-amber-500/20  text-amber-300'  };
  if (offset < -1.0) return { label: 'Late developer',     cls: 'bg-sky-500/20    text-sky-300'    };
  if (offset < -0.5) return { label: 'Slightly delayed',   cls: 'bg-blue-500/20   text-blue-300'   };
  return               { label: 'On-time',             cls: 'bg-emerald-500/20 text-emerald-300' };
}

function getInterpretation(offset: number): string {
  if (offset > 1.0)
    return 'Biologically advanced — account for relative age when assessing performance and prescribing load.';
  if (offset > 0.5)
    return 'Slightly ahead of chronological age — monitor load and growth plate stress around growth spurts.';
  if (offset < -1.0)
    return 'Late developer — physical potential likely to emerge post-PHV; protect from early specialisation pressure.';
  if (offset < -0.5)
    return 'Slightly behind chronological age — expected catch-up growth ahead, reassess in 3–6 months.';
  return 'Developing in line with chronological age.';
}

function scalePct(age: number): number {
  return Math.max(0, Math.min(100, ((age - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));
}

export default function MaturationCalculator({
  playerId,
  playerDob,
  onClose,
  onSuccess,
}: Props) {
  const [height, setHeight] = useState('');
  const [seated, setSeated] = useState('');
  const [mass,   setMass]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const chronoAge = useMemo(() => decimalAge(playerDob), [playerDob]);

  const result = useMemo(() => {
    const h = parseFloat(height);
    const s = parseFloat(seated);
    const m = parseFloat(mass);
    if (!h || !s || !m || h <= 0 || s <= 0 || m <= 0 || s >= h) return null;
    const offset = mirwaldOffset(h, s, m, chronoAge);
    return {
      offset:  Math.round(offset * 100) / 100,
      bioAge:  Math.round((chronoAge + offset) * 100) / 100,
      legLen:  Math.round((h - s) * 10) / 10,
    };
  }, [height, seated, mass, chronoAge]);

  const badge  = result ? getBadge(result.offset)         : null;
  const interp = result ? getInterpretation(result.offset) : null;

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await sb.from('maturation_record').insert({
        player_id:         playerId,
        recorded_date:     new Date().toISOString().split('T')[0],
        height_cm:         parseFloat(height),
        weight_kg:         parseFloat(mass),
        seated_height_cm:  parseFloat(seated),
        bio_age_estimate:  result.bioAge,
        method_used:       'Mirwald_2002',
      });
      if (err) throw new Error(err.message);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-semibold">Maturation Assessment</h2>
            <p className="text-white/40 text-xs mt-0.5">Mirwald 2002 · male equation</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Measurement inputs */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: 'Height',     unit: 'cm', value: height, set: setHeight, placeholder: 'e.g. 162' },
              { label: 'Seated ht', unit: 'cm', value: seated, set: setSeated, placeholder: 'sit-to-crown' },
              { label: 'Mass',      unit: 'kg', value: mass,   set: setMass,   placeholder: 'e.g. 54' },
            ] as const).map(({ label, unit, value, set, placeholder }) => (
              <div key={label}>
                <label className="text-white/50 text-xs block mb-1">
                  {label}{' '}
                  <span className="text-white/25">({unit})</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500 [appearance:textfield]"
                />
              </div>
            ))}
          </div>

          {/* Derived stats row */}
          {result ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-xl py-3">
                <p className="text-[11px] text-white/40 mb-1">Leg length</p>
                <p className="text-white font-semibold text-sm">{result.legLen} cm</p>
              </div>
              <div className="bg-white/5 rounded-xl py-3">
                <p className="text-[11px] text-white/40 mb-1">Chrono age</p>
                <p className="text-white font-semibold text-sm">{chronoAge.toFixed(2)} yr</p>
              </div>
              <div className="bg-white/5 rounded-xl py-3">
                <p className="text-[11px] text-white/40 mb-1">Bio age</p>
                <p className="text-white font-semibold text-sm">{result.bioAge.toFixed(2)} yr</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white/5 border border-dashed border-white/10 py-6 text-center">
              <p className="text-white/30 text-sm">Enter measurements to calculate</p>
            </div>
          )}

          {/* Age bar */}
          {result && (
            <div className="space-y-2">
              <div className="relative h-5 bg-white/10 rounded-full overflow-visible">
                {/* Chrono marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-sky-400 border-2 border-slate-900 shadow z-10"
                  style={{ left: `calc(${scalePct(chronoAge)}% - 8px)` }}
                  title={`Chronological age: ${chronoAge.toFixed(2)} yr`}
                />
                {/* Bio marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-orange-400 border-2 border-slate-900 shadow z-10"
                  style={{ left: `calc(${scalePct(result.bioAge)}% - 8px)` }}
                  title={`Biological age: ${result.bioAge.toFixed(2)} yr`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/25 px-0.5">
                {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((y) => (
                  <span key={y}>{y}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-white/50 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 flex-shrink-0" />
                  Chrono {chronoAge.toFixed(2)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                  Bio {result.bioAge.toFixed(2)}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="text-white/30">offset</span>
                  <span
                    className={`font-semibold ${
                      result.offset > 0 ? 'text-orange-300' : result.offset < 0 ? 'text-sky-300' : 'text-white/60'
                    }`}
                  >
                    {result.offset > 0 ? '+' : ''}{result.offset}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Badge + interpretation */}
          {result && badge && (
            <div className="space-y-2">
              <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${badge.cls}`}>
                {badge.label}
              </span>
              <p className="text-white/50 text-xs leading-relaxed">{interp}</p>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!result || saving}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save record'}
          </button>
        </div>

      </div>
    </div>
  );
}
