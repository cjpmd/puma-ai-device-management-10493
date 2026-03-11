import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, RefreshCw, XCircle } from 'lucide-react';
import { useMatchPolling } from '@/hooks/useMatchPolling';
import { VideoUploadCard } from '@/components/Matches/VideoUploadCard';
import { ProcessingStatus } from '@/components/Matches/ProcessingStatus';
import { CameraQRSetup } from '@/components/Matches/CameraQRSetup';
import { MatchOutputViewer } from '@/components/Matches/MatchOutputViewer';
import { RecordingControls } from '@/components/Matches/RecordingControls';
import ProcessingConfigCard, { type ProcessingConfig } from '@/components/Matches/ProcessingConfigCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

const MatchDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { match, videos, jobs, loading, refetch } = useMatchPolling(id);
  const { toast } = useToast();
  const latestJob = jobs[0] || null;

  const leftVideo = videos.find((v) => v.camera_side === 'left');
  const rightVideo = videos.find((v) => v.camera_side === 'right');
  const bothUploaded = leftVideo?.upload_status === 'uploaded' && rightVideo?.upload_status === 'uploaded';

  const handleTriggerProcessing = async (config?: ProcessingConfig) => {
    try {
      const res = await supabase.functions.invoke('trigger-processing', {
        body: { match_id: id, config },
      });
      if (res.error) throw new Error(res.error.message);
      toast({ title: 'Processing triggered', description: `Job ID: ${res.data?.job_id}` });
      refetch();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkFailed = async () => {
    await supabase.from('matches').update({ status: 'failed' }).eq('id', id!);
    refetch();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!match) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Match not found</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/matches">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-emerald-700">{match.title || 'Untitled Match'}</h1>
            <div className="flex gap-3 text-sm text-muted-foreground mt-1">
              {match.match_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(match.match_date).toLocaleDateString()}</span>}
              {match.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.location}</span>}
            </div>
          </div>
          <Badge>{match.status}</Badge>
        </div>

        {/* Camera QR Setup */}
        <Card className="border-emerald-200">
          <CardHeader><CardTitle className="text-base">📱 Camera Setup</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Generate QR codes for camera phones to scan. No login required.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CameraQRSetup matchId={id!} cameraSide="left" uploadStatus={leftVideo?.upload_status} />
              <CameraQRSetup matchId={id!} cameraSide="right" uploadStatus={rightVideo?.upload_status} />
            </div>
          </CardContent>
        </Card>

        {/* Recording Controls */}
        <RecordingControls matchId={id!} />

        {/* Upload Cards (direct upload fallback) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VideoUploadCard matchId={id!} cameraSide="left" existingVideo={leftVideo} onUploadComplete={refetch} />
          <VideoUploadCard matchId={id!} cameraSide="right" existingVideo={rightVideo} onUploadComplete={refetch} />
        </div>

        {/* Auto-trigger hint */}
        {bothUploaded && !latestJob && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6 flex items-center justify-between">
              <p className="text-sm text-emerald-700">Both videos uploaded. Ready to process!</p>
              <Button onClick={handleTriggerProcessing} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" /> Start Processing
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Processing Status */}
        <ProcessingStatus job={latestJob} />

        {/* Outputs */}
        <MatchOutputViewer matchId={id!} job={latestJob} />

        {/* Developer Controls */}
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Developer Controls</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleTriggerProcessing} disabled={!bothUploaded}>
              <RefreshCw className="h-4 w-4 mr-1" /> Re-trigger Processing
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkFailed}>
              <XCircle className="h-4 w-4 mr-1" /> Mark as Failed
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MatchDetail;
