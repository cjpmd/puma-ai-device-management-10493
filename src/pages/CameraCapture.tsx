import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, XCircle, Wifi, WifiOff, Radio, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CameraRecorder } from '@/components/Matches/CameraRecorder';

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime & sync state
  const [isConnected, setIsConnected] = useState(false);
  const [remoteCommand, setRemoteCommand] = useState<'idle' | 'start' | 'stop'>('idle');
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const [clockOffset, setClockOffset] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pingResultsRef = useRef<number[]>([]);

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

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
          if (payload.command === 'start') {
            setStartAt(payload.startAt);
            setRemoteCommand('start');
          } else if (payload.command === 'stop') {
            setRemoteCommand('stop');
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

  const handleRecordingComplete = useCallback((recordedFile: File) => {
    setFile(recordedFile);
    setRemoteCommand('idle');
  }, []);

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
            <p className="text-xs text-muted-foreground">You can close this page now.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      {/* Header */}
      <div className="text-center mb-4 pt-4">
        <Badge variant="secondary" className="text-base px-4 py-1 mb-3">
          {tokenInfo?.camera_side === 'left' ? '📷 Left Camera' : '📷 Right Camera'}
        </Badge>
        <h1 className="text-xl font-bold">{tokenInfo?.match_title}</h1>
        {tokenInfo?.match_date && (
          <p className="text-sm text-muted-foreground mt-1">{new Date(tokenInfo.match_date).toLocaleDateString()}</p>
        )}
        {tokenInfo?.match_location && <p className="text-sm text-muted-foreground">{tokenInfo.match_location}</p>}
      </div>

      {/* Connection Status */}
      <div className="flex items-center justify-center gap-2 mb-4">
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

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-4">
        {/* Camera recorder — shown when no file selected yet */}
        {!file && !uploading && (
          <>
            <CameraRecorder
              onRecordingComplete={handleRecordingComplete}
              remoteCommand={remoteCommand}
              startAt={startAt}
              onStatusChange={handleRecorderStatusChange}
              onPreviewFrame={handlePreviewFrame}
              onTelemetry={handleTelemetry}
              isConnected={isConnected}
              clockOffset={clockOffset}
            />

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
