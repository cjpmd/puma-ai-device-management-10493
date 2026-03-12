import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoTimeline } from './VideoTimeline';
import { PlayerTracksSummary } from './PlayerTracksSummary';
import { BarChart3 } from 'lucide-react';

interface MatchAnalyticsDashboardProps {
  job: {
    player_tracking_data?: any;
    ball_tracking_data?: any;
    event_data?: any;
  };
}

export function MatchAnalyticsDashboard({ job }: MatchAnalyticsDashboardProps) {
  const ballTracking = job.ball_tracking_data || null;
  const playerTracks = job.player_tracking_data || null;
  const events = job.event_data || null;

  const hasData = ballTracking || playerTracks || events;

  if (!hasData) {
    return null;
  }

  // Convert player tracks object to array if needed
  const tracksArray = Array.isArray(playerTracks)
    ? playerTracks
    : playerTracks
      ? Object.entries(playerTracks).map(([key, val]: [string, any]) => ({
          track_id: Number(key),
          ...val,
        }))
      : null;

  const stages = ballTracking?.detection_stages;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Match Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="timeline">
          <TabsList className="mb-4">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="stats">Detection Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <VideoTimeline ballTracking={ballTracking} events={events} />
          </TabsContent>

          <TabsContent value="players">
            <PlayerTracksSummary tracks={tracksArray} />
          </TabsContent>

          <TabsContent value="stats">
            <DetectionStats stages={stages} totalFrames={ballTracking?.total_frames} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DetectionStats({ stages, totalFrames }: { stages?: any; totalFrames?: number }) {
  if (!stages) {
    return <p className="text-sm text-muted-foreground text-center py-4">No detection stats available.</p>;
  }

  const items = [
    { label: 'YOLO', count: stages.yolo || 0, color: 'bg-emerald-500' },
    { label: 'Motion', count: stages.motion || 0, color: 'bg-amber-400' },
    { label: 'Kalman', count: stages.kalman || 0, color: 'bg-red-400' },
    { label: 'Lost', count: stages.lost || 0, color: 'bg-muted-foreground/30' },
  ];

  const total = items.reduce((s, i) => s + i.count, 0) || 1;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-sm ${item.color}`} />
          <span className="text-sm w-16">{item.label}</span>
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${item.color} rounded-full`}
              style={{ width: `${(item.count / total) * 100}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground w-20 text-right">
            {item.count.toLocaleString()} ({((item.count / total) * 100).toFixed(1)}%)
          </span>
        </div>
      ))}
      {totalFrames && (
        <p className="text-xs text-muted-foreground pt-2 border-t">
          {totalFrames.toLocaleString()} total frames
        </p>
      )}
    </div>
  );
}
