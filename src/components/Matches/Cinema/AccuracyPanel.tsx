import { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface AccuracyPanelProps {
  matchId: string;
  job: any;
}

interface TagRow { event_type: string; timestamp_ms: number }

// Map raw CV event labels to canonical buckets we evaluate
function canon(t: string): string {
  const x = t.toLowerCase();
  if (x.includes('goal')) return 'goal';
  if (x.includes('shot')) return 'shot';
  if (x.includes('pass')) return 'pass';
  if (x.includes('tackle')) return 'tackle';
  if (x.includes('corner')) return 'corner';
  if (x.includes('foul')) return 'foul';
  if (x.includes('save')) return 'save';
  return x;
}

const MATCH_WINDOW_S = 5; // a CV event within ±5s of a tag of same type counts as a match

function score(cvTimes: number[], gtTimes: number[]) {
  const used = new Set<number>();
  let tp = 0;
  for (const g of gtTimes) {
    let bestIdx = -1; let bestDt = Infinity;
    for (let i = 0; i < cvTimes.length; i++) {
      if (used.has(i)) continue;
      const dt = Math.abs(cvTimes[i] - g);
      if (dt <= MATCH_WINDOW_S && dt < bestDt) { bestDt = dt; bestIdx = i; }
    }
    if (bestIdx >= 0) { used.add(bestIdx); tp++; }
  }
  const fp = cvTimes.length - tp;
  const fn = gtTimes.length - tp;
  const precision = cvTimes.length ? tp / cvTimes.length : 0;
  const recall = gtTimes.length ? tp / gtTimes.length : 0;
  const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1, cv: cvTimes.length, gt: gtTimes.length };
}

export function AccuracyPanel({ matchId, job }: AccuracyPanelProps) {
  const [tags, setTags] = useState<TagRow[]>([]);

  useEffect(() => {
    if (!matchId || matchId === 'demo') return;
    (async () => {
      const { data } = await (supabase as any)
        .from('match_event_tags')
        .select('event_type, timestamp_ms')
        .eq('match_id', matchId);
      setTags((data || []) as TagRow[]);
    })();
  }, [matchId]);

  const cvEvents = useMemo(
    () => (job?.event_data?.events || []) as Array<{ time: number; type: string }>,
    [job],
  );

  const rows = useMemo(() => {
    const types = Array.from(new Set([
      ...tags.map((t) => canon(t.event_type)),
      ...cvEvents.map((e) => canon(e.type)),
    ])).sort();
    return types.map((type) => {
      const cv = cvEvents.filter((e) => canon(e.type) === type).map((e) => e.time);
      const gt = tags.filter((t) => canon(t.event_type) === type).map((t) => t.timestamp_ms / 1000);
      return { type, ...score(cv, gt) };
    });
  }, [tags, cvEvents]);

  const fmtPct = (x: number) => `${(x * 100).toFixed(0)}%`;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-4 w-4" /> Accuracy report
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Detected events vs coach-tagged ground truth. Match window: ±{MATCH_WINDOW_S}s.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tags.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            No ground-truth tags yet. Use the Tag panel to mark events while watching.
          </CardContent></Card>
        )}
        {rows.length > 0 && (
          <div className="border border-border/40 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-2">Event</th>
                  <th className="text-right p-2">GT</th>
                  <th className="text-right p-2">CV</th>
                  <th className="text-right p-2">TP</th>
                  <th className="text-right p-2">FP</th>
                  <th className="text-right p-2">FN</th>
                  <th className="text-right p-2">Prec</th>
                  <th className="text-right p-2">Rec</th>
                  <th className="text-right p-2">F1</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.type} className="border-t border-border/30">
                    <td className="p-2 capitalize font-medium">{r.type}</td>
                    <td className="p-2 text-right">{r.gt}</td>
                    <td className="p-2 text-right">{r.cv}</td>
                    <td className="p-2 text-right text-emerald-500">{r.tp}</td>
                    <td className="p-2 text-right text-amber-500">{r.fp}</td>
                    <td className="p-2 text-right text-rose-500">{r.fn}</td>
                    <td className="p-2 text-right">{fmtPct(r.precision)}</td>
                    <td className="p-2 text-right">{fmtPct(r.recall)}</td>
                    <td className="p-2 text-right font-semibold">{fmtPct(r.f1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}