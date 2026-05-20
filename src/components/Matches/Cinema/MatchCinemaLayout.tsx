import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CinemaVideoPlayer, type CinemaVideoHandle } from './CinemaVideoPlayer';
import { IconRail, type CinemaPanel } from './IconRail';
import { ClipsPanel } from './ClipsPanel';
import { SummaryPanel } from './SummaryPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { TeamPanel } from './TeamPanel';
import { PlayerSpotlightPanel } from './PlayerSpotlightPanel';
import { PassNetworkPanel } from './PassNetworkPanel';
import { MatchTimelineStrip } from './MatchTimelineStrip';
import { supabase } from '@/integrations/supabase/client';
import type { TimelineEvent } from '@/types/video-analysis';

interface MatchCinemaLayoutProps {
  matchId: string;
  match: any;
  job: any;
  demoVideoUrl?: string;
  demoInsights?: any;
}

export function MatchCinemaLayout({
  matchId,
  match,
  job,
  demoVideoUrl,
  demoInsights,
}: MatchCinemaLayoutProps) {
  const videoRef = useRef<CinemaVideoHandle>(null);
  const [active, setActive] = useState<CinemaPanel | null>('clips');
  const [videoUrl, setVideoUrl] = useState<string | null>(demoVideoUrl || null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [coachTags, setCoachTags] = useState<TimelineEvent[]>([]);
  const [stitchedPath, setStitchedPath] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cvEvents: TimelineEvent[] = (job?.event_data?.events || []).map((e: any) => ({
    ...e,
    source: 'cv' as const,
  }));

  const mergedEvents: TimelineEvent[] = [...cvEvents, ...coachTags].sort(
    (a, b) => a.time - b.time,
  );

  const playerMetrics = job?.player_metrics || null;
  const heatmaps = job?.heatmaps || null;
  const homePassNetwork = job?.event_data?.home_pass_network ?? null;
  const awayPassNetwork = job?.event_data?.away_pass_network ?? null;
  const handleSeek = (t: number) => videoRef.current?.seekTo(t);

  // Fetch coach tags once on mount
  useEffect(() => {
    if (!matchId || matchId === 'demo') return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('match_event_tags')
        .select('id, event_type, timestamp_ms, notes, tagged_by')
        .eq('match_id', matchId)
        .order('timestamp_ms', { ascending: true });
      if (cancelled || !data) return;
      setCoachTags(
        data.map((row: any) => ({
          id: row.id,
          time: row.timestamp_ms / 1000,
          type: row.event_type,
          source: 'coach' as const,
          notes: row.notes ?? undefined,
          tagged_by: row.tagged_by ?? undefined,
        })),
      );
    })();
    return () => { cancelled = true; };
  }, [matchId]);

  // Poll video_footage every 15s for stitched path
  const pollStitched = useCallback(async () => {
    if (!matchId || matchId === 'demo') return;
    const { data } = await supabase
      .from('video_footage')
      .select('stitched_path, processing_status')
      .eq('match_id', matchId)
      .eq('processing_status', 'stitched')
      .limit(1)
      .maybeSingle();
    if (data?.stitched_path) {
      setStitchedPath(data.stitched_path);
      return; // stop polling once we have it
    }
    pollTimerRef.current = setTimeout(pollStitched, 15_000);
  }, [matchId]);

  useEffect(() => {
    if (stitchedPath) return;
    pollStitched();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [pollStitched, stitchedPath]);

  return (
    <div className="dark bg-background text-foreground rounded-2xl overflow-hidden border border-border/40 shadow-2xl">
      <div className="relative w-full aspect-video bg-black">
        <CinemaVideoPlayer
          ref={videoRef}
          matchId={matchId}
          outputVideoPath={job?.output_video_path}
          stitchedVideoPath={stitchedPath}
          demoVideoUrl={demoVideoUrl}
          events={mergedEvents}
          onUrlReady={setVideoUrl}
          onTimeUpdate={setCurrentTime}
          onDurationChange={setDuration}
        />

        {/* Right-side icon rail */}
        <div className="absolute top-4 right-4 z-10 hidden md:block">
          <IconRail active={active} onSelect={setActive} />
        </div>
      </div>

      {/* Mobile rail below video */}
      <div className="md:hidden flex justify-center p-3 border-b border-border/40">
        <IconRail active={active} onSelect={setActive} />
      </div>

      {/* Veo-style customizable timeline strip */}
      <MatchTimelineStrip
        events={mergedEvents}
        duration={duration}
        currentTime={currentTime}
        onSeek={handleSeek}
      />

      {/* Slide-out panel */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out border-t border-border/40',
          active ? 'max-h-[640px]' : 'max-h-0',
        )}
      >
        <div className="h-[640px]">
          {active === 'clips' && (
            <ClipsPanel events={mergedEvents} videoUrl={videoUrl} onSeek={handleSeek} />
          )}
          {active === 'summary' && <SummaryPanel match={match} />}
          {active === 'analytics' && (
            <AnalyticsPanel matchId={matchId} job={job} demoInsights={demoInsights} />
          )}
          {active === 'spotlight' && (
            <PlayerSpotlightPanel
              matchId={matchId}
              events={mergedEvents}
              playerMetrics={playerMetrics}
              heatmaps={heatmaps}
              videoUrl={videoUrl}
              onSeek={handleSeek}
            />
          )}
          {active === 'network' && (
            <PassNetworkPanel
              homePassNetwork={homePassNetwork}
              awayPassNetwork={awayPassNetwork}
            />
          )}
          {active === 'team' && <TeamPanel matchId={matchId} job={job} />}
        </div>
      </div>
    </div>
  );
}
