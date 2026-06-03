import { Badge } from '@/components/ui/badge';

interface ScorelineCardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeColor?: string | null;
  awayColor?: string | null;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  matchType?: string | null;
  isHome?: boolean | null;
  ageGroup?: string | null;
  status?: string | null;
  fromCoachTags?: boolean;
  result?: 'W' | 'L' | 'D' | null;
}

function TeamBadge({ name, color, logoUrl }: { name: string; color?: string | null; logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} badge`}
        className="h-12 w-12 md:h-14 md:w-14 rounded-full object-cover border-2 shrink-0"
        style={{ borderColor: color || 'hsl(var(--border))' }}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="h-12 w-12 md:h-14 md:w-14 rounded-full shrink-0 border-2 border-border/40"
      style={{ background: color || 'hsl(var(--muted))' }}
      aria-hidden
    />
  );
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
  homeLogoUrl,
  awayLogoUrl,
  matchType,
  isHome,
  ageGroup,
  status,
  fromCoachTags = false,
  result = null,
}: ScorelineCardProps) {
  const final = (status === 'complete' || fromCoachTags) && homeScore !== null && awayScore !== null;
  const resultClass =
    result === 'W' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    : result === 'L' ? 'bg-destructive/15 text-destructive border-destructive/30'
    : result === 'D' ? 'bg-muted text-muted-foreground border-border'
    : '';

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
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <TeamBadge name={homeTeam} color={homeColor} logoUrl={homeLogoUrl} />
          <div className="min-w-0">
            <div className="text-2xl md:text-3xl font-bold tracking-tight">{abbr(homeTeam)}</div>
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

        <div className="flex-1 flex items-center gap-3 justify-end min-w-0">
          <div className="min-w-0 text-right">
            <div className="text-2xl md:text-3xl font-bold tracking-tight">{abbr(awayTeam)}</div>
            <div className="text-xs text-muted-foreground truncate">{awayTeam}</div>
          </div>
          <TeamBadge name={awayTeam} color={awayColor} logoUrl={awayLogoUrl} />
        </div>
      </div>

      {final && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <Badge className="uppercase tracking-wider text-[10px]">Final Result</Badge>
            {result && (
              <Badge variant="outline" className={`uppercase tracking-wider text-[10px] ${resultClass}`}>
                {result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Draw'}
              </Badge>
            )}
          </div>
          {fromCoachTags && (
            <span className="text-[10px] text-muted-foreground">From coach tags</span>
          )}
        </div>
      )}
    </div>
  );
}
