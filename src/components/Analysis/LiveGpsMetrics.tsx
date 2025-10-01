import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Gauge, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { processLiveGpsData, MovementAnalytics } from '@/services/movementAnalytics';

interface LiveGpsMetricsProps {
  playerId: string;
  sessionId: string;
  isLive?: boolean;
}

const LiveGpsMetrics: React.FC<LiveGpsMetricsProps> = ({
  playerId,
  sessionId,
  isLive = false,
}) => {
  const [analytics, setAnalytics] = useState<MovementAnalytics | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!isLive) return;

    // Fetch initial analytics
    const fetchAnalytics = async () => {
      const data = await processLiveGpsData(playerId, sessionId);
      if (data) setAnalytics(data);
    };

    fetchAnalytics();

    // Set up real-time updates
    const channel = supabase
      .channel('live_gps_metrics')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gps_tracking',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          setCurrentSpeed(newData.speed ? Number(newData.speed) : 0);
          setCurrentPosition({
            lat: Number(newData.latitude),
            lon: Number(newData.longitude),
          });
          // Refresh analytics
          fetchAnalytics();
        }
      )
      .subscribe();

    // Periodic refresh
    const interval = setInterval(fetchAnalytics, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [playerId, sessionId, isLive]);

  if (!analytics && !isLive) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No GPS data available</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {isLive && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Current Speed</h3>
            <Badge variant={currentSpeed > 5 ? 'default' : 'secondary'}>
              {isLive ? 'LIVE' : 'Historical'}
            </Badge>
          </div>
          <p className="text-3xl font-bold">
            {currentSpeed.toFixed(1)} <span className="text-lg text-muted-foreground">m/s</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {(currentSpeed * 3.6).toFixed(1)} km/h
          </p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Distance</h3>
        </div>
        <p className="text-3xl font-bold">
          {analytics ? (analytics.totalDistance / 1000).toFixed(2) : '0.00'}{' '}
          <span className="text-lg text-muted-foreground">km</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {analytics ? analytics.totalDistance.toFixed(0) : '0'} meters
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Sprints</h3>
        </div>
        <p className="text-3xl font-bold">{analytics?.sprintCount || 0}</p>
        <p className="text-sm text-muted-foreground">
          Top: {analytics ? (analytics.topSpeed * 3.6).toFixed(1) : '0'} km/h
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Avg Speed</h3>
        </div>
        <p className="text-3xl font-bold">
          {analytics ? (analytics.avgSpeed * 3.6).toFixed(1) : '0'}{' '}
          <span className="text-lg text-muted-foreground">km/h</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {analytics ? analytics.avgSpeed.toFixed(1) : '0'} m/s
        </p>
      </Card>

      {isLive && currentPosition && (
        <Card className="p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Current Position</h3>
          </div>
          <p className="text-sm font-mono">
            {currentPosition.lat.toFixed(6)}, {currentPosition.lon.toFixed(6)}
          </p>
        </Card>
      )}

      {analytics && (analytics.timeInDefensiveThird > 0 || analytics.timeInMiddleThird > 0 || analytics.timeInAttackingThird > 0) && (
        <Card className="p-4 md:col-span-2">
          <h3 className="font-semibold mb-2">Time by Pitch Third</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Defensive:</span>
              <span className="font-semibold">{(analytics.timeInDefensiveThird / 60).toFixed(1)} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Middle:</span>
              <span className="font-semibold">{(analytics.timeInMiddleThird / 60).toFixed(1)} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Attacking:</span>
              <span className="font-semibold">{(analytics.timeInAttackingThird / 60).toFixed(1)} min</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default LiveGpsMetrics;
