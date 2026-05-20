import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Circle, Square, Radio, Battery, BatteryCharging, ImageOff, Wifi, HardDrive,
  Eye, EyeOff, X, AlertTriangle, Tag,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type CameraStatus = 'disconnected' | 'ready' | 'recording' | 'stopped' | 'error' | 'cancelled';

type EventTagType =
  | 'goal' | 'yellow_card' | 'red_card' | 'substitution'
  | 'key_moment' | 'foul' | 'corner' | 'penalty';

interface EventTag {
  id?: string;
  eventType: EventTagType;
  timestampMs: number;
}

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

const EVENT_BUTTONS: Array<{ type: EventTagType; label: string; emoji: string; bg: string }> = [
  { type: 'goal',         label: 'Goal',   emoji: '⚽', bg: 'bg-emerald-600 hover:bg-emerald-700' },
  { type: 'yellow_card',  label: 'Yellow', emoji: '🟡', bg: 'bg-yellow-500 hover:bg-yellow-600' },
  { type: 'red_card',     label: 'Red',    emoji: '🔴', bg: 'bg-red-600 hover:bg-red-700' },
  { type: 'substitution', label: 'Sub',    emoji: '🔄', bg: 'bg-blue-600 hover:bg-blue-700' },
  { type: 'key_moment',   label: 'Key',    emoji: '📌', bg: 'bg-purple-600 hover:bg-purple-700' },
];

