import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import FitnessTestModal from '../components/fitness/FitnessTestModal';

const sb = supabase as any;

interface Player  { id: string; name: string; position?: string; date_of_birth?: string; }
interface FitnessResult { id: string; player_id: string; test_date: string; test_name: string; value: number; unit?: string; percentile?: number; bio_age?: number; }
interface Benchmark { test_name: string; bio_age: number; p10: number; p25: number; p50: number; p75: number; p90: number; }

const LOWER_IS_BETTER = ['sprint', 'agility', 't-test', 'illinois', '505'];
function isLowerBetter(name: string) { return LOWER_IS_BETTER.some(t => name.toLowerCase().includes(t)); }

function interpolatePercentile(value: number, bm: Benchmark, testName: string): number {
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

export default function FitnessTesting() {
  const qc = useQueryClient();
  const [showModal, setShowModal]   = useState(false);
  const [activeTest, setActiveTest] = useState<string | null>(null);

  const { data: players = [] } = useQuery({
    queryKey: ['fitness-players'],
    queryFn: async () => { const { data } = await sb.from('players').select('id, name, position, date_of_birth').order('name'); return (data ?? []) as Player[]; },
  });
  const { data: results = [], refetch: refetchResults } = useQuery({
    queryKey: ['fitness-results'],
    queryFn: async () => { const { data } = await sb.from('fitness_test_result').select('id, player_id, test_date, test_name, value, unit, percentile, bio_age').order('test_date', { ascending: false }); return (data ?? []) as FitnessResult[]; },
  });
  const { data: benchmarks = [] } = useQuery({
    queryKey: ['fitness-benchmarks'],
    queryFn: async () => { const { data } = await sb.from('fitness_benchmark').select('*'); return (data ?? []) as Benchmark[]; },
  });
  const { data: bioAgeRows = [] } = useQuery({
    queryKey: ['bio-ages-fitness'],
    queryFn: async () => { const { data } = await sb.from('maturation_record').select('player_id, bio_age_estimate, recorded_date').order('recorded_date', { ascending: false }); return (data ?? []) as Array<{ player_id: string; bio_age_estimate: number }>; },
  });

  const bioAgeMap = new Map<string, number>();
  for (const r of bioAgeRows) { if (!bioAgeMap.has(r.player_id)) bioAgeMap.set(r.player_id, r.bio_age_estimate); }

  const latestMap = new Map<string, FitnessResult>();
  for (const r of results) { const k = `${r.player_id}__${r.test_name}`; if (!latestMap.has(k)) latestMap.set(k, r); }

  const testNames   = [...new Set(results.map(r => r.test_name))].sort();
  const displayTests = activeTest ? [activeTest] : testNames.slice(0, 8);

  function getCellData(playerId: string, testName: string) {
    const result = latestMap.get(`${playerId}__${testName}`);
    if (!result) return null;
    let percentile = result.percentile ?? null;
    if (percentile === null && benchmarks.length > 0) {
      const bioAge = bioAgeMap.get(playerId);
      if (bioAge != null) {
        const ageBms = benchmarks.filter(b => b.test_name === testName);
        if (ageBms.length) {
          const nearest = ageBms.reduce((best,b) => Math.abs(b.bio_age-bioAge) < Math.abs(best.bio_age-bioAge) ? b : best);
          percentile = interpolatePercentile(result.value, nearest, testName);
        }
      }
    }
    return { value: result.value, unit: result.unit, percentile };
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fitness Testing</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
          + Log Test Result
        </button>
      </div>

      <div className="flex items-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500/30 inline-block" /> &lt;P25 — below 25th percentile for bio age</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500/20 inline-block" /> P25–P49</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/10 inline-block" /> P50+</span>
      </div>

      {testNames.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveTest(null)} className={`px-3 py-1 rounded-full text-xs transition-colors ${!activeTest ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>All</button>
          {testNames.map(t => (
            <button key={t} onClick={() => setActiveTest(activeTest === t ? null : t)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${activeTest === t ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {displayTests.length > 0 ? (
        <div className="rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Player</th>
                <th className="text-center px-3 py-3 text-slate-400 font-medium">Bio Age</th>
                {displayTests.map(t => (
                  <th key={t} className="text-center px-3 py-3 text-slate-400 font-medium whitespace-nowrap">
                    {t}
                    {isLowerBetter(t) && <span className="block text-slate-600 text-xs font-normal">lower better</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {players.map(player => {
                const bioAge = bioAgeMap.get(player.id) ??
                  (player.date_of_birth ? Math.round((Date.now() - new Date(player.date_of_birth).getTime()) / (365.25*86400000) * 10) / 10 : null);
                return (
                  <tr key={player.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{player.name}</div>
                      {player.position && <div className="text-slate-500 text-xs">{player.position}</div>}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-300 text-xs">{bioAge != null ? `${bioAge}y` : '—'}</td>
                    {displayTests.map(testName => {
                      const cell = getCellData(player.id, testName);
                      if (!cell) return <td key={testName} className="px-3 py-3 text-center text-slate-700">—</td>;
                      const p = cell.percentile;
                      const cls = p == null ? '' : p < 25 ? 'bg-red-500/20 text-red-300' : p < 50 ? 'text-amber-300' : 'text-emerald-300';
                      return (
                        <td key={testName} className={`px-3 py-3 text-center font-medium ${cls}`}>
                          <div>{cell.value}{cell.unit ? ` ${cell.unit}` : ''}</div>
                          {p != null && <div className="text-xs opacity-60">P{p}</div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {players.length === 0 && <div className="px-4 py-10 text-center text-slate-500 text-sm">No players found</div>}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-14 text-center text-slate-500 text-sm">
          No fitness test results yet. Click "+ Log Test Result" to get started.
        </div>
      )}

      {showModal && (
        <FitnessTestModal
          players={players}
          benchmarks={benchmarks}
          bioAgeMap={bioAgeMap}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); refetchResults(); }}
        />
      )}
    </div>
  );
}
