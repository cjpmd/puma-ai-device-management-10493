import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Circle, Square, AlertTriangle, Zap } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

// Lazy imports — only resolved on native
let CameraPreview: any = null;
let DevicePlugin: any = null;
let Filesystem: any = null;

const isNative = Capacitor.isNativePlatform();

if (isNative) {
  import('@capacitor-community/camera-preview').then((m) => {
    CameraPreview = m.CameraPreview;
  });
  import('@capacitor/device').then((m) => {
    DevicePlugin = m.Device;
  });
  import('@capacitor/filesystem').then((m) => {
    Filesystem = m.Filesystem;
  });
}

interface CameraRecorderProps {
  onRecordingComplete: (file: File) => void;
  remoteCommand: 'idle' | 'start' | 'stop';
  startAt?: number; // scheduled start timestamp from control phone
  onStatusChange: (status: 'ready' | 'recording' | 'stopped' | 'error', error?: string) => void;
  onPreviewFrame?: (base64: string) => void;
  onTelemetry?: (battery: number, isCharging: boolean) => void;
  onStorage?: (freeBytes: number, totalBytes: number) => void;
  onPong?: (sentAt: number, receivedAt: number) => void;
  onCapabilities?: (caps: { resolution: string; fps: number; zoom: number; ultraWide: boolean; native: boolean }) => void;
  isConnected: boolean;
  clockOffset: number; // ms offset calculated from ping-pong
  livePreviewBoost?: boolean; // when true, stream preview frames more frequently
}

