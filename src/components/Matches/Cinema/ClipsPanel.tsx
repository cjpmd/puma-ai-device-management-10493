import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Film, Play, Sparkles } from 'lucide-react';
import { useEventThumbnails } from './useEventThumbnails';
import { useTrackLabels } from './useTrackLabels';

interface MatchEvent {
  time: number;
  type: string;
  player_track_id?: number;
  team?: string | null;
  outcome?: string;
  source?: 'cv' | 'coach';
}

interface ClipsPanelProps {
  events: MatchEvent[];
  videoUrl: string | null;
  onSeek: (time: number) => void;
  matchId?: string;
}

const isGoal = (e: MatchEvent) => e.type === 'goal' || e.outcome === 'goal';
const isShotOnTarget = (e: MatchEvent) =>
  e.type === 'shot_on_target' || isGoal(e) || (e.type === 'shot' && e.outcome === 'on_target');
const isShot = (e: MatchEvent) => e.type === 'shot' || e.type === 'shot_on_target' || isGoal(e);

const FILTER_PRESETS: { key: string; label: string; match: (e: MatchEvent) => boolean }[] = [
  { key: 'all',     label: 'All',             match: () => true },
  { key: 'goals',   label: 'Goals',           match: isGoal },
  { key: 'sot',     label: 'Shots on target', match: isShotOnTarget },
  { key: 'shots',   label: 'Shots',           match: isShot },
  { key: 'saves',   label: 'Saves',           match: (e) => e.type === 'save' },
  { key: 'passes',  label: 'Passes',          match: (e) => e.type === 'pass' || e.type === 'key_pass' },
  { key: 'tackles', label: 'Tackles',         match: (e) => e.type === 'tackle' },
];

const EVENT_LABEL: Record<string, string> = {
  pass: 'Pass',
  key_pass: 'Key pass',
  shot: 'Shot on goal',
  shot_on_target: 'Shot on target',
  goal: 'Goal',
  save: 'Save',
  tackle: 'Tackle',
  foul: 'Foul',
  corner: 'Corner',
  free_kick: 'Free kick',
  yellow_card: 'Yellow card',
  red_card: 'Red card',
  substitution: 'Substitution',
  key_moment: 'Key moment',
  possession_change: 'Possession change',
};

const PRE_ROLL_SECONDS: Record<string, number> = {
  goal: 5,
  shot_on_target: 5,
};

const getPreRoll = (e: MatchEvent) => {
  if (PRE_ROLL_SECONDS[e.type] !== undefined) return PRE_ROLL_SECONDS[e.type];
  if (e.outcome === 'goal') return 5;
  return 0;
};

const formatTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function ClipsPanel({ events, videoUrl, onSeek }: ClipsPanelProps) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const preset = FILTER_PRESETS.find((p) => p.key === filter) || FILTER_PRESETS[0];
    return events.filter(preset.match).slice(0, 60);
  }, [events, filter]);

  const times = useMemo(() => filtered.map((e) => e.time), [filtered]);
  const thumbs = useEventThumbnails(videoUrl, times);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Film className="h-4 w-4" /> Clips
          </h2>
          <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={filter === p.key ? 'default' : 'outline'}
              className="h-7 rounded-full text-xs px-3"
              onClick={() => setFilter(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            No clips for this filter.
          </p>
        )}

        {filtered.map((ev, i) => {
          const thumb = thumbs[ev.time];
          const label = EVENT_LABEL[ev.type] || ev.type;
          const preRoll = getPreRoll(ev);
          const seekTo = Math.max(0, ev.time - preRoll);
          return (
            <button
              key={`${ev.time}-${i}`}
              type="button"
              onClick={() => onSeek(seekTo)}
              className="w-full flex gap-3 p-2 rounded-lg border border-border/40 bg-card/40 hover:bg-card/80 hover:border-border transition-all text-left group"
            >
              <div className="relative w-28 aspect-video rounded-md overflow-hidden bg-muted shrink-0">
                {thumb ? (
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-6 w-6 text-white" fill="currentColor" />
                </div>
                <span className="absolute bottom-1 right-1 text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded">
                  {formatTime(ev.time)}
                </span>
              </div>

              <div className="flex-1 min-w-0 py-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm truncate">{label}</p>
                  {(ev.outcome === 'goal' || ev.type === 'goal') && (
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {ev.source === 'coach' && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Coach</Badge>
                  )}
                  {ev.player_track_id !== undefined && (
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                      #{ev.player_track_id}
                    </Badge>
                  )}
                  {ev.team && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {ev.team === 'home' || ev.team === 'away' ? ev.team : `Team ${ev.team}`}
                    </Badge>
                  )}
                  {preRoll > 0 && (
                    <span className="text-[10px] text-muted-foreground">−{preRoll}s lead-in</span>
                  )}
                  {ev.outcome && ev.outcome !== 'goal' && (
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {ev.outcome.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
