import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Rewind, FastForward,
  Volume2, VolumeX, Maximize, Minimize, Gauge, Settings, MousePointerClick,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

export interface ControlEvent {
  time: number;
  type: string;
  outcome?: string;
  player_track_id?: number;
  team?: string | null;
}

interface VeoVideoControlsProps {
  videoEl: HTMLVideoElement | null;
  containerEl: HTMLElement | null;
  events: ControlEvent[];
  currentTime: number;
  duration: number;
  className?: string;
}

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
  possession_change: 'Possession change',
  other: 'Event',
};
const eventKey = (e: ControlEvent) => (e.outcome === 'goal' ? 'goal' : e.type || 'other');

const formatTime = (t: number) => {
  if (!isFinite(t) || t < 0) return '00:00';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function VeoVideoControls({
  videoEl, containerEl, events, currentTime, duration, className,
}: VeoVideoControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Sync state from video element
  useEffect(() => {
    if (!videoEl) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVol = () => { setMuted(videoEl.muted); setVolume(videoEl.volume); };
    const onRate = () => setSpeed(videoEl.playbackRate);
    setPlaying(!videoEl.paused);
    setMuted(videoEl.muted);
    setVolume(videoEl.volume);
    setSpeed(videoEl.playbackRate);
    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('volumechange', onVol);
    videoEl.addEventListener('ratechange', onRate);
    return () => {
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
      videoEl.removeEventListener('volumechange', onVol);
      videoEl.removeEventListener('ratechange', onRate);
    };
  }, [videoEl]);

  // Fullscreen tracking
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Keyboard shortcuts (only when controls mounted & video focused area)
  useEffect(() => {
    if (!videoEl) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': e.preventDefault(); skip(-5); break;
        case 'ArrowRight': e.preventDefault(); skip(5); break;
        case 'j': e.preventDefault(); skip(-10); break;
        case 'l': e.preventDefault(); skip(10); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl]);

  if (!videoEl) return null;

  const togglePlay = () => {
    if (videoEl.paused) videoEl.play().catch(() => {});
    else videoEl.pause();
  };
  const skip = (delta: number) => {
    videoEl.currentTime = Math.max(0, Math.min(duration || videoEl.duration || 0, videoEl.currentTime + delta));
  };
  const seekTo = (t: number) => { videoEl.currentTime = Math.max(0, Math.min(duration || videoEl.duration || 0, t)); };
  const goToAdjacentEvent = (dir: 1 | -1) => {
    if (!events?.length) return;
    const sorted = [...events].sort((a, b) => a.time - b.time);
    const cur = videoEl.currentTime;
    const next = dir === 1
      ? sorted.find((e) => e.time > cur + 0.25)
      : [...sorted].reverse().find((e) => e.time < cur - 0.25);
    if (next) seekTo(next.time);
  };
  const toggleMute = () => { videoEl.muted = !videoEl.muted; };
  const setVol = (v: number) => { videoEl.volume = v; if (v > 0) videoEl.muted = false; };
  const setRate = (r: number) => { videoEl.playbackRate = r; };
  const toggleFullscreen = async () => {
    const target = containerEl || videoEl;
    if (!document.fullscreenElement) await target.requestFullscreen?.().catch(() => {});
    else await document.exitFullscreen?.().catch(() => {});
  };

  const safeDuration = duration > 0 ? duration : (videoEl.duration || 0);
  const progressPct = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

  const handleBarMove = (e: React.MouseEvent) => {
    if (!barRef.current || !safeDuration) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * safeDuration);
  };
  const handleBarClick = (e: React.MouseEvent) => {
    if (!barRef.current || !safeDuration) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * safeDuration);
  };

  const eventsWithPos = safeDuration > 0
    ? events.filter((e) => e.time >= 0 && e.time <= safeDuration)
    : [];

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1 px-3 pt-8 pb-2',
          'bg-gradient-to-t from-black/85 via-black/60 to-transparent text-white',
          'opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity',
          playing ? '' : 'opacity-100',
          className,
        )}
      >
        {/* Event dots row + progress bar */}
        <div
          ref={barRef}
          className="relative h-6 cursor-pointer group/bar"
          onMouseMove={handleBarMove}
          onMouseLeave={() => setHoverTime(null)}
          onClick={handleBarClick}
        >
          {/* Event dots above the bar */}
          <div className="absolute inset-x-0 top-0 h-3 pointer-events-none">
            {eventsWithPos.map((ev, i) => {
              const left = (ev.time / safeDuration) * 100;
              const color = TYPE_COLORS[eventKey(ev)] || TYPE_COLORS.other;
              const label = TYPE_LABEL[eventKey(ev)] || ev.type;
              return (
                <Tooltip key={`${ev.time}-${i}`}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); seekTo(ev.time); }}
                      className={cn(
                        'pointer-events-auto absolute top-0 -translate-x-1/2',
                        'w-2.5 h-2.5 rounded-full ring-2 ring-black/40 hover:scale-150 transition-transform',
                        ev.outcome === 'goal' && 'ring-amber-300/80 shadow-[0_0_8px_hsl(48_95%_55%/0.7)]',
                      )}
                      style={{ left: `${left}%`, background: color }}
                      aria-label={`${label} at ${formatTime(ev.time)}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="font-medium">{label}</div>
                    <div className="font-mono text-muted-foreground">{formatTime(ev.time)}</div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="absolute inset-x-0 bottom-1 h-1 bg-white/25 rounded-full overflow-hidden group-hover/bar:h-1.5 transition-all">
            <div
              className="h-full bg-primary"
              style={{ width: `${progressPct}%` }}
            />
            {hoverTime !== null && (
              <div
                className="absolute top-0 h-full bg-white/30"
                style={{ width: `${(hoverTime / safeDuration) * 100}%` }}
              />
            )}
          </div>

          {/* Hover time tooltip */}
          {hoverTime !== null && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/90 text-[10px] font-mono"
              style={{ left: `${(hoverTime / safeDuration) * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Playhead handle */}
          <div
            className="absolute bottom-0 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `${progressPct}%` }}
          />
        </div>

        {/* Control row */}
        <div className="flex items-center gap-1 text-white">
          {/* Left cluster */}
          <CtrlBtn label="Play / Pause (k)" onClick={togglePlay}>
            {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </CtrlBtn>
          <CtrlBtn label="Previous event" onClick={() => goToAdjacentEvent(-1)}>
            <SkipBack className="h-4 w-4" fill="currentColor" />
          </CtrlBtn>
          <CtrlBtn label="Back 5s (←)" onClick={() => skip(-5)}>
            <Rewind className="h-4 w-4" />
          </CtrlBtn>
          <CtrlBtn label="Forward 5s (→)" onClick={() => skip(5)}>
            <FastForward className="h-4 w-4" />
          </CtrlBtn>
          <CtrlBtn label="Next event" onClick={() => goToAdjacentEvent(1)}>
            <SkipForward className="h-4 w-4" fill="currentColor" />
          </CtrlBtn>

          {/* Time */}
          <div className="ml-2 text-xs font-mono tabular-nums">
            {formatTime(currentTime)} <span className="text-white/50">/ {formatTime(safeDuration)}</span>
          </div>

          <div className="flex-1" />

          {/* Right cluster */}
          <CtrlBtn
            label={interactive ? 'Disable interactive player' : 'Interactive player'}
            onClick={() => setInteractive((v) => !v)}
            active={interactive}
          >
            <MousePointerClick className="h-4 w-4" />
          </CtrlBtn>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white">
                    <Gauge className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Playback speed ({speed}x)</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-[120px]">
              <DropdownMenuLabel className="text-xs">Speed</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SPEEDS.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setRate(s)}
                  className={cn('text-sm', s === speed && 'font-semibold text-primary')}
                >
                  {s === 1 ? 'Normal' : `${s}x`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Settings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuLabel className="text-xs">Quality</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm">Auto</DropdownMenuItem>
              <DropdownMenuItem className="text-sm">1080p</DropdownMenuItem>
              <DropdownMenuItem className="text-sm">720p</DropdownMenuItem>
              <DropdownMenuItem className="text-sm">480p</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Volume */}
          <div className="flex items-center gap-1 group/vol">
            <CtrlBtn label={muted ? 'Unmute (m)' : 'Mute (m)'} onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </CtrlBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(parseFloat(e.target.value))}
              className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-primary cursor-pointer"
              aria-label="Volume"
            />
          </div>

          <CtrlBtn label="Fullscreen (f)" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </CtrlBtn>
        </div>
      </div>
    </TooltipProvider>
  );
}

function CtrlBtn({
  label, onClick, children, active,
}: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClick}
          className={cn(
            'h-8 w-8 text-white hover:bg-white/15 hover:text-white',
            active && 'bg-white/20 text-primary-foreground',
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}
