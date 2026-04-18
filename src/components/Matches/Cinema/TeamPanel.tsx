import { Shirt } from 'lucide-react';
import { PlayerTracksSummary } from '../PlayerTracksSummary';

interface TeamPanelProps {
  matchId: string;
  job: any;
}

export function TeamPanel({ matchId, job }: TeamPanelProps) {
  const playerTracks = job?.player_tracking_data || null;
  const tracksArray = Array.isArray(playerTracks)
    ? playerTracks
    : playerTracks
      ? Object.entries(playerTracks).map(([key, val]: [string, any]) => ({
          track_id: Number(key),
          ...val,
        }))
      : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shirt className="h-4 w-4" /> Team
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <PlayerTracksSummary
          tracks={tracksArray}
          playerMetrics={job?.player_metrics}
          matchId={matchId === 'demo' ? undefined : matchId}
        />
      </div>
    </div>
  );
}
