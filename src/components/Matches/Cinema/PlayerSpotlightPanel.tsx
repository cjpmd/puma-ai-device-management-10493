import { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserCircle2, Film, Play, Sparkles, Activity, Target, Shield, Footprints } from 'lucide-react';
import { useEventThumbnails } from './useEventThumbnails';
import { supabase } from '@/integrations/supabase/client';

interface MatchEvent {
  time: number;
  type: string;
  player_track_id?: number;
  team?: string | null;
  outcome?: string;
}

interface PlayerSpotlightPanelProps {
  matchId: string;
  events: MatchEvent[];
  playerMetrics: Record<string, any> | null;
  videoUrl: string | null;
  onSeek: (time: number) => void;
}

const formatTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const EVENT_LABEL: Record<string, string> = {
  pass: 'Pass',
  shot: 'Shot on goal',
  tackle: 'Tackle',
  possession_change: 'Possession change',
};

export function PlayerSpotlightPanel({
  matchId,
  events,
  playerMetrics,
  videoUrl,
  onSeek,
}: PlayerSpotlightPanelProps) {
  const [mapping, setMapping] = useState<Record<number, { name?: string; squad_number?: number }>>({});

  // All track IDs that appear in events
  const trackIds = useMemo(() => {
    const set = new Set<number>();
    events.forEach((e) => {
      if (typeof e.player_track_id === 'number') set.add(e.player_track_id);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [events]);

  const [selected, setSelected] = useState<number | null>(trackIds[0] ?? null);
  useEffect(() => {
    if (selected === null && trackIds.length > 0) setSelected(trackIds[0]);
  }, [trackIds, selected]);

  // Load track→player name/jersey mapping
  useEffect(() => {
    if (!matchId || matchId === 'demo') return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('track_player_mapping')
        .select('track_id, player_id, players ( name, squad_number )')
        .eq('match_id', matchId);
      if (cancelled || !data) return;
      const map: Record<number, { name?: string; squad_number?: number }> = {};
      data.forEach((row: any) => {
        map[row.track_id] = {
          name: row.players?.name,
          squad_number: row.players?.squad_number,
        };
      });
      setMapping(map);
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  const playerEvents = useMemo(
    () => (selected === null ? [] : events.filter((e) => e.player_track_id === selected)),
    [events, selected],
  );

  const times = useMemo(() => playerEvents.map((e) => e.time), [playerEvents]);
  const thumbs = useEventThumbnails(videoUrl, times);

  const stats = useMemo(() => {
    if (selected === null) return null;
    const evs = playerEvents;
    const fromMetrics = playerMetrics?.[String(selected)] || playerMetrics?.[selected];
    return {
      passes: evs.filter((e) => e.type === 'pass').length,
      shots: evs.filter((e) => e.type === 'shot').length,
      tackles: evs.filter((e) => e.type === 'tackle').length,
      goals: evs.filter((e) => e.outcome === 'goal').length,
      distance: fromMetrics?.distance_m ?? fromMetrics?.distance ?? null,
      sprints: fromMetrics?.sprints ?? null,
      top_speed: fromMetrics?.top_speed_kmh ?? fromMetrics?.top_speed ?? null,
    };
  }, [selected, playerEvents, playerMetrics]);

  const labelFor = (id: number) => {
    const m = mapping[id];
    if (m?.squad_number) return `#${m.squad_number}`;
    return `#${id}`;
  };
  const nameFor = (id: number) => mapping[id]?.name || `Track ${id}`;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserCircle2 className="h-4 w-4" /> Player Spotlight
          </h2>
          <Badge variant="secondary" className="text-xs">{trackIds.length} players</Badge>
        </div>

        {/* Player picker */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {trackIds.length === 0 && (
            <p className="text-xs text-muted-foreground">No tracked players in this match.</p>
          )}
          {trackIds.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={selected === id ? 'default' : 'outline'}
              className="h-8 rounded-full text-xs px-3 shrink-0 font-mono"
              onClick={() => setSelected(id)}
            >
              {labelFor(id)}
            </Button>
          ))}
        </div>
      </div>

      {selected !== null && (
        <>
          {/* Player header + stats */}
          <div className="px-5 py-4 border-b border-border/40 bg-card/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-mono font-bold text-sm">
                {labelFor(selected)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{nameFor(selected)}</p>
                <p className="text-xs text-muted-foreground">{playerEvents.length} events</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <StatCell icon={Sparkles} label="Goals" value={stats?.goals ?? 0} />
              <StatCell icon={Target} label="Shots" value={stats?.shots ?? 0} />
              <StatCell icon={Activity} label="Passes" value={stats?.passes ?? 0} />
              <StatCell icon={Shield} label="Tackles" value={stats?.tackles ?? 0} />
              {stats?.distance != null && (
                <StatCell icon={Footprints} label="Distance" value={`${Math.round(stats.distance)}m`} />
              )}
              {stats?.sprints != null && (
                <StatCell icon={Activity} label="Sprints" value={stats.sprints} />
              )}
              {stats?.top_speed != null && (
                <StatCell icon={Activity} label="Top spd" value={`${stats.top_speed.toFixed?.(1) ?? stats.top_speed} km/h`} />
              )}
            </div>
          </div>

          {/* Clip list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {playerEvents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">
                No events for this player.
              </p>
            )}
            {playerEvents.map((ev, i) => {
              const thumb = thumbs[ev.time];
              const label = EVENT_LABEL[ev.type] || ev.type;
              return (
                <button
                  key={`${ev.time}-${i}`}
                  type="button"
                  onClick={() => onSeek(ev.time)}
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
                      {ev.outcome === 'goal' && (
                        <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                    </div>
                    {ev.outcome && (
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {ev.outcome.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-sm font-semibold mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