export function RecordingControls({ matchId, onCameraStatusChange }: RecordingControlsProps) {
  const [leftCamera, setLeftCamera] = useState<CameraState>({ status: 'disconnected' });
  const [rightCamera, setRightCamera] = useState<CameraState>({ status: 'disconnected' });
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [livePreview, setLivePreview] = useState(false);
  const [matchTitle, setMatchTitle] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventTags, setEventTags] = useState<EventTag[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const elapsedRef = useRef(0); // always-current elapsed for use inside async handlers

  // Keep elapsedRef in sync
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // Notify parent
  useEffect(() => {
    onCameraStatusChange?.(leftCamera.status, rightCamera.status);
  }, [leftCamera.status, rightCamera.status, onCameraStatusChange]);

  // Fetch match title
  useEffect(() => {
    supabase.from('matches').select('title').eq('id', matchId).single()
      .then(({ data }) => { if (data?.title) setMatchTitle(data.title); });
  }, [matchId]);

  // Subscribe to Supabase Realtime broadcast channel
  useEffect(() => {
    const channel = supabase.channel(`recording-${matchId}`);

    channel
      .on('broadcast', { event: 'recording' }, ({ payload }) => {
        if (!payload) return;

        // Respond to donor pings for latency calibration — must be handled
        // before the camera_side guard below since we need to echo immediately.
        if (payload.type === 'ping') {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'recording',
            payload: { type: 'pong', camera_side: payload.camera_side, sentAt: payload.sentAt },
          });
          return;
        }

        const side = payload.camera_side as 'left' | 'right' | undefined;
        const update = side === 'left' ? setLeftCamera : side === 'right' ? setRightCamera : null;
        if (!update) return;

        if (payload.type === 'status') {
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
        } else if (payload.type === 'recording_saved') {
          // Donor finished recording and saved locally; awaiting upload
          update((prev) => ({ ...prev, status: 'stopped' }));
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

  const handleStart = useCallback(async () => {
    const startAt = Date.now() + 3000;

    // Create a recording_session record; non-blocking — recording proceeds even if this fails
    try {
      const { data: session } = await (supabase as any)
        .from('recording_sessions')
        .insert({ match_id: matchId, status: 'active', started_at: new Date().toISOString() })
        .select('id')
        .single();
      if (session?.id) setSessionId(String(session.id));
    } catch {}

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
  }, [matchId]);

  const handleStop = useCallback(async () => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { type: 'command', command: 'stop' },
    });
    setIsRecording(false);

    // Close the recording session
    if (sessionId) {
      const dur = elapsedRef.current;
      try {
        await (supabase as any).from('recording_sessions').update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: dur,
        }).eq('id', sessionId);
      } catch {}
      setSessionId(null);
    }
  }, [sessionId]);

  const handleDisconnect = useCallback((side: 'left' | 'right') => {
    if (!confirm(`Disconnect ${side === 'left' ? 'Left' : 'Right'} camera? They'll need to scan a new QR.`)) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'recording',
      payload: { type: 'command', command: 'disconnect', camera_side: side },
    });
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

  // Tag an in-match event at the current recording timestamp
  const handleTagEvent = useCallback(async (eventType: EventTagType) => {
    const timestampMs = elapsedRef.current * 1000;
    const optimisticTag: EventTag = { eventType, timestampMs };
    setEventTags((prev) => [...prev, optimisticTag]);

    try {
      const { data } = await (supabase as any).from('match_event_tags').insert({
        match_id: matchId,
        session_id: sessionId,
        event_type: eventType,
        timestamp_ms: timestampMs,
      }).select('id').single();
      if (data?.id) {
        setEventTags((prev) =>
          prev.map((t) =>
            t === optimisticTag ? { ...t, id: String(data.id) } : t
          )
        );
      }
    } catch {}
  }, [matchId, sessionId]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatBytes = (b: number) => {
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  // Pre-recording safety flags
  const batteryPct = (cam: CameraState) =>
    cam.batteryLevel != null && cam.batteryLevel >= 0 ? Math.round(cam.batteryLevel * 100) : null;
  const lowBattery = (cam: CameraState) => {
    const p = batteryPct(cam);
    return p !== null && p < 15 && !cam.isCharging;
  };
  const lowStorage = (cam: CameraState) =>
    cam.storageFreeBytes != null && cam.storageFreeBytes < 2 * 1024 ** 3;

  const hasPreRecordingWarnings =
    (leftCamera.status !== 'disconnected' && (lowBattery(leftCamera) || lowStorage(leftCamera))) ||
    (rightCamera.status !== 'disconnected' && (lowBattery(rightCamera) || lowStorage(rightCamera)));

  const bothReady = leftCamera.status === 'ready' && rightCamera.status === 'ready';
  const anyConnected = leftCamera.status !== 'disconnected' || rightCamera.status !== 'disconnected';
  const canStart = bothReady;

  // Camera preview panel
  const CameraPanel = ({
    label,
    camera,
    side,
  }: {
    label: string;
    camera: CameraState;
    side: 'left' | 'right';
  }) => {
    const bPct = batteryPct(camera);
    const storagePercent =
      camera.storageFreeBytes != null && camera.storageTotalBytes
        ? Math.round((camera.storageFreeBytes / camera.storageTotalBytes) * 100)
        : null;
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

        {/* Capability badges */}
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
                className={`text-[10px] px-1.5 py-0 h-5 ${camera.capabilities.zoom > 1 ? 'text-orange-600 border-orange-300' : ''}`}
              >
                {camera.capabilities.zoom}× lens
              </Badge>
            )}
          </div>
        )}

        {/* Battery */}
        {bPct !== null && (
          <div className="flex items-center gap-2">
            {camera.isCharging ? (
              <BatteryCharging className="h-4 w-4 text-emerald-600" />
            ) : (
              <Battery className={`h-4 w-4 ${bPct < 15 ? 'text-red-500' : bPct < 30 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            )}
            <Progress value={bPct} className="h-2 flex-1" />
            <span className={`text-xs font-mono ${bPct < 15 && !camera.isCharging ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
              {bPct}%
            </span>
          </div>
        )}

        {/* Storage */}
        {storagePercent !== null && camera.storageFreeBytes != null && (
          <div className="flex items-center gap-2">
            <HardDrive className={`h-4 w-4 ${lowStorage(camera) ? 'text-red-500' : 'text-muted-foreground'}`} />
            <Progress value={storagePercent} className="h-2 flex-1" />
            <span className={`text-xs font-mono ${lowStorage(camera) ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
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
      ready:        { className: 'bg-emerald-100 text-emerald-800', label: 'Ready' },
      recording:    { className: 'bg-red-100 text-red-800', label: 'Recording' },
      stopped:      { className: 'bg-blue-100 text-blue-800', label: 'Stopped' },
      error:        { className: 'bg-destructive/10 text-destructive', label: 'Error' },
      cancelled:    { className: 'bg-muted text-muted-foreground', label: 'Cancelled' },
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
            {matchTitle ? `${matchTitle} — Recording` : 'Recording Control'}
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

        {livePreview && (
          <p className="text-xs text-muted-foreground text-center">
            Live preview ~2 fps. Uses extra battery and bandwidth on the capture phones.
          </p>
        )}

        {/* Pre-recording warnings — shown before start, non-blocking */}
        {!isRecording && hasPreRecordingWarnings && (
          <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
            <div className="text-xs text-orange-800 space-y-0.5">
              {lowBattery(leftCamera) && <p>⚠️ Left camera battery critically low ({batteryPct(leftCamera)}%). Risk of recording failure.</p>}
              {lowBattery(rightCamera) && <p>⚠️ Right camera battery critically low ({batteryPct(rightCamera)}%). Risk of recording failure.</p>}
              {lowStorage(leftCamera) && <p>⚠️ Left camera storage below 2 GB. May not complete a full match.</p>}
              {lowStorage(rightCamera) && <p>⚠️ Right camera storage below 2 GB. May not complete a full match.</p>}
            </div>
          </div>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="text-center py-4">
            <span className="text-6xl font-bold text-red-600 animate-pulse">{countdown}</span>
            <p className="text-sm text-muted-foreground mt-2">Starting in...</p>
          </div>
        )}

        {/* Recording timer + event tagging */}
        {isRecording && countdown === null && (
          <div className="space-y-3">
            {/* Timer */}
            <div className="text-center">
              <span className="text-4xl font-mono font-bold text-red-600 tabular-nums">
                {formatTime(elapsed)}
              </span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
                <span className="text-sm text-red-600 font-medium">Recording in progress</span>
              </div>
            </div>

            {/* Event tagging strip */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Tag className="h-3 w-3" />
                Tap to tag event at current time
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EVENT_BUTTONS.map(({ type, label, emoji, bg }) => (
                  <Button
                    key={type}
                    size="sm"
                    className={`h-12 min-w-[72px] text-sm text-white ${bg} active:scale-95 transition-transform`}
                    onClick={() => handleTagEvent(type)}
                  >
                    <span className="text-lg mr-1">{emoji}</span>
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Recent tags */}
            {eventTags.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Recent tags</p>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {[...eventTags].reverse().slice(0, 10).map((tag, i) => {
                    const btn = EVENT_BUTTONS.find((b) => b.type === tag.eventType);
                    return (
                      <Badge key={i} variant="outline" className="text-xs">
                        {btn?.emoji} {formatTime(Math.floor(tag.timestampMs / 1000))}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controls — sticky on mobile */}
        {countdown === null && (
          <div className="sticky bottom-0 -mx-3 sm:mx-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-3 sm:px-0 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2 border-t sm:border-0">
            {!isRecording ? (
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-red-600 hover:bg-red-700 text-white"
                disabled={!canStart}
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

        {!canStart && !isRecording && anyConnected && countdown === null && (
          <p className="text-xs text-muted-foreground text-center">
            Waiting for both cameras to be ready before recording can start.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
