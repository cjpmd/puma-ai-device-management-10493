import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Circle, Square, Radio, Battery, BatteryCharging, ImageOff, Wifi, HardDrive, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type CameraStatus = 'disconnected' | 'ready' | 'recording' | 'stopped' | 'error' | 'cancelled';

interface CameraCapabilities {
  resolution: string;
  fps: number;
  zoom: number;
  ultraWide: boolean;
  native: boolean;
}

interface CameraState {
  status: CameraStatus;
  error?: string;
  previewFrame?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  storageFreeBytes?: number;
  storageTotalBytes?: number;
  lastPreviewAt?: number;
  capabilities?: CameraCapabilities;
}

interface RecordingControlsProps {
  matchId: string;
  onCameraStatusChange?: (left: CameraStatus, right: CameraStatus) => void;
}

export function RecordingControls({ matchId, onCameraStatusChange }: RecordingControlsProps) {
  const [leftCamera, setLeftCamera] = useState<CameraState>({ status: 'disconnected' });
  const [rightCamera, setRightCamera] = useState<CameraState>({ status: 'disconnected' });
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [livePreview, setLivePreview] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Notify parent
  useEffect(() => {
    onCameraStatusChange?.(leftCamera.status, rightCamera.status);
  }, [leftCamera.status, rightCamera.status, onCameraStatusChange]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const channel = supabase.channel(`recording-${matchId}`);

    channel
      .on('broadcast', { event: 'recording' }, ({ payload }) => {
        if (!payload) return;
        const side = payload.camera_side;
        const update = side === 'left' ? setLeftCamera : side === 'right' ? setRightCamera : null;
        if (!update) return;

        if (payload.type === 'status') {
          // Treat 'cancelled' as a transition back to disconnected, but remember it briefly via status
          const next: CameraStatus = payload.status === 'cancelled' ? 'disconnected' : payload.status;
          update((prev) => ({ ...prev, status: next, error: payload.error }));
        } else if (payload.type === 'preview') {
          update((prev) => ({
            ...prev,
            previewFrame: `data:image/jpeg;base64,${payload.frame}`,
            lastPreviewAt: Date.now(),
          }));
        } else if (payload.type === 'telemetry') {
          update((prev) => ({ ...prev, batteryLevel: payload.batteryLevel, isCharging: payload.isCharging }));
        } else if (payload.type === 'storage') {
          update((prev) => ({
            ...prev,
            storageFreeBytes: payload.freeBytes,
            storageTotalBytes: payload.totalBytes,
          }));
        } else if (payload.type === 'capabilities') {
          update((prev) => ({
            ...prev,
            capabilities: {
              resolution: payload.resolution,
              fps: payload.fps,
              zoom: payload.zoom,
              ultraWide: payload.ultraWide,
              native: payload.native,
            },
          }));
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const handleStart = useCallback(() => {
    const startAt = Date.now() + 3000;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { type: 'command', command: 'start', startAt },
    });

    let remaining = 3;
    setCountdown(remaining);
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown(null);
        setIsRecording(true);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, []);

  const handleStop = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { type: 'command', command: 'stop' },
    });
    setIsRecording(false);
  }, []);

  // Disconnect a single donor camera (master rejects)
  const handleDisconnect = useCallback((side: 'left' | 'right') => {
    if (!confirm(`Disconnect ${side === 'left' ? 'Left' : 'Right'} camera? They'll need to scan a new QR.`)) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { type: 'command', command: 'disconnect', camera_side: side },
    });
    // Reset locally so the panel shows disconnected immediately
    if (side === 'left') setLeftCamera({ status: 'disconnected' });
    else setRightCamera({ status: 'disconnected' });
  }, []);

  const toggleLivePreview = useCallback(() => {
    const newState = !livePreview;
    setLivePreview(newState);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { type: 'command', command: newState ? 'live_preview_on' : 'live_preview_off' },
    });
  }, [livePreview]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatBytes = (b: number) => {
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  const bothReady = leftCamera.status === 'ready' && rightCamera.status === 'ready';
  const anyConnected = leftCamera.status !== 'disconnected' || rightCamera.status !== 'disconnected';

  // Camera preview panel
  const CameraPanel = ({ label, camera, side }: { label: string; camera: CameraState; side: 'left' | 'right' }) => {
    const batteryPercent = camera.batteryLevel != null && camera.batteryLevel >= 0
      ? Math.round(camera.batteryLevel * 100)
      : null;

    const storagePercent =
      camera.storageFreeBytes != null && camera.storageTotalBytes
        ? Math.round((camera.storageFreeBytes / camera.storageTotalBytes) * 100)
        : null;
    const lowStorage = camera.storageFreeBytes != null && camera.storageFreeBytes < 2 * 1024 ** 3; // <2GB

    const previewStale = camera.lastPreviewAt && Date.now() - camera.lastPreviewAt > 8000;
    const isConnected = camera.status !== 'disconnected';

    return (
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-1">
            <StatusBadge status={camera.status} />
            {isConnected && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDisconnect(side)}
                aria-label={`Disconnect ${label}`}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Preview thumbnail */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
          {camera.previewFrame ? (
            <>
              <img src={camera.previewFrame} alt={`${label} preview`} className="w-full h-full object-cover" />
              {livePreview && !previewStale && (
                <Badge className="absolute top-2 right-2 bg-emerald-600 text-white text-xs">
                  <Circle className="h-2 w-2 fill-current mr-1 animate-pulse" /> LIVE
                </Badge>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {camera.status === 'disconnected' ? (
                <div className="text-center text-muted-foreground">
                  <ImageOff className="h-8 w-8 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">Not connected</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Wifi className="h-8 w-8 mx-auto mb-1 opacity-50 animate-pulse" />
                  <p className="text-xs">Waiting for preview...</p>
                </div>
              )}
            </div>
          )}
          {camera.status === 'recording' && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-red-600 text-white text-xs">
                <Circle className="h-2 w-2 fill-current mr-1 animate-pulse" /> REC
              </Badge>
            </div>
          )}
        </div>

        {/* Capability badges — resolution / fps / lens */}
        {camera.capabilities && (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              {camera.capabilities.resolution.includes('3840') || camera.capabilities.resolution.includes('2160')
                ? '4K'
                : camera.capabilities.resolution}
            </Badge>
            {camera.capabilities.fps > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                {camera.capabilities.fps}fps
              </Badge>
            )}
            {camera.capabilities.ultraWide ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 h-5">
                ✓ Ultra-wide 0.5×
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 ${
                  camera.capabilities.zoom > 1 ? 'text-orange-600 border-orange-300' : ''
                }`}
                title={camera.capabilities.zoom > 1 ? 'Narrow lens — less pitch coverage' : undefined}
              >
                {camera.capabilities.zoom}× lens
              </Badge>
            )}
          </div>
        )}

        {/* Battery */}
        {batteryPercent !== null && (
          <div className="flex items-center gap-2">
            {camera.isCharging ? (
              <BatteryCharging className="h-4 w-4 text-emerald-600" />
            ) : (
              <Battery className={`h-4 w-4 ${batteryPercent < 20 ? 'text-red-500' : 'text-muted-foreground'}`} />
            )}
            <Progress value={batteryPercent} className="h-2 flex-1" />
            <span className={`text-xs font-mono ${batteryPercent < 20 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
              {batteryPercent}%
            </span>
          </div>
        )}

        {/* Storage */}
        {storagePercent !== null && camera.storageFreeBytes != null && (
          <div className="flex items-center gap-2">
            <HardDrive className={`h-4 w-4 ${lowStorage ? 'text-red-500' : 'text-muted-foreground'}`} />
            <Progress value={storagePercent} className="h-2 flex-1" />
            <span className={`text-xs font-mono ${lowStorage ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
              {formatBytes(camera.storageFreeBytes)}
            </span>
          </div>
        )}

        {camera.error && <p className="text-xs text-destructive">{camera.error}</p>}
      </div>
    );
  };

  const StatusBadge = ({ status }: { status: CameraStatus }) => {
    const config: Record<CameraStatus, { className: string; label: string }> = {
      disconnected: { className: 'bg-muted text-muted-foreground', label: 'Offline' },
      ready: { className: 'bg-emerald-100 text-emerald-800', label: 'Ready' },
      recording: { className: 'bg-red-100 text-red-800', label: 'Recording' },
      stopped: { className: 'bg-blue-100 text-blue-800', label: 'Stopped' },
      error: { className: 'bg-destructive/10 text-destructive', label: 'Error' },
      cancelled: { className: 'bg-muted text-muted-foreground', label: 'Cancelled' },
    };
    const c = config[status];
    return (
      <Badge className={c.className}>
        {status === 'recording' && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
        {c.label}
      </Badge>
    );
  };

  if (!anyConnected) return null;

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Recording Control
          </span>
          <Button
            size="sm"
            variant={livePreview ? 'default' : 'outline'}
            onClick={toggleLivePreview}
            disabled={!anyConnected}
            className="h-8"
          >
            {livePreview ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
            Live View
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-3 sm:px-6">
        {/* Camera preview panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <CameraPanel label="Left Camera" camera={leftCamera} side="left" />
          <CameraPanel label="Right Camera" camera={rightCamera} side="right" />
        </div>

        {/* Live preview note */}
        {livePreview && (
          <p className="text-xs text-muted-foreground text-center">
            Live preview ~2 fps. Uses extra battery and bandwidth on the capture phones.
          </p>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="text-center py-4">
            <span className="text-6xl font-bold text-red-600 animate-pulse">{countdown}</span>
            <p className="text-sm text-muted-foreground mt-2">Starting in...</p>
          </div>
        )}

        {/* Recording timer */}
        {isRecording && countdown === null && (
          <div className="text-center">
            <span className="text-3xl font-mono font-bold text-red-600">{formatTime(elapsed)}</span>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-sm text-red-600 font-medium">Recording</span>
            </div>
          </div>
        )}

        {/* Controls — sticky on mobile so always reachable */}
        {countdown === null && (
          <div className="sticky bottom-0 -mx-3 sm:mx-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-3 sm:px-0 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2 border-t sm:border-0">
            {!isRecording ? (
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-red-600 hover:bg-red-700 text-white"
                disabled={!bothReady}
                onClick={handleStart}
              >
                <Circle className="h-5 w-5 mr-2 fill-current" />
                Start Recording
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 text-lg border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleStop}
              >
                <Square className="h-5 w-5 mr-2 fill-current" />
                Stop Recording
              </Button>
            )}
          </div>
        )}

        {!bothReady && !isRecording && anyConnected && countdown === null && (
          <p className="text-xs text-muted-foreground text-center">
            Waiting for both cameras to connect before recording can start.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
