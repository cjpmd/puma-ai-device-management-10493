import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, Play, Scissors } from 'lucide-react';
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
  stitchedVideoPath?: string | null;
  demoVideoUrl?: string;
  events?: ControlEvent[];
  onUrlReady?: (url: string) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export const CinemaVideoPlayer = forwardRef<CinemaVideoHandle, CinemaVideoPlayerProps>(
  (
    {
      matchId,
      outputVideoPath,
      stitchedVideoPath,
      demoVideoUrl,
      events = [],
      onUrlReady,
      onTimeUpdate,
      onDurationChange,
    },
    ref,
  ) => {
    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(demoVideoUrl || null);
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [clipIn, setClipIn] = useState<number | null>(null);
    const [clipOut, setClipOut] = useState<number | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      if (demoVideoUrl) {
        setVideoUrl(demoVideoUrl);
        onUrlReady?.(demoVideoUrl);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [demoVideoUrl]);

    // When stitched path becomes available, prefer it over the processed output
    useEffect(() => {
      if (!stitchedVideoPath) return;
      let cancelled = false;
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-output-url', {
            body: { match_id: matchId, path: stitchedVideoPath },
          });
          if (cancelled || error || !data?.url) return;
          setVideoUrl(data.url);
          onUrlReady?.(data.url);
        } catch {
          // ignore — existing video keeps playing
        }
      })();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stitchedVideoPath]);

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (sec: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = sec;
            videoRef.current.play().catch(() => {});
          }
        },
        getUrl: () => videoUrl,
      }),
      [videoUrl],
    );

    const loadVideo = async () => {
      // Prefer stitched path when available
      const path = stitchedVideoPath || outputVideoPath;
      if (!path) return;
      setLoading(true);
      try {
        // Always re-sign through the edge function so we get a fresh
        // presigned URL — previously stored URLs may have expired.
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

    // Auto-load when we have a stored path but no URL yet.
    useEffect(() => {
      if (videoUrl) return;
      if (loading) return;
      if (!outputVideoPath && !stitchedVideoPath) return;
      loadVideo();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outputVideoPath, stitchedVideoPath, videoUrl]);

    const handleExtractClip = async () => {
      if (clipIn === null || clipOut === null) return;
      if (clipOut <= clipIn) {
        toast({ title: 'Mark Out must be after Mark In', variant: 'destructive' });
        return;
      }
      setExtracting(true);
      try {
        const { error } = await supabase.functions.invoke('extract-clip', {
          body: {
            match_id: matchId,
            start_sec: clipIn,
            end_sec: clipOut,
          },
        });
        if (error) throw new Error(error.message);
        toast({ title: 'Clip queued', description: `${formatTime(clipIn)} → ${formatTime(clipOut)}` });
        setClipIn(null);
        setClipOut(null);
      } catch (err: any) {
        toast({ title: 'Clip extraction failed', description: err.message, variant: 'destructive' });
      } finally {
        setExtracting(false);
      }
    };

    if (!videoUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Button
            onClick={loadVideo}
            disabled={loading || (!outputVideoPath && !stitchedVideoPath)}
            size="lg"
            className="rounded-full"
          >
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
          playsInline
          preload="auto"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) {
              v.play().catch((err) => {
                setMediaError(err?.message || 'Playback failed');
                toast({ title: 'Playback failed', description: err?.message || String(err), variant: 'destructive' });
              });
            } else {
              v.pause();
            }
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
            setReady(true);
          }}
          onCanPlay={() => setReady(true)}
          onError={(e) => {
            const v = e.currentTarget as HTMLVideoElement;
            const code = v.error?.code;
            const map: Record<number, string> = {
              1: 'Playback aborted',
              2: 'Network error while loading video',
              3: 'Video decoding failed',
              4: 'Video source not supported by this browser',
            };
            const msg = code ? map[code] || `Media error ${code}` : 'Unknown media error';
            setMediaError(msg);
            toast({ title: 'Video error', description: msg, variant: 'destructive' });
          }}
          onDurationChange={(e) => {
            const d = (e.target as HTMLVideoElement).duration;
            setDuration(d);
            onDurationChange?.(d);
          }}
          className="w-full h-full object-contain bg-black"
        />
        {/* Stop clicks inside the controls from bubbling to the <video>
            onClick handler, which would immediately toggle play back off. */}
        <div onClick={(e) => e.stopPropagation()}>
          <VeoVideoControls
            videoEl={videoRef.current}
            containerEl={containerRef.current}
            events={events}
            currentTime={currentTime}
            duration={duration}
            disabled={!ready}
          />
        </div>

        {mediaError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-destructive/90 text-destructive-foreground text-xs px-3 py-1.5 rounded-full shadow">
            {mediaError}
          </div>
        )}

        {/* Clip extraction toolbar — visible on hover */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 opacity-0 group-hover/player:opacity-100 transition-opacity flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-full px-3 py-1.5">
          <Button
            size="sm"
            variant={clipIn !== null ? 'default' : 'ghost'}
            className="h-7 text-xs rounded-full"
            onClick={() => setClipIn(currentTime)}
          >
            <Scissors className="h-3.5 w-3.5 mr-1" />
            {clipIn !== null ? `In: ${formatTime(clipIn)}` : 'Mark In'}
          </Button>
          <Button
            size="sm"
            variant={clipOut !== null ? 'default' : 'ghost'}
            className="h-7 text-xs rounded-full"
            onClick={() => setClipOut(currentTime)}
            disabled={clipIn === null}
          >
            {clipOut !== null ? `Out: ${formatTime(clipOut)}` : 'Mark Out'}
          </Button>
          {clipIn !== null && clipOut !== null && (
            <Button
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={handleExtractClip}
              disabled={extracting}
            >
              {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create Clip'}
            </Button>
          )}
          {(clipIn !== null || clipOut !== null) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs rounded-full text-muted-foreground"
              onClick={() => { setClipIn(null); setClipOut(null); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    );
  },
);
CinemaVideoPlayer.displayName = 'CinemaVideoPlayer';

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
