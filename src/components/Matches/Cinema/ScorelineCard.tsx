import { Badge } from '@/components/ui/badge';

interface ScorelineCardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeColor?: string | null;
  awayColor?: string | null;
  matchType?: string | null;
  isHome?: boolean | null;
  ageGroup?: string | null;
  status?: string | null;
}

const abbr = (name: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase() || '—';

export function ScorelineCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  homeColor = '#10b981',
  awayColor = '#3b82f6',
  matchType,
  isHome,
  ageGroup,
  status,
}: ScorelineCardProps) {
  const final = status === 'complete' && homeScore !== null && awayScore !== null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-5 space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {matchType && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{matchType}</Badge>}
        {isHome !== null && isHome !== undefined && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {isHome ? 'Home' : 'Away'}
          </Badge>
        )}
        {ageGroup && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{ageGroup}</Badge>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: homeColor || '#10b981' }} />
          <div className="min-w-0">
            <div className="text-3xl font-bold tracking-tight">{abbr(homeTeam)}</div>
            <div className="text-xs text-muted-foreground truncate">{homeTeam}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2">
          <span className="text-4xl md:text-5xl font-bold tabular-nums">
            {homeScore ?? '–'}
          </span>
          <span className="text-2xl text-muted-foreground">:</span>
          <span className="text-4xl md:text-5xl font-bold tabular-nums">
            {awayScore ?? '–'}
          </span>
        </div>

        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <div className="min-w-0 text-right">
            <div className="text-3xl font-bold tracking-tight">{abbr(awayTeam)}</div>
            <div className="text-xs text-muted-foreground truncate">{awayTeam}</div>
          </div>
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: awayColor || '#3b82f6' }} />
        </div>
      </div>

      {final && (
        <div className="flex justify-center">
          <Badge className="uppercase tracking-wider text-[10px]">Final Result</Badge>
        </div>
      )}
    </div>
  );
}
