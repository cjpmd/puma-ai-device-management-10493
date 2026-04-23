import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Download, Film } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface ResolvedShare {
  url: string;
  match_title: string;
  match_date: string | null;
  file_type: 'video' | 'highlights';
  expires_in: number; // seconds
}

const SharedVideo = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ResolvedShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchShare = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ share_token: token }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Could not load video');
      setData(body);
      setError(null);
      // Schedule a refresh ~10 minutes before the URL expires
      const refreshIn = Math.max(60, (body.expires_in - 600)) * 1000;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(fetchShare, refreshIn);
    } catch (err: any) {
      setError(err?.message || 'Could not load video');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShare();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading shared video…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Video unavailable</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              The link may have expired or been revoked. Ask the coach for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Film className="h-3 w-3" />
              <Badge variant="secondary" className="text-[10px]">
                {data.file_type === 'highlights' ? 'Highlights' : 'Final video'}
              </Badge>
            </div>
            <h1 className="text-lg md:text-2xl font-bold truncate mt-1">
              {data.match_title || 'Match video'}
            </h1>
            {data.match_date && (
              <p className="text-xs text-muted-foreground">
                {new Date(data.match_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <Button asChild variant="outline">
            <a href={data.url} download>
              <Download className="h-4 w-4 mr-1" /> Download
            </a>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="rounded-lg overflow-hidden bg-black">
          <video
            key={data.url}
            src={data.url}
            controls
            playsInline
            className="w-full aspect-video"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Shared by the match organiser. Link refreshes automatically while this page is open.
        </p>
      </main>
    </div>
  );
};

export default SharedVideo;