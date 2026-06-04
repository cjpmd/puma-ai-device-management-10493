import { Calendar, MapPin, FileText } from 'lucide-react';
import { ScorelineCard } from './ScorelineCard';
import type { CoachTagStats } from './useCoachTagStats';

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
    home_logo_url?: string | null;
    away_logo_url?: string | null;
    match_type?: string | null;
    is_home?: boolean | null;
    age_group?: string | null;
  };
  coachStats?: CoachTagStats;
}

export function SummaryPanel({ match, coachStats }: SummaryPanelProps) {
  const home = match.home_team || 'Home';
  const away = match.away_team || 'Away';
  const useTags = !!coachStats?.hasTags;
  const homeScore = useTags ? coachStats!.homeScore : (match.home_score ?? null);
  const awayScore = useTags ? coachStats!.awayScore : (match.away_score ?? null);

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
          homeScore={homeScore}
          awayScore={awayScore}
          homeColor={match.home_color}
          awayColor={match.away_color}
          homeLogoUrl={match.home_logo_url}
          awayLogoUrl={match.away_logo_url}
          matchType={match.match_type}
          isHome={match.is_home}
          ageGroup={match.age_group}
          status={match.status}
          fromCoachTags={useTags}
          result={coachStats?.result ?? null}
        />

        {useTags && <CoachStatsStrip coachStats={coachStats!} homeName={home} awayName={away} />}
      </div>
    </div>
  );
}

function CoachStatsStrip({
  coachStats,
  homeName,
  awayName,
}: {
  coachStats: CoachTagStats;
  homeName: string;
  awayName: string;
}) {
  const rows: { label: string; key: keyof CoachTagStats['totals'] }[] = [
    { label: 'Goals', key: 'goals' },
    { label: 'Shots', key: 'shots' },
    { label: 'Shots on target', key: 'shots_on_target' },
    { label: 'Saves', key: 'saves' },
    { label: 'Passes', key: 'passes' },
    { label: 'Tackles', key: 'tackles' },
  ];
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Coach-tagged stats</h4>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1.5 text-sm">
        <div />
        <div className="text-[10px] uppercase text-muted-foreground text-right">{homeName}</div>
        <div className="text-[10px] uppercase text-muted-foreground text-right">{awayName}</div>
        <div className="text-[10px] uppercase text-muted-foreground text-right">Total</div>
        {rows.map((r) => (
          <FragmentRow key={r.key}
            label={r.label}
            home={coachStats.byTeam.home[r.key]}
            away={coachStats.byTeam.away[r.key]}
            total={coachStats.totals[r.key]}
          />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ label, home, away, total }: { label: string; home: number; away: number; total: number }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right tabular-nums">{home}</div>
      <div className="text-right tabular-nums">{away}</div>
      <div className="text-right tabular-nums font-medium">{total}</div>
    </>
  );
}
