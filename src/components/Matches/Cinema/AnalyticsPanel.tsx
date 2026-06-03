import { BarChart3 } from 'lucide-react';
import { MatchAnalyticsDashboard } from '../MatchAnalyticsDashboard';
import { ScorelineCard } from './ScorelineCard';
import type { CoachTagStats } from './useCoachTagStats';

interface AnalyticsPanelProps {
  matchId: string;
  job: any;
  demoInsights?: any;
  coachStats?: CoachTagStats;
  match?: any;
}

export function AnalyticsPanel({ matchId, job, demoInsights, coachStats, match }: AnalyticsPanelProps) {
  const useTags = !!coachStats?.hasTags;
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Analytics
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {useTags && match && (
          <ScorelineCard
            homeTeam={match.home_team || 'Home'}
            awayTeam={match.away_team || 'Away'}
            homeScore={coachStats!.homeScore}
            awayScore={coachStats!.awayScore}
            homeColor={match.home_color}
            awayColor={match.away_color}
            homeLogoUrl={match.home_logo_url}
            awayLogoUrl={match.away_logo_url}
            matchType={match.match_type}
            isHome={match.is_home}
            ageGroup={match.age_group}
            status={match.status}
            fromCoachTags
            result={coachStats!.result}
          />
        )}
        <MatchAnalyticsDashboard matchId={matchId} job={job} demoInsights={demoInsights} />
      </div>
    </div>
  );
}
