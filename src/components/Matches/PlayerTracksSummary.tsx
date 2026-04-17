import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PlayerTrack {
  track_id: number;
  duration_frames?: number;
  duration_seconds?: number;
  total_distance_px?: number;
  distance_px?: number;
  first_frame?: number;
  last_frame?: number;
}

interface PlayerMetric {
  passes?: number;
  passes_completed?: number;
  pass_success_pct?: number;
  shots?: number;
  tackles?: number;
  xg?: number;
  distance_m?: number;
  minutes_played?: number;
  contribution_score?: number;
  team?: string | null;
}

interface RealPlayer {
  id: string;
  name: string;
  squad_number: number | null;
}

interface PlayerTracksSummaryProps {
  tracks: PlayerTrack[] | null;
  fps?: number;
  playerMetrics?: Record<string, PlayerMetric> | null;
  matchId?: string;
}

export function PlayerTracksSummary({ tracks, fps = 30, playerMetrics, matchId }: PlayerTracksSummaryProps) {
  const [realPlayers, setRealPlayers] = useState<RealPlayer[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const [{ data: players }, { data: maps }] = await Promise.all([
        supabase.from('players').select('id, name, squad_number').order('squad_number'),
        supabase.from('track_player_mapping').select('track_id, player_id').eq('match_id', matchId),
      ]);
      setRealPlayers((players || []) as RealPlayer[]);
      const m: Record<number, string> = {};
      (maps || []).forEach((row: any) => { if (row.player_id) m[row.track_id] = row.player_id; });
      setMapping(m);
    })();
  }, [matchId]);

  const sorted = useMemo(() => {
    if (!tracks) return [];
    return [...tracks].sort((a, b) => {
      const ac = playerMetrics?.[String(a.track_id)]?.contribution_score || 0;
      const bc = playerMetrics?.[String(b.track_id)]?.contribution_score || 0;
      if (ac !== bc) return bc - ac;
      return (b.duration_seconds || 0) - (a.duration_seconds || 0);
    });
  }, [tracks, playerMetrics]);

  const setPlayerForTrack = async (trackId: number, playerId: string) => {
    if (!matchId) return;
    const value = playerId === '__none__' ? null : playerId;
    await supabase.from('track_player_mapping').upsert(
      { match_id: matchId, track_id: trackId, player_id: value },
      { onConflict: 'match_id,track_id' },
    );
    setMapping((prev) => {
      const next = { ...prev };
      if (value) next[trackId] = value; else delete next[trackId];
      return next;
    });
  };

  if (!tracks || tracks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No player tracking data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5" />
          Player Tracks ({tracks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Track</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Mapped Player</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Dist (m)</TableHead>
              <TableHead className="text-right">Passes</TableHead>
              <TableHead className="text-right">Shots</TableHead>
              <TableHead className="text-right">xG</TableHead>
              <TableHead className="text-right">Tackles</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.slice(0, 30).map((t) => {
              const pm = playerMetrics?.[String(t.track_id)];
              const seconds = t.duration_seconds ?? ((t.duration_frames || 0) / fps);
              const mins = (seconds / 60).toFixed(1);
              return (
                <TableRow key={t.track_id}>
                  <TableCell className="font-mono text-xs">#{t.track_id}</TableCell>
                  <TableCell>{pm?.team ? <Badge variant="secondary">{pm.team}</Badge> : '—'}</TableCell>
                  <TableCell>
                    {matchId ? (
                      <Select
                        value={mapping[t.track_id] || '__none__'}
                        onValueChange={(v) => setPlayerForTrack(t.track_id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs w-40">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {realPlayers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.squad_number ? `#${p.squad_number} ` : ''}{p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right">{mins}</TableCell>
                  <TableCell className="text-right">{pm?.distance_m ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {pm ? `${pm.passes_completed || 0}/${pm.passes || 0}` : '—'}
                  </TableCell>
                  <TableCell className="text-right">{pm?.shots ?? '—'}</TableCell>
                  <TableCell className="text-right">{pm?.xg !== undefined ? pm.xg.toFixed(2) : '—'}</TableCell>
                  <TableCell className="text-right">{pm?.tackles ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">{pm?.contribution_score ?? '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {sorted.length > 30 && (
          <p className="text-xs text-muted-foreground mt-2">Showing top 30 of {sorted.length} tracks</p>
        )}
      </CardContent>
    </Card>
  );
}
