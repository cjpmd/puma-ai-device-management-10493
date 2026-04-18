import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { VeoVideoControls, type ControlEvent } from './VeoVideoControls';

export interface CinemaVideoHandle {
  seekTo: (sec: number) => void;
  getUrl: () => string | null;
}

interface CinemaVideoPlayerProps {
  matchId: string;
  outputVideoPath: string | null;
  demoVideoUrl?: string;
  events?: ControlEvent[];
  onUrlReady?: (url: string) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export const CinemaVideoPlayer = forwardRef<CinemaVideoHandle, CinemaVideoPlayerProps>(
  ({ matchId, outputVideoPath, demoVideoUrl, events = [], onUrlReady, onTimeUpdate, onDurationChange }, ref) => {
    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(demoVideoUrl || null);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
      if (demoVideoUrl) {
        setVideoUrl(demoVideoUrl);
        onUrlReady?.(demoVideoUrl);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [demoVideoUrl]);

    useImperativeHandle(ref, () => ({
      seekTo: (sec: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = sec;
          videoRef.current.play().catch(() => {});
        }
      },
      getUrl: () => videoUrl,
    }), [videoUrl]);

    const loadVideo = async () => {
      if (!outputVideoPath) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-output-url', {
          body: { match_id: matchId, file_type: 'video' },
        });
        if (error) throw new Error(error.message);
        if (!data?.url) throw new Error('No URL returned');
        setVideoUrl(data.url);
        onUrlReady?.(data.url);
      } catch (err: any) {
        toast({ title: 'Failed to load video', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    if (!videoUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Button onClick={loadVideo} disabled={loading} size="lg" className="rounded-full">
            {loading ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading…</>
            ) : (
              <><Play className="h-5 w-5 mr-2" fill="currentColor" /> Load Match Video</>
            )}
          </Button>
        </div>
      );
    }

    return (
      <div ref={containerRef} className="absolute inset-0 group/player bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) v.play().catch(() => {}); else v.pause();
          }}
          onTimeUpdate={(e) => {
            const t = (e.target as HTMLVideoElement).currentTime;
            setCurrentTime(t);
            onTimeUpdate?.(t);
          }}
          onLoadedMetadata={(e) => {
            const d = (e.target as HTMLVideoElement).duration;
            setDuration(d);
            onDurationChange?.(d);
          }}
          onDurationChange={(e) => {
            const d = (e.target as HTMLVideoElement).duration;
            setDuration(d);
            onDurationChange?.(d);
          }}
          className="w-full h-full object-contain bg-black"
        />
        <VeoVideoControls
          videoEl={videoRef.current}
          containerEl={containerRef.current}
          events={events}
          currentTime={currentTime}
          duration={duration}
        />
      </div>
    );
  },
);
CinemaVideoPlayer.displayName = 'CinemaVideoPlayer';
