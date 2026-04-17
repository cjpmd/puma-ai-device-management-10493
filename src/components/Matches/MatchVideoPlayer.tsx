import { useEffect, useRef, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Film, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface MatchEvent {
  time: number;
  type: string;
  player_track_id?: number;
  team?: string | null;
  outcome?: string;
}

interface MatchVideoPlayerProps {
  matchId: string;
  job: {
    output_video_path: string | null;
    output_highlights_path: string | null;
    event_data?: { events?: MatchEvent[] } | null;
  } | null;
}

const EVENT_COLORS: Record<string, string> = {
  pass: 'bg-blue-500',
  shot: 'bg-red-500',
  tackle: 'bg-amber-500',
  possession_change: 'bg-muted-foreground',
};

export function MatchVideoPlayer({ matchId, job }: MatchVideoPlayerProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [filterType, setFilterType] = useState<string>('all');

  const events = useMemo(() => job?.event_data?.events || [], [job?.event_data?.events]);

  const filteredEvents = useMemo(
    () => filterType === 'all' ? events : events.filter(e => e.type === filterType),
    [events, filterType]
  );

  const eventTypes = useMemo(() => {
    const set = new Set(events.map(e => e.type));
    return Array.from(set);
  }, [events]);

  const loadVideo = async () => {
    if (!job?.output_video_path) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-output-url', {
        body: { match_id: matchId, file_type: 'video' },
      });
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('No URL returned');
      setVideoUrl(data.url);
    } catch (err: any) {
      toast({ title: 'Failed to load video', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadHighlights = async () => {
    setHighlightsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-output-url', {
        body: { match_id: matchId, file_type: 'highlights' },
      });
      if (error) throw new Error(error.message);
      window.open(data.url, '_blank');
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setHighlightsLoading(false);
    }
  };

  const seekTo = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  if (!job?.output_video_path) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Film className="h-5 w-5" />
          Match Footage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!videoUrl ? (
          <Button onClick={loadVideo} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
              : 'Load Match Video'
            }
          </Button>
        ) : (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full rounded-md bg-black aspect-video"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />

            {job.output_highlights_path && (
              <Button size="sm" variant="outline" onClick={downloadHighlights} disabled={highlightsLoading}>
                {highlightsLoading
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <Download className="h-4 w-4 mr-1" />} Highlights Reel
              </Button>
            )}

            {events.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Event Timeline ({filteredEvents.length})</h4>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      size="sm"
                      variant={filterType === 'all' ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setFilterType('all')}
                    >
                      All
                    </Button>
                    {eventTypes.map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant={filterType === t ? 'default' : 'outline'}
                        className="h-7 text-xs capitalize"
                        onClick={() => setFilterType(t)}
                      >
                        {t.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Visual timeline track */}
                <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                  {duration > 0 && filteredEvents.map((ev, i) => {
                    const left = (ev.time / duration) * 100;
                    const color = EVENT_COLORS[ev.type] || 'bg-muted-foreground';
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => seekTo(ev.time)}
                        className={`absolute top-0 bottom-0 w-0.5 ${color} hover:w-1 transition-all cursor-pointer`}
                        style={{ left: `${left}%` }}
                        title={`${ev.type} @ ${ev.time.toFixed(1)}s`}
                      />
                    );
                  })}
                </div>

                {/* Scrollable event list */}
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                  {filteredEvents.slice(0, 100).map((ev, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => seekTo(ev.time)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <span className="font-mono text-xs text-muted-foreground w-14">
                        {Math.floor(ev.time / 60)}:{String(Math.floor(ev.time % 60)).padStart(2, '0')}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${EVENT_COLORS[ev.type] || 'bg-muted-foreground'}`} />
                      <span className="capitalize flex-1">{ev.type.replace('_', ' ')}</span>
                      {ev.player_track_id !== undefined && (
                        <Badge variant="outline" className="font-mono text-xs">#{ev.player_track_id}</Badge>
                      )}
                      {ev.outcome && (
                        <Badge variant="secondary" className="text-xs">{ev.outcome}</Badge>
                      )}
                    </button>
                  ))}
                  {filteredEvents.length > 100 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      Showing first 100 of {filteredEvents.length} events
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
