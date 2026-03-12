import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';

interface PlayerTrack {
  track_id: number;
  duration_frames?: number;
  distance_px?: number;
  first_frame?: number;
  last_frame?: number;
}

interface PlayerTracksSummaryProps {
  tracks: PlayerTrack[] | null;
  fps?: number;
}

export function PlayerTracksSummary({ tracks, fps = 30 }: PlayerTracksSummaryProps) {
  if (!tracks || tracks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No player tracking data available yet.
        </CardContent>
      </Card>
    );
  }

  const sorted = [...tracks].sort((a, b) => (b.duration_frames || 0) - (a.duration_frames || 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5" />
          Player Tracks ({tracks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Track ID</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Distance (px)</TableHead>
              <TableHead>Frame Range</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.slice(0, 30).map((t) => {
              const durationSec = (t.duration_frames || 0) / fps;
              const mins = Math.floor(durationSec / 60);
              const secs = Math.floor(durationSec % 60);
              return (
                <TableRow key={t.track_id}>
                  <TableCell className="font-mono">#{t.track_id}</TableCell>
                  <TableCell>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</TableCell>
                  <TableCell>{(t.distance_px || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {t.first_frame ?? '?'} – {t.last_frame ?? '?'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {sorted.length > 30 && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing top 30 of {sorted.length} tracks
          </p>
        )}
      </CardContent>
    </Card>
  );
}
