import { useMemo, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Minus, Plus, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchEvent {
  time: number;
  type: string;
  player_track_id?: number;
  team?: string | null;
  outcome?: string;
}

interface MatchTimelineStripProps {
  events: MatchEvent[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

type GroupMode = 'tags' | 'players';

const TYPE_COLORS: Record<string, string> = {
  goal: 'hsl(48 95% 55%)',
  shot: 'hsl(340 82% 60%)',
  pass: 'hsl(210 90% 60%)',
  tackle: 'hsl(140 60% 50%)',
  possession_change: 'hsl(280 60% 60%)',
  other: 'hsl(0 0% 60%)',
};

const TYPE_LABEL: Record<string, string> = {
  goal: 'Goal',
  shot: 'Shot on goal',
  pass: 'Pass',
  tackle: 'Tackle',
  possession_change: 'Possession',
  other: 'Other',
};

const formatTime = (t: number) => {
  if (!isFinite(t)) return '00:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const getEventKey = (e: MatchEvent) => (e.outcome === 'goal' ? 'goal' : e.type || 'other');

export function MatchTimelineStrip({
  events,
  duration,
  currentTime,
  onSeek,
}: MatchTimelineStripProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState<GroupMode>('tags');
  const [zoom, setZoom] = useState(100); // percent: 50..400
  const scrollRef = useRef<HTMLDivElement>(null);

  const safeDuration = duration > 0 ? duration : Math.max(...events.map((e) => e.time), 60) + 30;

  // Base 0.6 px per second at 100% zoom — ensures a 60min match is ~2160px wide
  const pixelsPerSecond = (zoom / 100) * 0.6;
  const trackWidth = Math.max(safeDuration * pixelsPerSecond, 600);

  const rows = useMemo(() => {
    if (mode === 'tags') {
      const byType = new Map<string, MatchEvent[]>();
      events.forEach((e) => {
        const k = getEventKey(e);
        if (!byType.has(k)) byType.set(k, []);
        byType.get(k)!.push(e);
      });
      const order = ['goal', 'shot', 'pass', 'tackle', 'possession_change', 'other'];
      return order
        .filter((k) => byType.has(k))
        .map((k) => ({ key: k, label: TYPE_LABEL[k] || k, color: TYPE_COLORS[k], events: byType.get(k)! }));
    }
    // players
    const byPlayer = new Map<number, MatchEvent[]>();
    events.forEach((e) => {
      if (e.player_track_id === undefined || e.player_track_id === null) return;
      if (!byPlayer.has(e.player_track_id)) byPlayer.set(e.player_track_id, []);
      byPlayer.get(e.player_track_id)!.push(e);
    });
    return Array.from(byPlayer.entries())
      .sort(([a], [b]) => a - b)
      .map(([id, evs]) => ({
        key: `p-${id}`,
        label: `#${id}`,
        color: 'hsl(var(--primary))',
        events: evs,
      }));
  }, [events, mode]);

  // Time ruler ticks — aim ~8-12 visible labels
  const tickInterval = useMemo(() => {
    const targetPx = 120;
    const seconds = targetPx / pixelsPerSecond;
    const candidates = [10, 30, 60, 120, 300, 600, 1200];
    return candidates.find((c) => c >= seconds) || 1200;
  }, [pixelsPerSecond]);

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let t = 0; t <= safeDuration; t += tickInterval) arr.push(t);
    return arr;
  }, [safeDuration, tickInterval]);

  // Auto-scroll to keep playhead in view
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const playheadX = currentTime * pixelsPerSecond;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    if (playheadX < viewLeft + 40 || playheadX > viewRight - 80) {
      el.scrollLeft = Math.max(0, playheadX - el.clientWidth / 2);
    }
  }, [currentTime, pixelsPerSecond]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(x / pixelsPerSecond);
  };

  return (
    <div className="border-t border-border/40 bg-background/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
            Timeline
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs rounded-full">
                Customize: {mode === 'tags' ? 'Tags' : 'Players'}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setMode('tags')}>By tags</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMode('players')}>By players</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <span className="font-mono text-muted-foreground tabular-nums w-20 text-right">
            {formatTime(currentTime)} / {formatTime(safeDuration)}
          </span>
          <div className="w-px h-4 bg-border mx-2" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
            disabled={zoom <= 50}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-12 text-center font-mono tabular-nums">{zoom}%</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.min(400, z + 25))}
            disabled={zoom >= 400}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden">
          <div style={{ width: trackWidth }} className="relative select-none">
            {/* Time ruler */}
            <div className="relative h-6 border-b border-border/40 cursor-pointer" onClick={handleTrackClick}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full flex items-end pb-1"
                  style={{ left: t * pixelsPerSecond }}
                >
                  <div className="w-px h-2 bg-border mr-1" />
                  <span className="text-[10px] font-mono text-muted-foreground">{formatTime(t)}</span>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="max-h-[200px] overflow-y-auto">
              {rows.length === 0 && (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                  No events to display.
                </div>
              )}
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="relative h-9 border-b border-border/20 hover:bg-foreground/[0.02] cursor-pointer"
                  onClick={handleTrackClick}
                >
                  <div className="sticky left-0 z-10 inline-flex items-center gap-1.5 h-full px-3 bg-background/80 backdrop-blur-sm border-r border-border/40 text-xs">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="font-medium truncate max-w-[120px]">{row.label}</span>
                    <span className="text-muted-foreground tabular-nums">{row.events.length}</span>
                  </div>
                  {row.events.map((ev, i) => (
                    <button
                      key={`${ev.time}-${i}`}
                      type="button"
                      title={`${TYPE_LABEL[getEventKey(ev)] || ev.type} @ ${formatTime(ev.time)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek(ev.time);
                      }}
                      className={cn(
                        'absolute top-1.5 bottom-1.5 w-1.5 rounded-sm hover:w-2.5 hover:-translate-x-[2px] transition-all',
                        ev.outcome === 'goal' && 'ring-1 ring-amber-300/60',
                      )}
                      style={{
                        left: ev.time * pixelsPerSecond,
                        background: TYPE_COLORS[getEventKey(ev)] || row.color,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary z-20"
              style={{ left: currentTime * pixelsPerSecond }}
            >
              <div className="absolute -top-1 -left-[5px] w-[11px] h-[11px] rotate-45 bg-primary" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
