import { Calendar, MapPin, FileText } from 'lucide-react';
import { ScorelineCard } from './ScorelineCard';

interface SummaryPanelProps {
  match: {
    title?: string | null;
    match_date?: string | null;
    location?: string | null;
    status?: string | null;
    home_team?: string | null;
    away_team?: string | null;
    home_score?: number | null;
    away_score?: number | null;
    home_color?: string | null;
    away_color?: string | null;
    match_type?: string | null;
    is_home?: boolean | null;
    age_group?: string | null;
  };
}

export function SummaryPanel({ match }: SummaryPanelProps) {
  const home = match.home_team || 'Home';
  const away = match.away_team || 'Away';

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Summary
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <h3 className="text-xl font-bold leading-tight">{match.title || 'Untitled Match'}</h3>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
            {match.match_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {new Date(match.match_date).toLocaleDateString()}
              </span>
            )}
            {match.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {match.location}
              </span>
            )}
          </div>
        </div>

        <ScorelineCard
          homeTeam={home}
          awayTeam={away}
          homeScore={match.home_score ?? null}
          awayScore={match.away_score ?? null}
          homeColor={match.home_color}
          awayColor={match.away_color}
          matchType={match.match_type}
          isHome={match.is_home}
          ageGroup={match.age_group}
          status={match.status}
        />
      </div>
    </div>
  );
}
