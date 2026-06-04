import { useMemo } from 'react';
import type { TimelineEvent } from '@/types/video-analysis';

export interface CoachTagStats {
  hasTags: boolean;
  homeScore: number;
  awayScore: number;
  totals: {
    goals: number;
    shots: number;
    shots_on_target: number;
    saves: number;
    passes: number;
    tackles: number;
  };
  byTeam: {
    home: CoachTagStats['totals'];
    away: CoachTagStats['totals'];
  };
  result: 'W' | 'L' | 'D' | null;
}

const empty = () => ({
  goals: 0, shots: 0, shots_on_target: 0, saves: 0, passes: 0, tackles: 0,
});

export function useCoachTagStats(
  coachTags: TimelineEvent[],
  isHome?: boolean | null,
): CoachTagStats {
  return useMemo(() => {
    const totals = empty();
    const byTeam = { home: empty(), away: empty() };
    const tags = coachTags.filter((t) => t.source === 'coach');

    for (const t of tags) {
      const type = t.type;
      const team = (t.team === 'home' || t.team === 'away') ? t.team : null;
      const bucket = team ? byTeam[team] : null;

      const inc = (key: keyof typeof totals) => {
        totals[key] += 1;
        if (bucket) bucket[key] += 1;
      };

      if (type === 'goal') {
        inc('goals');
        inc('shots');
        inc('shots_on_target');
      } else if (type === 'shot_on_target') {
        inc('shots');
        inc('shots_on_target');
      } else if (type === 'shot') {
        inc('shots');
      } else if (type === 'save') {
        inc('saves');
      } else if (type === 'pass' || type === 'key_pass') {
        inc('passes');
      } else if (type === 'tackle') {
        inc('tackles');
      }
    }

    const homeScore = byTeam.home.goals;
    const awayScore = byTeam.away.goals;
    let result: 'W' | 'L' | 'D' | null = null;
    if (totals.goals > 0 && isHome !== null && isHome !== undefined) {
      const my = isHome ? homeScore : awayScore;
      const opp = isHome ? awayScore : homeScore;
      result = my > opp ? 'W' : my < opp ? 'L' : 'D';
    }

    return {
      hasTags: tags.length > 0,
      homeScore,
      awayScore,
      totals,
      byTeam,
      result,
    };
  }, [coachTags, isHome]);
}