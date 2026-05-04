import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgType } from '@/contexts/OrgTypeContext';

interface Props {
  playerId: string;
  season: string;
  onClose: () => void;
  onSaved: () => void;
}

interface AttrDef {
  id: string;
  name: string;
  category: string;
  max_value: number;
  descriptors: Record<string, string>;
}

interface Draft {
  id: string;
  draft_scores_a: Record<string, number> | null;
}

const CATEGORIES = ['technical', 'physical', 'tactical', 'mental'] as const;

export function AttributeSnapshotModal({ playerId, season, onClose, onSaved }: Props) {
  const { academyId } = useOrgType();
  const [defs, setDefs]         = useState<AttrDef[]>([]);
  const [draft, setDraft]       = useState<Draft | null>(null);
  const [scores, setScores]     = useState<Record<string, number>>({});
  const [activeDesc, setActiveDesc] = useState<string>('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!academyId) return;
    const sb = supabase as any;
    Promise.all([
      sb.from('attribute_definition')
        .select('id, name, category, max_value, descriptors')
        .eq('academy_id', academyId)
        .eq('is_active', true)
        .order('category'),
      sb.from('attribute_snapshot')
        .select('id, draft_scores_a')
        .eq('player_id', playerId)
        .eq('season', season)
        .eq('is_final', false)
        .maybeSingle(),
    ]).then(([{ data: defData }, { data: draftData }]) => {
      setDefs(defData ?? []);
      setDraft(draftData ?? null);
    });
  }, [academyId, playerId, season]);

  const isSecondScorer = draft !== null;

  const diverged = (defId: string): boolean => {
    if (!isSecondScorer || !draft.draft_scores_a) return false;
    const a = draft.draft_scores_a[defId];
    const b = scores[defId];
    return a != null && b != null && Math.abs(a - b) > 2;
  };

  const divergedNames = defs
    .filter(d => diverged(d.id))
    .map(d => d.name);

  const handlePip = (defId: string, val: number) => {
    setScores(prev => ({ ...prev, [defId]: val }));
    const def = defs.find(d => d.id === defId);
    if (def?.descriptors) {
      const keys = Object.keys(def.descriptors).map(Number).sort((a, b) => a - b);
      const nearest = keys.reduce((p, c) => Math.abs(c - val) < Math.abs(p - val) ? c : p, keys[0]);
      setActiveDesc(def.descriptors[String(nearest)] ?? '');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const sb = supabase as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated'); setSaving(false); return; }
    try {
      if (!isSecondScorer) {
        await sb.from('attribute_snapshot').insert({
          player_id:      playerId,
          scorer_id:      user.id,
          scorer_a_id:    user.id,
          snapshot_date:  new Date().toISOString().split('T')[0],
          season,
          scores:         {},
          draft_scores_a: scores,
          is_final:       false,
        });
      } else {
        // Average scorer A and scorer B, then finalise
        const finalScores: Record<string, number> = {};
        for (const def of defs) {
          const a = draft.draft_scores_a?.[def.id] ?? 0;
          const b = scores[def.id] ?? 0;
          finalScores[def.id] = Math.round(((a + b) / 2) * 10) / 10;
        }
        await sb.from('attribute_snapshot')
          .update({ scores: finalScores, is_final: true })
          .eq('id', draft.id);
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
      setSaving(false);
    }
  };

  const allScored = defs.length > 0 && defs.every(d => scores[d.id] != null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="text-base font-semibold text-slate-900">
              {isSecondScorer ? 'Second scorer — review & finalise' : 'New attribute snapshot'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{season}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Banners */}
        {isSecondScorer && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex-shrink-0">
            A draft from scorer A exists. Enter your independent scores, then submit to finalise the averaged snapshot.
          </div>
        )}
        {divergedNames.length > 0 && (
          <div className="mx-6 mt-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex-shrink-0">
            Divergence &gt;2 on: <strong>{divergedNames.join(', ')}</strong>. Discuss before submitting.
          </div>
        )}

        {/* Attribute scoring */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {CATEGORIES.map(cat => {
            const catDefs = defs.filter(d => d.category === cat);
            if (!catDefs.length) return null;
            return (
              <div key={cat}>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 capitalize">{cat}</div>
                <div className="space-y-4">
                  {catDefs.map(def => {
                    const val  = scores[def.id];
                    const aVal = draft?.draft_scores_a?.[def.id];
                    const bad  = diverged(def.id);
                    return (
                      <div key={def.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm font-medium ${bad ? 'text-red-600' : 'text-slate-700'}`}>
                            {def.name}
                          </span>
                          <div className="flex items-center gap-3">
                            {isSecondScorer && aVal != null && (
                              <span className="text-xs text-slate-400">A: {aVal}</span>
                            )}
                            <span className={`text-xs font-bold w-5 text-right ${bad ? 'text-red-500' : 'text-slate-500'}`}>
                              {val ?? '—'}
                            </span>
                          </div>
                        </div>
                        {/* Pip row */}
                        <div className="flex gap-1">
                          {Array.from({ length: def.max_value }, (_, i) => i + 1).map(n => (
                            <button
                              key={n}
                              onClick={() => handlePip(def.id, n)}
                              className={`h-6 flex-1 rounded text-[10px] font-semibold transition-colors ${
                                val != null && n <= val
                                  ? 'bg-violet-500 text-white'
                                  : 'bg-slate-100 text-slate-400 hover:bg-violet-100'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* Descriptor hint */}
          {activeDesc && (
            <div className="sticky bottom-0 bg-white/90 border-t border-slate-100 pt-2 text-xs text-slate-400 italic">
              {activeDesc}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
          {error && <span className="text-xs text-red-500 flex-1">{error}</span>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!allScored || saving || (divergedNames.length > 0 && isSecondScorer)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white
                         hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : isSecondScorer ? 'Finalise snapshot' : 'Submit as scorer A'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