export function CameraRecorder({
  onRecordingComplete,
  remoteCommand,
  startAt,
  onStatusChange,
  onPreviewFrame,
  onTelemetry,
  onStorage,
  onPong,
  onCapabilities,
  isConnected,
  clockOffset,
  livePreviewBoost = false,
}: CameraRecorderProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [useNative, setUseNative] = useState(isNative);
  const [storageFree, setStorageFree] = useState<number | null>(null);
  const [storageTotal, setStorageTotal] = useState<number | null>(null);
  const [appliedSettings, setAppliedSettings] = useState<string>('');

  // Web fallback refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telemetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeFilePathRef = useRef<string | null>(null);

  // ─── INIT ───
  useEffect(() => {
    if (isNative) {
      initNativeCamera();
    } else {
      initWebCamera();
    }
    return () => {
      cleanup();
    };
  }, []);

  // ─── PREVIEW STREAMING ───
  useEffect(() => {
    if (!hasPermission || isRecording) {
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
      return;
    }

    if (!onPreviewFrame) return;
    const intervalMs = livePreviewBoost ? 500 : 3000;
    const quality = livePreviewBoost ? 30 : 15;

    if (isNative && CameraPreview) {
      previewIntervalRef.current = setInterval(async () => {
        try {
          const result = await CameraPreview.captureSample({ quality });
          if (result?.value) onPreviewFrame(result.value);
        } catch {}
      }, intervalMs);
    } else if (videoRef.current && streamRef.current) {
      // Web fallback: capture frame from video element
      previewIntervalRef.current = setInterval(() => {
        try {
          const v = videoRef.current!;
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = (v.videoHeight / v.videoWidth) * 320 || 180;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL('image/jpeg', quality / 100);
          onPreviewFrame(data.replace(/^data:image\/jpeg;base64,/, ''));
        } catch {}
      }, intervalMs);
    }

    return () => {
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    };
  }, [hasPermission, isRecording, onPreviewFrame, livePreviewBoost]);

  // ─── BATTERY + STORAGE TELEMETRY ───
  useEffect(() => {
    const sendTelemetry = async () => {
      // Battery
      if (DevicePlugin && onTelemetry) {
        try {
          const info = await DevicePlugin.getBatteryInfo();
          onTelemetry(info.batteryLevel ?? -1, info.isCharging ?? false);
        } catch {}
      } else if (!isNative && onTelemetry && (navigator as any).getBattery) {
        try {
          const bat = await (navigator as any).getBattery();
          onTelemetry(bat.level, bat.charging);
        } catch {}
      }
      // Storage — navigator.storage works on web AND iOS WKWebView
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (est.quota) {
            setStorageTotal(est.quota);
            const free = est.quota - (est.usage || 0);
            setStorageFree(free);
            onStorage?.(free, est.quota);
          }
        }
      } catch {}
    };
    sendTelemetry();
    telemetryIntervalRef.current = setInterval(sendTelemetry, 10000);

    return () => {
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
    };
  }, [onTelemetry, onStorage]);

  // ─── HANDLE REMOTE COMMANDS ───
  useEffect(() => {
    if (remoteCommand === 'start' && hasPermission && !isRecording && startAt) {
      scheduleStart(startAt);
    } else if (remoteCommand === 'stop' && isRecording) {
      stopRecording();
    }
  }, [remoteCommand, startAt]);

  // ─── NATIVE CAMERA (auto-config 4K + ultra-wide) ───
  const initNativeCamera = async () => {
    // Wait for lazy imports
    await new Promise((r) => setTimeout(r, 300));
    if (!CameraPreview) {
      setUseNative(false);
      initWebCamera();
      return;
    }
    try {
      await CameraPreview.start({
        parent: 'camera-preview-container',
        position: 'rear',
        toBack: true,
        width: 3840,
        height: 2160,
        enableZoom: true,
        disableAudio: false,
      });
      // Try ultra-wide (min zoom) — 0.5x on supported iOS devices
      let appliedZoom = 1;
      let isUltraWide = false;
      try {
        await CameraPreview.setZoom({ zoom: 0.5 });
        setAppliedSettings('4K • 30fps • 0.5x ultra-wide');
        appliedZoom = 0.5;
        isUltraWide = true;
      } catch {
        try {
          await CameraPreview.setZoom({ zoom: 1 });
          setAppliedSettings('4K • 30fps • 1x');
          appliedZoom = 1;
        } catch {
          setAppliedSettings('4K • 30fps');
        }
      }
      setHasPermission(true);
      onStatusChange('ready');
      onCapabilities?.({
        resolution: '3840×2160',
        fps: 30,
        zoom: appliedZoom,
        ultraWide: isUltraWide,
        native: true,
      });
    } catch (err: any) {
      console.error('Native camera init failed:', err);
      setHasPermission(false);
      onStatusChange('error', 'Camera access denied');
    }
  };

  // ─── WEB FALLBACK ───
  const initWebCamera = async () => {
    if (typeof MediaRecorder === 'undefined') {
      setHasPermission(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      setAppliedSettings(
        settings ? `${settings.width || '?'}×${settings.height || '?'} • ${Math.round(settings.frameRate || 0)}fps` : 'Auto'
      );
      setHasPermission(true);
      onStatusChange('ready');
    } catch {
      setHasPermission(false);
      onStatusChange('error', 'Camera access denied');
    }
  };

  // ─── SCHEDULED START (COUNTDOWN) ───
  const scheduleStart = useCallback(
    (targetTime: number) => {
      const adjustedDelay = targetTime - Date.now() + clockOffset;
      if (adjustedDelay <= 0) {
        startRecording();
        return;
      }

      // Show countdown
      const showCountdown = (remaining: number) => {
        if (remaining <= 0) {
          setCountdown(null);
          startRecording();
          return;
        }
        setCountdown(remaining);
        countdownTimerRef.current = setTimeout(() => showCountdown(remaining - 1), 1000);
      };

      const countdownSeconds = Math.ceil(adjustedDelay / 1000);
      const preCountdownDelay = adjustedDelay - countdownSeconds * 1000;

      if (preCountdownDelay > 0) {
        setTimeout(() => showCountdown(countdownSeconds), preCountdownDelay);
      } else {
        showCountdown(countdownSeconds);
      }
    },
    [clockOffset]
  );

  // ─── START RECORDING ───
  const startRecording = useCallback(async () => {
    if (isNative && CameraPreview) {
      try {
        const result = await CameraPreview.startRecordVideo({
          width: 3840,
          height: 2160,
          quality: 100,
        });
      } catch (err: any) {
        onStatusChange('error', err.message);
        return;
      }
    } else if (streamRef.current) {
      chunksRef.current = [];
      const mimeType = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) =>
        MediaRecorder.isTypeSupported(t)
      ) || '';
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const mType = recorder.mimeType || 'video/webm';
        const ext = mType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mType });
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mType });
        onRecordingComplete(file);
        onStatusChange('stopped');
      };
      recorder.start(1000);
      recorderRef.current = recorder;
    }

    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    onStatusChange('recording');
  }, [onRecordingComplete, onStatusChange]);

  // ─── STOP RECORDING ───
  const stopRecording = useCallback(async () => {
    if (isNative && CameraPreview) {
      try {
        const result = await CameraPreview.stopRecordVideo();
        if (result?.videoFilePath) {
          nativeFilePathRef.current = result.videoFilePath;
          const fileUri = result.videoFilePath.startsWith('file://')
            ? result.videoFilePath
            : `file://${result.videoFilePath}`;
          const response = await fetch(fileUri);
          const blob = await response.blob();
          const file = new File([blob], `recording-${Date.now()}.mp4`, { type: 'video/mp4' });
          onRecordingComplete(file);
        }
      } catch (err: any) {
        console.error('Stop recording error:', err);
        onStatusChange('error', err.message);
      }
    } else {
      recorderRef.current?.stop();
      recorderRef.current = null;
    }

    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    onStatusChange('stopped');
  }, [onRecordingComplete, onStatusChange]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (isNative && CameraPreview) {
      CameraPreview.stop().catch(() => {});
    }
  };

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

  // Approx bytes/sec for 4K@30fps H.264 ≈ 6 MB/s
  const estMinutesRemaining = storageFree ? Math.floor(storageFree / (6 * 1024 * 1024) / 60) : null;
  const lowStorage = storageFree !== null && estMinutesRemaining !== null && estMinutesRemaining < 30;

  // ─── RENDER ───

  if (hasPermission === null) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <Camera className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Requesting camera access...</p>
        </CardContent>
      </Card>
    );
  }

  if (hasPermission === false) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-sm font-medium">Camera access denied</p>
          <p className="text-xs text-muted-foreground">Allow camera access in your device settings and reload.</p>
          <Button size="sm" onClick={() => (isNative ? initNativeCamera() : initWebCamera())}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Auto-applied camera settings + storage info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {appliedSettings && (
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" /> {appliedSettings}
          </Badge>
        )}
        {storageFree !== null && (
          <Badge
            variant="outline"
            className={lowStorage ? 'text-destructive border-destructive/50' : 'text-muted-foreground'}
          >
            {formatBytes(storageFree)} free
            {estMinutesRemaining !== null && ` • ~${estMinutesRemaining}min`}
          </Badge>
        )}
      </div>

      {lowStorage && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-xs text-destructive text-center">
          ⚠️ Low storage. Free up space before a long recording.
        </div>
      )}

      {/* Viewfinder */}
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        {isNative ? (
          <div id="camera-preview-container" className="w-full h-full" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        )}

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <span className="text-8xl font-bold text-white animate-pulse">{countdown}</span>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <Badge className="bg-red-600 text-white">
              <Circle className="h-2 w-2 fill-current mr-1 animate-pulse" />
              REC {formatTime(elapsed)}
            </Badge>
          </div>
        )}

        {isNative && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="outline" className="bg-black/50 text-white border-white/30 text-xs">
              <Zap className="h-3 w-3 mr-1" /> 4K Native
            </Badge>
          </div>
        )}

        {isConnected && !isRecording && countdown === null && (
          <div className="absolute bottom-3 left-3 z-10">
            <Badge variant="outline" className="bg-black/50 text-white border-white/30 text-xs">
              Waiting for start signal...
            </Badge>
          </div>
        )}
      </div>

      {!isConnected && (
        <div className="space-y-2">
          {!isRecording ? (
            <Button size="lg" className="w-full h-14 text-lg bg-red-600 hover:bg-red-700 text-white" onClick={() => startRecording()}>
              <Circle className="h-5 w-5 mr-2 fill-current" />
              Start Recording
            </Button>
          ) : (
            <Button size="lg" variant="outline" className="w-full h-14 text-lg border-red-300 text-red-700" onClick={() => stopRecording()}>
              <Square className="h-5 w-5 mr-2 fill-current" />
              Stop Recording ({formatTime(elapsed)})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
