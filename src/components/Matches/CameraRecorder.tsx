import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Circle, Square, Video, AlertTriangle } from 'lucide-react';

interface CameraRecorderProps {
  onRecordingComplete: (file: File) => void;
  remoteCommand: 'idle' | 'start' | 'stop';
  onStatusChange: (status: 'ready' | 'recording' | 'stopped' | 'error', error?: string) => void;
  isConnected: boolean;
}

export function CameraRecorder({ onRecordingComplete, remoteCommand, onStatusChange, isConnected }: CameraRecorderProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [supportsMediaRecorder, setSupportsMediaRecorder] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check MediaRecorder support
  useEffect(() => {
    if (typeof MediaRecorder === 'undefined') {
      setSupportsMediaRecorder(false);
    }
  }, []);

  // Request camera permission on mount
  useEffect(() => {
    if (!supportsMediaRecorder) return;
    requestCamera();
    return () => {
      stopStream();
    };
  }, [supportsMediaRecorder]);

  // Handle remote commands
  useEffect(() => {
    if (remoteCommand === 'start' && hasPermission && !isRecording) {
      startRecording();
    } else if (remoteCommand === 'stop' && isRecording) {
      stopRecording();
    }
  }, [remoteCommand]);

  const requestCamera = async () => {
    try {
      // Request 4K resolution with ultra-wide (0.5x) lens
      // The wide-angle lens is typically accessed via a smaller zoom level
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
        audio: true,
      };

      let stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Try to select the ultra-wide (0.5x) lens by setting zoom to minimum
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities?.() as any;
      if (capabilities?.zoom) {
        const minZoom = capabilities.zoom.min;
        await videoTrack.applyConstraints({
          advanced: [{ zoom: minZoom } as any],
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
      onStatusChange('ready');
    } catch (err: any) {
      console.error('Camera permission denied:', err);
      setHasPermission(false);
      onStatusChange('error', 'Camera access denied');
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const getMimeType = () => {
    const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  };

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeType = getMimeType();
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

    recorder.start(1000); // collect in 1s chunks
    recorderRef.current = recorder;
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    onStatusChange('recording');
  }, [onRecordingComplete, onStatusChange]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Fallback: no MediaRecorder support
  if (!supportsMediaRecorder) {
    return null; // parent will show file input fallback
  }

  // Waiting for permission
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

  // Permission denied
  if (hasPermission === false) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-sm font-medium">Camera access denied</p>
          <p className="text-xs text-muted-foreground">Allow camera access in your browser settings and reload this page.</p>
          <Button size="sm" onClick={requestCamera}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live viewfinder */}
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <Badge className="bg-red-600 text-white">
              <Circle className="h-2 w-2 fill-current mr-1 animate-pulse" />
              REC {formatTime(elapsed)}
            </Badge>
          </div>
        )}
        {isConnected && !isRecording && (
          <div className="absolute bottom-3 left-3">
            <Badge variant="outline" className="bg-black/50 text-white border-white/30 text-xs">
              Waiting for start signal...
            </Badge>
          </div>
        )}
      </div>

      {/* Manual controls (fallback if not connected to control phone) */}
      {!isConnected && (
        <div className="space-y-2">
          {!isRecording ? (
            <Button size="lg" className="w-full h-14 text-lg bg-red-600 hover:bg-red-700 text-white" onClick={startRecording}>
              <Circle className="h-5 w-5 mr-2 fill-current" />
              Start Recording
            </Button>
          ) : (
            <Button size="lg" variant="outline" className="w-full h-14 text-lg border-red-300 text-red-700" onClick={stopRecording}>
              <Square className="h-5 w-5 mr-2 fill-current" />
              Stop Recording ({formatTime(elapsed)})
            </Button>
          )}
        </div>
      )}

      {isConnected && !isRecording && (
        <p className="text-xs text-center text-muted-foreground">
          <Video className="h-3 w-3 inline mr-1" />
          Recording will start when the control phone triggers it.
        </p>
      )}
    </div>
  );
}
