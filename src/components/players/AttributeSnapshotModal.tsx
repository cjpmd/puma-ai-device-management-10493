import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

const CATEGORIES = ['technical', 'physical', 'tactical', 'mental'] as const;
const ANCHORS = [1, 3, 5, 7, 9];

function currentSeason(): string {
  const d = new Date();
  const cutoff = new Date(d.getFullYear(), 7, 1);
  const y = d >= cutoff ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(2)}`;
}

function nearestDescriptor(
  descriptors: Record<string, string> | null | undefined,
  value: number,
): string {
  if (!descriptors) return '';
  const nearest = ANCHORS.reduce((p, c) =>
    Math.abs(c - value) < Math.abs(p - value) ? c : p,
  );
  return descriptors[String(nearest)] ?? '';
}

type AttrDef = {
  id: string;
  name: string;
  category: string;
  max_value: number;
  descriptors: Record<string, string> | null;
};

interface Props {
  playerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AttributeSnapshotModal({ playerId, onClose, onSuccess }: Props) {
  const [scorer1, setScorer1] = useState('');
  const [scorer2, setScorer2] = useState('');
  const [scores1, setScores1] = useState<Record<string, number>>({});
  const [scores2, setScores2] = useState<Record<string, number>>({});
  const [activeDesc, setActiveDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: defs = [], isLoading } = useQuery<AttrDef[]>({
    queryKey: ['attribute-defs-full'],
    staleTime: 600_000,
    queryFn: async () => {
      const { data } = await sb
        .from('attribute_definition')
        .select('id, name, category, max_value, descriptors')
        .eq('is_active', true)
        .order('category')
        .order('name');
      return (data ?? []) as AttrDef[];
    },
  });

  function handlePip(scorerNum: 1 | 2, def: AttrDef, val: number) {
    if (scorerNum === 1) {
      setScores1((p) => ({ ...p, [def.id]: val }));
    } else {
      setScores2((p) => ({ ...p, [def.id]: val }));
    }
    const desc = nearestDescriptor(def.descriptors, val);
    setActiveDesc(desc ? `${def.name} — ${desc}` : '');
  }

  const divergentIds = new Set(
    defs
      .filter((d) => {
        const s1 = scores1[d.id];
        const s2 = scores2[d.id];
        return s1 != null && s2 != null && Math.abs(s1 - s2) > 2;
      })
      .map((d) => d.id),
  );

  const allScored =
    defs.length > 0 &&
    defs.every((d) => scores1[d.id] != null && scores2[d.id] != null);

  const canSubmit = allScored && divergentIds.size === 0 && !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const averaged: Record<string, number> = {};
      for (const def of defs) {
        averaged[def.id] =
          Math.round(((scores1[def.id] + scores2[def.id]) / 2) * 10) / 10;
      }
      const { error: insertErr } = await sb.from('attribute_snapshot').insert({
        player_id: playerId,
        scores: averaged,
        snapshot_date: new Date().toISOString().split('T')[0],
        season: currentSeason(),
        is_final: true,
        notes:
          `Scorer 1: ${scorer1.trim() || 'unnamed'} · ` +
          `Scorer 2: ${scorer2.trim() || 'unnamed'}`,
      });
      if (insertErr) throw new Error(insertErr.message);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    items: defs.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0);

  const footerHint =
    divergentIds.size > 0
      ? `${divergentIds.size} attribute${divergentIds.size > 1 ? 's' : ''} diverge by >2 — discuss and re-score`
      : !allScored
      ? 'Score every attribute for both scorers to continue'
      : 'Ready to submit';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">New Attribute Snapshot</h2>
            <p className="text-white/40 text-xs mt-0.5">
              {currentSeason()} · both scorers score independently
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        {/* Scorer names */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-white/10 flex-shrink-0">
          <div>
            <label className="text-white/50 text-xs block mb-1">Scorer 1 name</label>
            <input
              value={scorer1}
              onChange={(e) => setScorer1(e.target.value)}
              placeholder="e.g. James Smith"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1">Scorer 2 name</label>
            <input
              value={scorer2}
              onChange={(e) => setScorer2(e.target.value)}
              placeholder="e.g. Alex Jones"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Attribute list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isLoading && (
            <p className="text-white/40 text-sm text-center py-8">Loading attributes…</p>
          )}

          {byCategory.map(({ cat, items }) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 capitalize">
                {cat}
              </h3>
              <div className="space-y-4">
                {items.map((def) => {
                  const s1 = scores1[def.id];
                  const s2 = scores2[def.id];
                  const diverged = divergentIds.has(def.id);
                  const avg =
                    s1 != null && s2 != null
                      ? Math.round(((s1 + s2) / 2) * 10) / 10
                      : null;

                  return (
                    <div
                      key={def.id}
                      className={`rounded-xl p-3 ${
                        diverged
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-white/5'
                      }`}
                    >
                      {/* Attribute header */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-sm font-medium ${
                            diverged ? 'text-red-300' : 'text-white'
                          }`}
                        >
                          {def.name}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          {avg !== null && !diverged && (
                            <span className="text-white/40">
                              avg 
                              <span className="text-white/70 font-medium">{avg}</span>
                            </span>
                          )}
                          {diverged && (
                            <span className="text-red-400 font-medium">
                              Δ{Math.abs((s1 ?? 0) - (s2 ?? 0))} — re-discuss
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Scorer 1 pip row */}
                      <div className="mb-2">
                        <p className="text-[10px] text-white/30 mb-1">
                          {scorer1 || 'Scorer 1'}
                          {s1 != null && (
                            <span className="ml-1 text-violet-400 font-semibold">{s1}</span>
                          )}
                        </p>
                        <div className="flex gap-1">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <button
                              key={n}
                              onClick={() => handlePip(1, def, n)}
                              className={`flex-1 h-6 rounded-full text-[9px] font-bold transition-colors ${
                                s1 != null && n <= s1
                                  ? 'bg-violet-500 text-white'
                                  : 'bg-white/10 text-white/25 hover:bg-violet-400/30 hover:text-white/60'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Scorer 2 pip row */}
                      <div>
                        <p className="text-[10px] text-white/30 mb-1">
                          {scorer2 || 'Scorer 2'}
                          {s2 != null && (
                            <span className="ml-1 text-emerald-400 font-semibold">{s2}</span>
                          )}
                        </p>
                        <div className="flex gap-1">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <button
                              key={n}
                              onClick={() => handlePip(2, def, n)}
                              className={`flex-1 h-6 rounded-full text-[9px] font-bold transition-colors ${
                                s2 != null && n <= s2
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-white/10 text-white/25 hover:bg-emerald-400/30 hover:text-white/60'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Descriptor hint — sticky above footer */}
        {activeDesc && (
          <div className="px-6 py-2 border-t border-white/5 bg-white/[0.02] flex-shrink-0">
            <p className="text-xs text-white/40 italic">{activeDesc}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center gap-4 flex-shrink-0">
          <p
            className={`text-xs flex-1 ${
              divergentIds.size > 0
                ? 'text-red-400'
                : allScored
                ? 'text-emerald-400'
                : 'text-white/40'
            }`}
          >
            {error || footerHint}
          </p>
          <button
            onClick={onClose}
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Submit snapshot'}
          </button>
        </div>
      </div>
    </div>
  );
}
