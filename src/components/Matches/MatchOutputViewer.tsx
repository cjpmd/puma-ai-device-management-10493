import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Download, Film, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface MatchOutputViewerProps {
  matchId: string;
  job: {
    output_video_path: string | null;
    output_highlights_path: string | null;
    output_metadata_path: string | null;
  } | null;
}

export function MatchOutputViewer({ matchId, job }: MatchOutputViewerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  if (!job || (!job.output_video_path && !job.output_highlights_path)) {
    return null;
  }

  const handleGetUrl = async (fileType: 'video' | 'highlights' | 'metadata') => {
    setLoading(fileType);
    try {
      const { data, error } = await supabase.functions.invoke('get-output-url', {
        body: { match_id: matchId, file_type: fileType },
      });
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('No URL returned');

      window.open(data.url, '_blank');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Film className="h-5 w-5" />
          Outputs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {job.output_video_path && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Final Follow Cam</span>
            <Button size="sm" variant="outline" onClick={() => handleGetUrl('video')} disabled={loading === 'video'}>
              {loading === 'video' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} View
            </Button>
          </div>
        )}
        {job.output_highlights_path && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Highlights</span>
            <Button size="sm" variant="outline" onClick={() => handleGetUrl('highlights')} disabled={loading === 'highlights'}>
              {loading === 'highlights' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} View
            </Button>
          </div>
        )}
        {job.output_metadata_path && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Metadata</span>
            <Button size="sm" variant="outline" onClick={() => handleGetUrl('metadata')} disabled={loading === 'metadata'}>
              {loading === 'metadata' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
