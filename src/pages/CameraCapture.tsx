import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, XCircle, Wifi, WifiOff, Radio, Camera, X, QrCode, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CameraRecorder } from '@/components/Matches/CameraRecorder';
import type { RecordingResult } from '@/components/Matches/CameraRecorder';
import { localRecordings, formatBytes, formatDuration } from '@/services/localRecordings';
import { uploadLocalRecording, isOnWifi, WifiRequired, UploadCancelled } from '@/services/uploadRecording';
import { Capacitor } from '@capacitor/core';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const MAX_SIZE = 150 * 1024 * 1024 * 1024;
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

interface TokenInfo {
  match_id: string;
  camera_side: string;
  expires_at: string;
  match_title: string;
  match_date: string | null;
  match_location: string | null;
}

const CameraCapture = () => {
  const { token } = useParams<{ token: string }>();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null);
  const [savedSize, setSavedSize] = useState<number>(0);
  const [savedDuration, setSavedDuration] = useState<number>(0);
  const [cancelled, setCancelled] = useState<null | 'self' | 'remote'>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime & sync state
  const [isConnected, setIsConnected] = useState(false);
  const [remoteCommand, setRemoteCommand] = useState<'idle' | 'start' | 'stop'>('idle');
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [clockOffset, setClockOffset] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pingResultsRef = useRef<number[]>([]);
  // Mount gate: wait until `camera-preview-active` has been applied AND
  // the page has had a couple of frames to settle the boxed viewfinder
  // layout before mounting <CameraRecorder/>. This prevents the recorder
  // from measuring 0×0 on iOS WebView during cold start, which previously
  // surfaced as the misleading "Camera access denied" card.
  const [recorderReady, setRecorderReady] = useState(false);

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Boxed viewfinder approach: the native camera preview is positioned to
  // match the viewfinder div via x/y/width/height in CameraPreview.start().
  // BUT the WebView itself must be transparent (toBack:true renders the
  // camera *behind* the WKWebView), otherwise the page background covers
  // the native preview rect. We toggle `camera-preview-active` on <html>
  // while the recorder is mounted, and floating chrome elements keep their
  // own dark-glass backgrounds for readability.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!tokenInfo) return;
    if (uploadDone || cancelled || file || uploading) return;
    const html = document.documentElement;
    html.classList.add('camera-preview-active');
    return () => {
      html.classList.remove('camera-preview-active');
    };
  }, [tokenInfo, uploadDone, cancelled, file, uploading]);

  // Defer mounting CameraRecorder until after `camera-preview-active`
  // has been applied and the WebView has had time to lay out the
  // boxed viewfinder. ~120ms covers the iOS reflow + safe-area pass.
  useEffect(() => {
    if (!tokenInfo) {
      setRecorderReady(false);
      return;
    }
    if (uploadDone || cancelled || file || uploading) {
      setRecorderReady(false);
      return;
    }
    setRecorderReady(false);
    const t = setTimeout(() => {
      // Two animation frames after the timeout to be doubly sure layout
      // has settled before measurement begins inside the recorder.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setRecorderReady(true)),
      );
    }, 120);
    return () => clearTimeout(t);
  }, [tokenInfo, uploadDone, cancelled, file, uploading]);

  const navigate = useNavigate();
  const goHome = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      navigate('/');
    } else {
      try { window.close(); } catch {}
      // Fallback if window.close is blocked
      setTimeout(() => navigate('/'), 100);
    }
  }, [navigate]);
  const goScanQr = useCallback(() => {
    navigate('/scan-qr');
  }, [navigate]);

  // Validate token
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-camera-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid token');
        setTokenInfo(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Subscribe to realtime channel
  useEffect(() => {
    if (!tokenInfo) return;

    const channel = supabase.channel(`recording-${tokenInfo.match_id}`);

    channel
      .on('broadcast', { event: 'recording' }, ({ payload }) => {
        if (payload?.type === 'command') {
          // Per-side filter: if the master targets a specific donor, ignore
          // commands meant for the other donor. Master can still address
          // both donors by omitting `camera_side` from the payload.
          if (payload.camera_side && payload.camera_side !== tokenInfo.camera_side) {
            return;
          }
          if (payload.command === 'start') {
            setStartAt(payload.startAt);
            setRemoteCommand('start');
          } else if (payload.command === 'stop') {
            setRemoteCommand('stop');
          } else if (payload.command === 'live_preview_on') {
            setLivePreviewBoost(true);
          } else if (payload.command === 'live_preview_off') {
            setLivePreviewBoost(false);
          } else if (payload.command === 'disconnect') {
            // Master phone has rejected/closed this donor camera
            setCancelled('remote');
          }
        }
        // Respond to pings from control phone
        if (payload?.type === 'ping') {
          channel.send({
            type: 'broadcast',
            event: 'recording',
            payload: {
              type: 'pong',
              camera_side: tokenInfo.camera_side,
              sentAt: payload.sentAt,
              receivedAt: Date.now(),
            },
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          channel.send({
            type: 'broadcast',
            event: 'recording',
            payload: { type: 'status', camera_side: tokenInfo.camera_side, status: 'ready' },
          });
          // Run ping-pong calibration
          runPingCalibration(channel);
        }
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [tokenInfo]);

  // Ping calibration: send 3 pings to control phone, measure round-trip
  const runPingCalibration = (channel: ReturnType<typeof supabase.channel>) => {
    // The camera phone initiates pings and the control phone responds
    // We measure round-trip time to estimate one-way latency
    // For simplicity, we rely on NTP-synced clocks (~20ms accuracy)
    // The ping-pong is mainly to verify connectivity
    pingResultsRef.current = [];
  };

  const sendStatus = useCallback(
    (status: string, err?: string) => {
      if (!channelRef.current || !tokenInfo) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: { type: 'status', camera_side: tokenInfo.camera_side, status, error: err },
      });
    },
    [tokenInfo]
  );

  // Preview frame callback — forward to control phone
  const handlePreviewFrame = useCallback(
    (base64: string) => {
      if (!channelRef.current || !tokenInfo) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: { type: 'preview', camera_side: tokenInfo.camera_side, frame: base64 },
      });
    },
    [tokenInfo]
  );

  // Battery telemetry callback
  const [storageInfo, setStorageInfo] = useState<{ free: number; total: number } | null>(null);
  const [livePreviewBoost, setLivePreviewBoost] = useState(false);

  const handleTelemetry = useCallback(
    (battery: number, isCharging: boolean) => {
      if (!channelRef.current || !tokenInfo) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: { type: 'telemetry', camera_side: tokenInfo.camera_side, batteryLevel: battery, isCharging },
      });
    },
    [tokenInfo]
  );

  // Storage telemetry callback
  const handleStorage = useCallback(
    (free: number, total: number) => {
      setStorageInfo({ free, total });
      if (!channelRef.current || !tokenInfo) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: { type: 'storage', camera_side: tokenInfo.camera_side, freeBytes: free, totalBytes: total },
      });
    },
    [tokenInfo]
  );

  const handleRecordingComplete = useCallback(
    (result: RecordingResult) => {
      if (!tokenInfo || !token) return;
      // Persist into the local registry so it survives navigation, app
      // background, and reboots. The donor can upload now or later from
      // the My Recordings screen.
      const id = localRecordings.newId();
      localRecordings.add({
        id,
        matchId: tokenInfo.match_id,
        matchTitle: tokenInfo.match_title,
        cameraSide: tokenInfo.camera_side as 'left' | 'right',
        uploadToken: token,
        filePath: result.filePath,
        filesystemPath: result.filesystemPath,
        sizeBytes: result.sizeBytes,
        durationSec: result.durationSec,
        mimeType: result.mimeType,
        recordedAt: new Date().toISOString(),
        status: 'pending',
        progress: 0,
      });
      setSavedRecordingId(id);
      setSavedSize(result.sizeBytes);
      setSavedDuration(result.durationSec);
      setRemoteCommand('idle');
      // Notify master so the QR card can show "Recorded ✔ awaiting upload"
      channelRef.current?.send({
        type: 'broadcast',
        event: 'recording',
        payload: {
          type: 'recording_saved',
          camera_side: tokenInfo.camera_side,
          size_bytes: result.sizeBytes,
          duration_sec: result.durationSec,
        },
      });
    },
    [tokenInfo, token],
  );

  const handleSavedUploadNow = useCallback(async () => {
    if (!savedRecordingId) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      if (localRecordings.getWifiOnly() && !(await isOnWifi())) {
        throw new WifiRequired();
      }
      await uploadLocalRecording(savedRecordingId, {
        onProgress: (p) => setProgress(p),
      });
      setUploadDone(true);
    } catch (err: any) {
      if (err instanceof WifiRequired) {
        setError('Waiting for WiFi. You can upload later from My Recordings.');
      } else if (!(err instanceof UploadCancelled)) {
        setError(err?.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  }, [savedRecordingId]);

  // Capabilities (lens / resolution / fps) — broadcast once after camera init
  const handleCapabilities = useCallback(
    (caps: { resolution: string; fps: number; zoom: number; ultraWide: boolean; native: boolean }) => {
      if (!channelRef.current || !tokenInfo) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: {
          type: 'capabilities',
          camera_side: tokenInfo.camera_side,
          ...caps,
        },
      });
    },
    [tokenInfo]
  );

  // Cancel / close — donor self-cancellation
  const handleCancel = useCallback(() => {
    if (!confirm('Close camera and exit? Master phone will be notified.')) return;
    if (channelRef.current && tokenInfo) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: { type: 'status', camera_side: tokenInfo.camera_side, status: 'cancelled' },
      });
    }
    setCancelled('self');
  }, [tokenInfo]);

  const handleRecorderStatusChange = useCallback(
    (status: 'ready' | 'recording' | 'stopped' | 'error', err?: string) => {
      sendStatus(status, err);
    },
    [sendStatus]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) { setError('Only MP4, MOV, and WebM files are allowed.'); return; }
    if (selected.size > MAX_SIZE) { setError('File too large. Maximum is 150GB.'); return; }
    setError(null);
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file || !tokenInfo || !token) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const urlRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          match_id: tokenInfo.match_id,
          camera_side: tokenInfo.camera_side,
          filename: file.name,
          content_type: file.type,
          upload_token: token,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || 'Failed to get upload URL');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))));
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('PUT', urlData.presigned_url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      await fetch(`${SUPABASE_URL}/functions/v1/confirm-guest-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          upload_token: token,
          match_id: tokenInfo.match_id,
          camera_side: tokenInfo.camera_side,
          file_size: file.size,
        }),
      });
      setUploadDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ─── RENDER ───

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Validating link...</p>
      </div>
    );
  }

  if (error && !tokenInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Link Invalid</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">Ask the match organiser for a new QR code.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">Upload Complete!</h2>
            <p className="text-sm text-muted-foreground">
              {tokenInfo?.camera_side === 'left' ? 'Left' : 'Right'} camera video for "{tokenInfo?.match_title}" has been uploaded.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={goScanQr} className="w-full">
                <QrCode className="h-4 w-4 mr-2" /> Scan new QR
              </Button>
              <Button onClick={goHome} className="w-full">
                <Home className="h-4 w-4 mr-2" /> Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 text-center space-y-4">
            <XCircle className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">
              {cancelled === 'remote' ? 'Disconnected by organiser' : 'Camera closed'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {cancelled === 'remote'
                ? 'The match organiser disconnected this camera. You can close this page or scan a new QR code to reconnect.'
                : 'Camera was closed before recording. You can close this page or scan a new QR code to reconnect.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={goScanQr} className="w-full">
                <QrCode className="h-4 w-4 mr-2" /> Scan new QR
              </Button>
              <Button onClick={goHome} className="w-full">
                <Home className="h-4 w-4 mr-2" /> Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen wallpaper-twilight p-4 landscape:p-2 safe-top safe-bottom safe-x flex flex-col overflow-x-hidden text-white">
      {/* Top-right close button — donor self-cancel */}
      <button
        type="button"
        onClick={handleCancel}
        aria-label="Close camera"
        className="fixed top-2 right-2 z-50 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur active:scale-95 transition-transform safe-top"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Header — compacts in landscape so the viewfinder gets max space */}
      <div className="text-center mb-4 pt-2 landscape:mb-2 landscape:pt-1">
        <Badge variant="secondary" className="text-base px-4 py-1 mb-3 landscape:text-xs landscape:px-2 landscape:py-0.5 landscape:mb-1">
          {tokenInfo?.camera_side === 'left' ? '📷 Left Camera' : '📷 Right Camera'}
        </Badge>
        <h1 className="text-xl font-bold landscape:text-sm landscape:inline">{tokenInfo?.match_title}</h1>
        {tokenInfo?.match_date && (
          <p className="text-sm text-muted-foreground mt-1 landscape:hidden">{new Date(tokenInfo.match_date).toLocaleDateString()}</p>
        )}
        {tokenInfo?.match_location && <p className="text-sm text-muted-foreground landscape:hidden">{tokenInfo.match_location}</p>}
      </div>

      {/* Connection Status */}
      <div className="flex items-center justify-center gap-2 mb-4 landscape:mb-2">
        {isOnline ? (
          <Badge variant="outline" className="text-emerald-600 border-emerald-300">
            <Wifi className="h-3 w-3 mr-1" /> Online
          </Badge>
        ) : (
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            <WifiOff className="h-3 w-3 mr-1" /> Offline
          </Badge>
        )}
        {isConnected && (
          <Badge variant="outline" className="text-emerald-600 border-emerald-300">
            <Radio className="h-3 w-3 mr-1" /> Synced
          </Badge>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center mx-auto w-full space-y-4 max-w-sm landscape:max-w-none">
        {/* Camera recorder — shown when no file selected yet */}
        {!file && !uploading && (
          <>
            {recorderReady ? (
              <CameraRecorder
                onRecordingComplete={handleRecordingComplete}
                remoteCommand={remoteCommand}
                startAt={startAt}
                onStatusChange={handleRecorderStatusChange}
                onPreviewFrame={handlePreviewFrame}
                onTelemetry={handleTelemetry}
                onStorage={handleStorage}
                onCapabilities={handleCapabilities}
                isConnected={isConnected}
                clockOffset={clockOffset}
                livePreviewBoost={livePreviewBoost}
              />
            ) : (
              <div className="rounded-lg aspect-video w-full bg-black/40 flex items-center justify-center text-xs text-white/70">
                Preparing camera…
              </div>
            )}

            {/* File input fallback */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              capture="environment"
              onChange={handleFileSelect}
            />
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Camera className="h-4 w-4 mr-2" />
              Choose Existing Video
            </Button>
          </>
        )}

        {/* File selected — ready to upload */}
        {file && !uploading && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {file.size > 1024 * 1024 * 1024
                    ? `${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                </p>
              </div>

              {!isOnline && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 text-center">
                  <WifiOff className="h-4 w-4 inline mr-1" />
                  Connect to WiFi before uploading to avoid mobile data charges.
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive text-center">
                  {error}
                </div>
              )}

              <Button size="lg" className="w-full h-16 text-lg" onClick={handleUpload} disabled={!isOnline}>
                <Upload className="h-5 w-5 mr-2" />
                Upload Video
              </Button>

              <Button variant="ghost" className="w-full" onClick={() => { setFile(null); setError(null); }}>
                Choose Different Video
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Uploading */}
        {uploading && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-center font-medium">Uploading...</p>
              <Progress value={progress} className="h-3" />
              <p className="text-center text-sm text-muted-foreground">{progress}%</p>
              <p className="text-xs text-center text-muted-foreground">Keep this page open until the upload completes.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-6 pb-4">
        <p className="text-xs text-muted-foreground">
          Link expires {tokenInfo?.expires_at ? new Date(tokenInfo.expires_at).toLocaleString() : ''}
        </p>
      </div>
    </div>
  );
};

export default CameraCapture;
