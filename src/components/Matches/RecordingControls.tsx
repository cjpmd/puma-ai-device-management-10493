import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Circle, Square, Radio, Battery, BatteryCharging, ImageOff, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type CameraStatus = 'disconnected' | 'ready' | 'recording' | 'stopped' | 'error';

interface CameraState {
  status: CameraStatus;
  error?: string;
  previewFrame?: string;
  batteryLevel?: number;
  isCharging?: boolean;
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
          update((prev) => ({ ...prev, status: payload.status, error: payload.error }));
        } else if (payload.type === 'preview') {
          update((prev) => ({ ...prev, previewFrame: `data:image/jpeg;base64,${payload.frame}` }));
        } else if (payload.type === 'telemetry') {
          update((prev) => ({ ...prev, batteryLevel: payload.batteryLevel, isCharging: payload.isCharging }));
        } else if (payload.type === 'pong') {
          // Could use for offset calculation if needed
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

    // Show countdown on control phone too
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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const bothReady = leftCamera.status === 'ready' && rightCamera.status === 'ready';
  const anyConnected = leftCamera.status !== 'disconnected' || rightCamera.status !== 'disconnected';

  // Camera preview panel
  const CameraPanel = ({ label, camera }: { label: string; camera: CameraState }) => {
    const batteryPercent = camera.batteryLevel != null ? Math.round(camera.batteryLevel * 100) : null;

    return (
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <StatusBadge status={camera.status} />
        </div>

        {/* Preview thumbnail */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
          {camera.previewFrame ? (
            <img src={camera.previewFrame} alt={`${label} preview`} className="w-full h-full object-cover" />
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
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4" />
          Recording Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Camera preview panels */}
        <div className="grid grid-cols-2 gap-4">
          <CameraPanel label="Left Camera" camera={leftCamera} />
          <CameraPanel label="Right Camera" camera={rightCamera} />
        </div>

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

        {/* Controls */}
        {countdown === null && (
          <>
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
          </>
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
