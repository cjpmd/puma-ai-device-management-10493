import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Download, Film } from 'lucide-react';

interface MatchOutputViewerProps {
  job: {
    output_video_path: string | null;
    output_highlights_path: string | null;
    output_metadata_path: string | null;
  } | null;
}

export function MatchOutputViewer({ job }: MatchOutputViewerProps) {
  if (!job || (!job.output_video_path && !job.output_highlights_path)) {
    return null;
  }

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
            <Button size="sm" variant="outline">
              <Play className="h-4 w-4 mr-1" /> View
            </Button>
          </div>
        )}
        {job.output_highlights_path && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Highlights</span>
            <Button size="sm" variant="outline">
              <Play className="h-4 w-4 mr-1" /> View
            </Button>
          </div>
        )}
        {job.output_metadata_path && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Metadata</span>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
