import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrackLabel {
  name?: string;
  squad_number?: number;
  confidence?: number;
  from_ocr?: boolean;
  confirmed?: boolean;
}

const CONFIDENCE_THRESHOLD = 2.5;

/**
 * Hook that resolves analysis track_ids → real player labels
 * (jersey number + roster name) by merging two backend sources:
 *   - track_player_mapping (roster-linked jerseys, written by analysis-callback)
 *   - player_match_stats.jersey_number (OCR-only fallback)
 *
 * Returns helpers so panels can render "#9 Alex Smith" instead of "#8044".
 */
export function useTrackLabels(
  matchId: string | undefined,
  playerMetrics?: Record<string, any> | null,
) {
  const [mapping, setMapping] = useState<Record<number, TrackLabel>>({});
  const [canReadPlayerMatchStats, setCanReadPlayerMatchStats] = useState(true);

  useEffect(() => {
    if (!matchId || matchId === 'demo') return;
    let cancelled = false;
    (async () => {
      const requests: Promise<any>[] = [
        (supabase as any)
          .from('track_player_mapping')
          .select('track_id, jersey_number, confidence, source, players ( name, squad_number )')
          .eq('match_id', matchId),
        canReadPlayerMatchStats
          ? (supabase as any)
              .from('player_match_stats')
              .select('track_id, jersey_number')
              .eq('match_id', matchId)
          : Promise.resolve({ data: [], error: null }),
      ];

      const [mapRes, statsRes] = await Promise.all(requests);
      if (cancelled) return;

      if (statsRes?.error) {
        const errText = `${statsRes.error.code ?? ''} ${statsRes.error.message ?? ''}`.toLowerCase();
        if (errText.includes('pgrst205') || errText.includes('could not find') || errText.includes('player_match_stats')) {
          setCanReadPlayerMatchStats(false);
        }
      }

      const map: Record<number, TrackLabel> = {};
      (statsRes?.data ?? []).forEach((row: any) => {
        if (row.jersey_number != null) {
          // player_match_stats only contains confirmed jerseys (callback drops guesses),
          // so treat these as confirmed.
          map[row.track_id] = {
            squad_number: row.jersey_number,
            from_ocr: true,
            confirmed: true,
          };
        }
      });
      (mapRes?.data ?? []).forEach((row: any) => {
        const linked = !!row.players?.name;
        const conf = row.confidence ?? 0;
        // Roster-linked rows are always trusted. OCR-only rows must clear the
        // confidence bar before we show a number to the user.
        const confirmed = linked || conf >= CONFIDENCE_THRESHOLD;
        if (!confirmed) return;
        map[row.track_id] = {
          name: row.players?.name,
          squad_number: row.players?.squad_number ?? row.jersey_number ?? undefined,
          confidence: row.confidence ?? undefined,
          from_ocr: !linked,
          confirmed: true,
        };
      });
      setMapping(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadPlayerMatchStats, matchId]);

  const guessFor = (id: number): { num: number; conf: number } | null => {
    if (!playerMetrics) return null;
    const pm = playerMetrics[String(id)] ?? playerMetrics[id];
    const num = pm?.jersey_number_guess;
    if (num == null) return null;
    return { num: Number(num), conf: Number(pm?.jersey_confidence ?? 0) };
  };

  const labelFor = (id: number) => {
    const m = mapping[id];
    if (m?.confirmed && m.squad_number) return `#${m.squad_number}`;
    const g = guessFor(id);
    if (g) return `~${g.num}`;
    return `T${id}`;
  };
  const nameFor = (id: number) => {
    const m = mapping[id];
    if (m?.name) return m.name;
    if (m?.confirmed && m.squad_number) return `Unknown #${m.squad_number}`;
    const g = guessFor(id);
    if (g) return `Likely #${g.num}`;
    return `Track ${id}`;
  };

  const isIdentified = (id: number) =>
    !!mapping[id]?.confirmed || guessFor(id) !== null;

  return { mapping, labelFor, nameFor, isIdentified, guessFor };
}