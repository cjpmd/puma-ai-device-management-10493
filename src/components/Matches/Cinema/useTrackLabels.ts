import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrackLabel {
  name?: string;
  squad_number?: number;
  confidence?: number;
  from_ocr?: boolean;
}

/**
 * Hook that resolves analysis track_ids → real player labels
 * (jersey number + roster name) by merging two backend sources:
 *   - track_player_mapping (roster-linked jerseys, written by analysis-callback)
 *   - player_match_stats.jersey_number (OCR-only fallback)
 *
 * Returns helpers so panels can render "#9 Alex Smith" instead of "#8044".
 */
export function useTrackLabels(matchId: string | undefined) {
  const [mapping, setMapping] = useState<Record<number, TrackLabel>>({});

  useEffect(() => {
    if (!matchId || matchId === 'demo') return;
    let cancelled = false;
    (async () => {
      const [mapRes, statsRes] = await Promise.all([
        (supabase as any)
          .from('track_player_mapping')
          .select('track_id, jersey_number, confidence, source, players ( name, squad_number )')
          .eq('match_id', matchId),
        (supabase as any)
          .from('player_match_stats')
          .select('track_id, jersey_number')
          .eq('match_id', matchId),
      ]);
      if (cancelled) return;
      const map: Record<number, TrackLabel> = {};
      (statsRes?.data ?? []).forEach((row: any) => {
        if (row.jersey_number != null) {
          map[row.track_id] = { squad_number: row.jersey_number, from_ocr: true };
        }
      });
      (mapRes?.data ?? []).forEach((row: any) => {
        map[row.track_id] = {
          name: row.players?.name,
          squad_number: row.players?.squad_number ?? row.jersey_number ?? undefined,
          confidence: row.confidence ?? undefined,
          from_ocr: !row.players?.name,
        };
      });
      setMapping(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const labelFor = (id: number) => {
    const m = mapping[id];
    if (m?.squad_number) return `#${m.squad_number}`;
    return `T${id}`;
  };
  const nameFor = (id: number) => {
    const m = mapping[id];
    if (m?.name) return m.name;
    if (m?.squad_number) return `Unknown #${m.squad_number}`;
    return `Track ${id}`;
  };

  return { mapping, labelFor, nameFor };
}