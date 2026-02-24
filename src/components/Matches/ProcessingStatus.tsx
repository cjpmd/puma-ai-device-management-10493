import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ProcessingStatusProps {
  job: {
    status: string;
    runpod_job_id: string | null;
    gpu_type: string | null;
    started_at: string | null;
    completed_at: string | null;
    processing_logs: string | null;
  } | null;
}

const statusIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-4 w-4 animate-pulse" />,
  running: <Loader2 className="h-4 w-4 animate-spin" />,
  complete: <CheckCircle className="h-4 w-4 text-green-600" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
};

export function ProcessingStatus({ job }: ProcessingStatusProps) {
  if (!job) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No processing job yet. Upload both camera videos to begin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          Processing Status
          <Badge className="flex items-center gap-1">
            {statusIcons[job.status]}
            {job.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {job.runpod_job_id && <p><span className="text-muted-foreground">Job ID:</span> {job.runpod_job_id}</p>}
        {job.gpu_type && <p><span className="text-muted-foreground">GPU:</span> {job.gpu_type}</p>}
        {job.started_at && <p><span className="text-muted-foreground">Started:</span> {new Date(job.started_at).toLocaleString()}</p>}
        {job.completed_at && <p><span className="text-muted-foreground">Completed:</span> {new Date(job.completed_at).toLocaleString()}</p>}
        {job.processing_logs && job.status === 'failed' && (
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">{job.processing_logs}</pre>
        )}
      </CardContent>
    </Card>
  );
}
