import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Circle, Square, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type CameraStatus = 'disconnected' | 'ready' | 'recording' | 'stopped' | 'error';

interface CameraState {
  status: CameraStatus;
  error?: string;
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Notify parent of status changes
  useEffect(() => {
    onCameraStatusChange?.(leftCamera.status, rightCamera.status);
  }, [leftCamera.status, rightCamera.status, onCameraStatusChange]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const channel = supabase.channel(`recording-${matchId}`);

    channel
      .on('broadcast', { event: 'recording' }, ({ payload }) => {
        if (payload?.type === 'status') {
          const state: CameraState = {
            status: payload.status,
            error: payload.error,
          };
          if (payload.camera_side === 'left') setLeftCamera(state);
          if (payload.camera_side === 'right') setRightCamera(state);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleStart = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { type: 'command', command: 'start', timestamp: Date.now() },
    });
    setIsRecording(true);
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

  const statusBadge = (label: string, state: CameraState) => {
    const colorMap: Record<CameraStatus, string> = {
      disconnected: 'bg-muted text-muted-foreground',
      ready: 'bg-emerald-100 text-emerald-800',
      recording: 'bg-red-100 text-red-800',
      stopped: 'bg-blue-100 text-blue-800',
      error: 'bg-destructive/10 text-destructive',
    };
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge className={colorMap[state.status]}>
          {state.status === 'recording' && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
          {state.status}
        </Badge>
        {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      </div>
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
        {/* Camera statuses */}
        <div className="flex flex-col gap-2">
          {statusBadge('Left Camera', leftCamera)}
          {statusBadge('Right Camera', rightCamera)}
        </div>

        {/* Recording timer */}
        {isRecording && (
          <div className="text-center">
            <span className="text-3xl font-mono font-bold text-red-600">{formatTime(elapsed)}</span>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-sm text-red-600 font-medium">Recording</span>
            </div>
          </div>
        )}

        {/* Controls */}
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

        {!bothReady && !isRecording && anyConnected && (
          <p className="text-xs text-muted-foreground text-center">
            Waiting for both cameras to connect before recording can start.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
