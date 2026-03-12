import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BallTrackingData {
  detection_stages?: {
    yolo?: number;
    motion?: number;
    kalman?: number;
    lost?: number;
  };
  total_frames?: number;
}

interface EventData {
  play_switch_events?: Array<{
    frame: number;
    speed: number;
  }>;
}

interface VideoTimelineProps {
  ballTracking: BallTrackingData | null;
  events: EventData | null;
}

export function VideoTimeline({ ballTracking, events }: VideoTimelineProps) {
  const stages = ballTracking?.detection_stages;
  const totalFrames = ballTracking?.total_frames || 0;
  const switchEvents = events?.play_switch_events || [];

  if (!stages || totalFrames === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No ball tracking data available yet.
        </CardContent>
      </Card>
    );
  }

  const yoloPct = ((stages.yolo || 0) / totalFrames * 100).toFixed(1);
  const motionPct = ((stages.motion || 0) / totalFrames * 100).toFixed(1);
  const kalmanPct = ((stages.kalman || 0) / totalFrames * 100).toFixed(1);
  const lostPct = ((stages.lost || 0) / totalFrames * 100).toFixed(1);

  const total = (stages.yolo || 0) + (stages.motion || 0) + (stages.kalman || 0) + (stages.lost || 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ball Detection Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked bar */}
        <div className="w-full h-6 rounded-full overflow-hidden flex bg-muted">
          {(stages.yolo || 0) > 0 && (
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(stages.yolo || 0) / total * 100}%` }}
              title={`YOLO: ${yoloPct}%`}
            />
          )}
          {(stages.motion || 0) > 0 && (
            <div
              className="h-full bg-amber-400"
              style={{ width: `${(stages.motion || 0) / total * 100}%` }}
              title={`Motion: ${motionPct}%`}
            />
          )}
          {(stages.kalman || 0) > 0 && (
            <div
              className="h-full bg-red-400"
              style={{ width: `${(stages.kalman || 0) / total * 100}%` }}
              title={`Kalman: ${kalmanPct}%`}
            />
          )}
          {(stages.lost || 0) > 0 && (
            <div
              className="h-full bg-muted-foreground/30"
              style={{ width: `${(stages.lost || 0) / total * 100}%` }}
              title={`Lost: ${lostPct}%`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span>YOLO {yoloPct}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <span>Motion {motionPct}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-400" />
            <span>Kalman {kalmanPct}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
            <span>Lost {lostPct}%</span>
          </div>
        </div>

        {/* Play switch events */}
        {switchEvents.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Play Switches</p>
            <div className="flex flex-wrap gap-1.5">
              {switchEvents.map((evt, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  Frame {evt.frame} — {evt.speed?.toFixed(0)}px/f
                </Badge>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {totalFrames.toLocaleString()} total frames processed
        </p>
      </CardContent>
    </Card>
  );
}
