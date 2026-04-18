import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CinemaVideoPlayer, type CinemaVideoHandle } from './CinemaVideoPlayer';
import { IconRail, type CinemaPanel } from './IconRail';
import { ClipsPanel } from './ClipsPanel';
import { SummaryPanel } from './SummaryPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { TeamPanel } from './TeamPanel';
import { PlayerSpotlightPanel } from './PlayerSpotlightPanel';
import { MatchTimelineStrip } from './MatchTimelineStrip';

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

  const events = job?.event_data?.events || [];
  const playerMetrics = job?.player_metrics || null;
  const handleSeek = (t: number) => videoRef.current?.seekTo(t);

  return (
    <div className="dark bg-background text-foreground rounded-2xl overflow-hidden border border-border/40 shadow-2xl">
      <div className="relative w-full aspect-video bg-black">
        <CinemaVideoPlayer
          ref={videoRef}
          matchId={matchId}
          outputVideoPath={job?.output_video_path}
          demoVideoUrl={demoVideoUrl}
          events={events}
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
        events={events}
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
            <ClipsPanel events={events} videoUrl={videoUrl} onSeek={handleSeek} />
          )}
          {active === 'summary' && <SummaryPanel match={match} />}
          {active === 'analytics' && (
            <AnalyticsPanel matchId={matchId} job={job} demoInsights={demoInsights} />
          )}
          {active === 'spotlight' && (
            <PlayerSpotlightPanel
              matchId={matchId}
              events={events}
              playerMetrics={playerMetrics}
              videoUrl={videoUrl}
              onSeek={handleSeek}
            />
          )}
          {active === 'team' && <TeamPanel matchId={matchId} job={job} />}
        </div>
      </div>
    </div>
  );
}
