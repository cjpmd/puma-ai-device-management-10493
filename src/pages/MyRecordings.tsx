import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Wifi,
  WifiOff,
  Film,
  RotateCcw,
  Pause,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  localRecordings,
  formatBytes,
  formatDuration,
  type LocalRecording,
} from '@/services/localRecordings';
import {
  uploadLocalRecording,
  isOnWifi,
  WifiRequired,
  UploadCancelled,
} from '@/services/uploadRecording';
import { Capacitor } from '@capacitor/core';

const StatusPill = ({ rec }: { rec: LocalRecording }) => {
  if (rec.status === 'uploaded')
    return (
      <Badge className="bg-emerald-100 text-emerald-800">
        <CheckCircle className="h-3 w-3 mr-1" /> Uploaded
      </Badge>
    );
  if (rec.status === 'uploading')
    return (
      <Badge className="bg-blue-100 text-blue-800">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading {rec.progress}%
      </Badge>
    );
  if (rec.status === 'failed')
    return (
      <Badge className="bg-destructive/10 text-destructive">
        <XCircle className="h-3 w-3 mr-1" /> Failed
      </Badge>
    );
  return <Badge variant="secondary">Pending upload</Badge>;
};

const MyRecordings = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchFilter = params.get('match');
  const { toast } = useToast();
  const [recs, setRecs] = useState<LocalRecording[]>([]);
  const [wifiOnly, setWifiOnly] = useState(localRecordings.getWifiOnly());
  const [onWifi, setOnWifi] = useState<boolean | null>(null);
  const abortMapRef = useRef<Map<string, AbortController>>(new Map());

  const refresh = () => setRecs(localRecordings.list());

  useEffect(() => {
    refresh();
    localRecordings.sweepUploaded().then(refresh).catch(() => {});
    isOnWifi().then(setOnWifi);

    // Re-poll every 1s while there's an active upload to reflect progress
    const i = setInterval(refresh, 1000);
    return () => clearInterval(i);
  }, []);

  // Listen to network changes on native to auto-resume pending uploads when
  // WiFi-only is enabled and the user comes back to WiFi.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const syncNetworkState = async () => {
      const wifi = await isOnWifi();
      setOnWifi(wifi);
      if (localRecordings.getWifiOnly() && wifi) {
        for (const r of localRecordings.list()) {
          if (r.status === 'pending') startUpload(r.id).catch(() => {});
        }
      }
    };

    window.addEventListener('online', syncNetworkState);
    window.addEventListener('offline', syncNetworkState);

    const poll = window.setInterval(syncNetworkState, 15000);
    syncNetworkState().catch(() => {});

    return () => {
      window.removeEventListener('online', syncNetworkState);
      window.removeEventListener('offline', syncNetworkState);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => (matchFilter ? recs.filter((r) => r.matchId === matchFilter) : recs),
    [recs, matchFilter],
  );

  const startUpload = async (id: string) => {
    if (abortMapRef.current.has(id)) return;
    const ac = new AbortController();
    abortMapRef.current.set(id, ac);
    try {
      await uploadLocalRecording(id, { signal: ac.signal });
      toast({ title: 'Upload complete', description: 'Recording sent successfully.' });
    } catch (err: any) {
      if (err instanceof UploadCancelled) {
        // user paused — silent
      } else if (err instanceof WifiRequired) {
        toast({
          title: 'Waiting for WiFi',
          description: 'Will upload automatically when WiFi is available.',
        });
      } else {
        toast({
          title: 'Upload failed',
          description: err?.message || 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      abortMapRef.current.delete(id);
      refresh();
    }
  };

  const pauseUpload = (id: string) => {
    const ac = abortMapRef.current.get(id);
    ac?.abort();
  };

  const removeRec = async (id: string) => {
    const rec = localRecordings.get(id);
    if (!rec) return;
    if (rec.status !== 'uploaded') {
      if (!confirm('Delete this recording? It has not been uploaded yet.')) return;
    }
    if (rec.filesystemPath) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.deleteFile({ path: rec.filePath, directory: Directory.Data });
      } catch (e) {
        console.warn('[MyRecordings] deleteFile failed', e);
      }
    }
    localRecordings.remove(id);
    refresh();
  };

  return (
    <div className="min-h-screen wallpaper-twilight safe-top safe-x px-3 pb-8 md:p-8 text-white">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-white hover:bg-white/10"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Recordings</h1>
        </div>

        <Card className="glass border-white/10">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onWifi ? (
                  <Wifi className="h-4 w-4 text-emerald-400" />
                ) : (
                  <WifiOff className="h-4 w-4 text-orange-400" />
                )}
                <Label htmlFor="wifi-only" className="text-sm">
                  Only upload on WiFi
                </Label>
              </div>
              <Switch
                id="wifi-only"
                checked={wifiOnly}
                onCheckedChange={(v) => {
                  setWifiOnly(v);
                  localRecordings.setWifiOnly(v);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {wifiOnly
                ? 'Uploads pause on mobile data and resume automatically when you reconnect to WiFi.'
                : 'Uploads will use whichever connection is available, including mobile data.'}
            </p>
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <Card className="glass border-white/10">
            <CardContent className="pt-8 text-center space-y-3">
              <Film className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No saved recordings yet. After you stop a recording, it will appear here so you can
                upload it whenever you're ready.
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((r) => (
            <Card key={r.id} className="glass border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{r.matchTitle || 'Untitled match'}</span>
                  <StatusPill rec={r} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-white/80 border-white/20">
                    {r.cameraSide === 'left' ? 'Left camera' : 'Right camera'}
                  </Badge>
                  <span>{formatBytes(r.sizeBytes)}</span>
                  <span>•</span>
                  <span>{formatDuration(r.durationSec)}</span>
                  <span>•</span>
                  <span>{new Date(r.recordedAt).toLocaleString()}</span>
                </div>

                {r.status === 'uploading' && (
                  <Progress value={r.progress} className="h-2" />
                )}

                {r.lastError && r.status !== 'uploaded' && (
                  <p className="text-xs text-destructive">{r.lastError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {r.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => startUpload(r.id)}
                      disabled={wifiOnly && onWifi === false}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {wifiOnly && onWifi === false ? 'Waiting for WiFi' : 'Upload now'}
                    </Button>
                  )}
                  {r.status === 'uploading' && (
                    <Button size="sm" variant="outline" onClick={() => pauseUpload(r.id)}>
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </Button>
                  )}
                  {r.status === 'failed' && (
                    <Button size="sm" variant="outline" onClick={() => startUpload(r.id)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Retry
                    </Button>
                  )}
                  {(r.status === 'uploaded' ||
                    r.status === 'pending' ||
                    r.status === 'failed') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeRec(r.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MyRecordings;