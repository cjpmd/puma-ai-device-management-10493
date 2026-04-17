import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoTimeline } from './VideoTimeline';
import { PlayerTracksSummary } from './PlayerTracksSummary';
import { HeatmapOverlay } from './HeatmapOverlay';
import { AIInsightsPanel } from './AIInsightsPanel';
import { BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MatchAnalyticsDashboardProps {
  matchId: string;
  job: {
    player_tracking_data?: any;
    ball_tracking_data?: any;
    event_data?: any;
    team_metrics?: any;
    player_metrics?: any;
    heatmaps?: any;
    divergence_metrics?: any;
  };
}

export function MatchAnalyticsDashboard({ matchId, job }: MatchAnalyticsDashboardProps) {
  const ballTracking = job.ball_tracking_data || null;
  const playerTracks = job.player_tracking_data || null;
  const events = job.event_data || null;
  const teamMetrics = job.team_metrics || null;
  const playerMetrics = job.player_metrics || null;
  const heatmaps = job.heatmaps || null;
  const divergence = job.divergence_metrics || null;

  const hasData = ballTracking || playerTracks || events || teamMetrics;
  if (!hasData) return null;

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
        <Tabs defaultValue="stats">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="stats">Match Stats</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="heatmaps">Heatmaps</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
            <TabsTrigger value="detection">Detection</TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            <MatchStatsView teamMetrics={teamMetrics} divergence={divergence} />
          </TabsContent>

          <TabsContent value="timeline">
            <VideoTimeline ballTracking={ballTracking} events={events} />
          </TabsContent>

          <TabsContent value="players">
            <PlayerTracksSummary tracks={tracksArray} playerMetrics={playerMetrics} matchId={matchId} />
          </TabsContent>

          <TabsContent value="heatmaps">
            <HeatmapTab heatmaps={heatmaps} playerMetrics={playerMetrics} />
          </TabsContent>

          <TabsContent value="insights">
            <AIInsightsPanel matchId={matchId} />
          </TabsContent>

          <TabsContent value="detection">
            <DetectionStats stages={stages} totalFrames={ballTracking?.total_frames} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function MatchStatsView({ teamMetrics, divergence }: { teamMetrics: any; divergence: any }) {
  if (!teamMetrics) {
    return <p className="text-sm text-muted-foreground text-center py-6">No team metrics available yet.</p>;
  }

  const teams = ['A', 'B'] as const;
  const chartData = teams.map((t) => ({
    team: `Team ${t}`,
    Possession: teamMetrics[t]?.possession_pct || 0,
    Shots: teamMetrics[t]?.shots || 0,
    xG: teamMetrics[t]?.xg || 0,
    'Pass %': teamMetrics[t]?.pass_success_pct || 0,
  }));

  const teamColors = ['hsl(var(--primary))', 'hsl(var(--destructive))'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {teams.map((t, idx) => (
          <Card key={t} style={{ borderColor: teamColors[idx] }}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Team {t}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1">
              <Stat label="Possession" value={`${teamMetrics[t]?.possession_pct || 0}%`} />
              <Stat label="Shots" value={teamMetrics[t]?.shots || 0} />
              <Stat label="xG" value={(teamMetrics[t]?.xg || 0).toFixed(2)} />
              <Stat label="Passes" value={`${teamMetrics[t]?.passes_completed || 0}/${teamMetrics[t]?.passes || 0}`} />
              <Stat label="Tackles" value={teamMetrics[t]?.tackles || 0} />
              {divergence?.[t]?.dominance_score !== undefined && (
                <Stat label="Dominance" value={divergence[t].dominance_score} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="team" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
            <Bar dataKey="Possession" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Shots" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="xG" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} />)}
            </Bar>
            <Bar dataKey="Pass %" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function HeatmapTab({ heatmaps, playerMetrics }: { heatmaps: any; playerMetrics: any }) {
  const trackIds = useMemo(() => heatmaps ? Object.keys(heatmaps) : [], [heatmaps]);
  const [selected, setSelected] = useState<string | null>(trackIds[0] || null);

  if (!heatmaps || trackIds.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No heatmap data available.</p>;
  }

  const current = selected || trackIds[0];
  const data = heatmaps[current];
  const meta = playerMetrics?.[current];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Player:</span>
        <Select value={current} onValueChange={setSelected}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {trackIds.map((tid) => (
              <SelectItem key={tid} value={tid}>
                Track #{tid} {playerMetrics?.[tid]?.team ? `(Team ${playerMetrics[tid].team})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {meta && (
          <span className="text-xs text-muted-foreground">
            {meta.distance_m}m · {meta.minutes_played}min
          </span>
        )}
      </div>
      <HeatmapOverlay data={data} />
    </div>
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
            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${(item.count / total) * 100}%` }} />
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
