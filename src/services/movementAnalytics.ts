/**
 * Movement Analytics Service
 * Real-time processing of GPS data for player movement analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateDistance, getPitchThird, PitchCalibration } from './gpsConversion';

export interface GpsDataPoint {
  latitude: number;
  longitude: number;
  speed?: number;
  timestamp: string;
  accuracy?: number;
}

export interface Sprint {
  startTime: number;
  endTime: number;
  maxSpeed: number;
  distance: number;
}

export interface MovementAnalytics {
  totalDistance: number;
  sprintCount: number;
  topSpeed: number;
  avgSpeed: number;
  timeInDefensiveThird: number;
  timeInMiddleThird: number;
  timeInAttackingThird: number;
}

/**
 * Detect sprints from GPS data
 * Sprint threshold: 5.5 m/s (~20 km/h)
 */
export const detectSprints = (
  gpsData: Array<{ speed?: number; timestamp: string }>
): Sprint[] => {
  const SPRINT_THRESHOLD = 5.5; // m/s
  const MIN_SPRINT_DURATION = 1000; // 1 second

  const sprints: Sprint[] = [];
  let currentSprint: Partial<Sprint> | null = null;
  let sprintPoints: Array<{ speed: number; timestamp: string }> = [];

  gpsData.forEach((point) => {
    const speed = point.speed || 0;
    const timestamp = new Date(point.timestamp).getTime();

    if (speed >= SPRINT_THRESHOLD) {
      if (!currentSprint) {
        currentSprint = {
          startTime: timestamp,
          maxSpeed: speed,
        };
        sprintPoints = [{ speed, timestamp: point.timestamp }];
      } else {
        currentSprint.maxSpeed = Math.max(currentSprint.maxSpeed!, speed);
        sprintPoints.push({ speed, timestamp: point.timestamp });
      }
    } else if (currentSprint) {
      currentSprint.endTime = timestamp;
      
      if (currentSprint.endTime - currentSprint.startTime! >= MIN_SPRINT_DURATION) {
        // Calculate sprint distance
        const sprintDistance = sprintPoints.reduce((sum, p, i) => {
          if (i === 0) return 0;
          const timeDiff = (new Date(p.timestamp).getTime() - new Date(sprintPoints[i - 1].timestamp).getTime()) / 1000;
          return sum + (p.speed * timeDiff);
        }, 0);

        sprints.push({
          startTime: currentSprint.startTime!,
          endTime: currentSprint.endTime,
          maxSpeed: currentSprint.maxSpeed!,
          distance: sprintDistance,
        });
      }
      currentSprint = null;
      sprintPoints = [];
    }
  });

  return sprints;
};

/**
 * Generate heatmap data from GPS coordinates
 */
export const generateHeatmap = (
  gpsData: Array<{ x: number; y: number }>,
  gridSize: number = 20
): number[][] => {
  const PITCH_LENGTH = 105; // Standard pitch length
  const PITCH_WIDTH = 68; // Standard pitch width

  const heatmap = Array(gridSize)
    .fill(0)
    .map(() => Array(gridSize).fill(0));

  gpsData.forEach((point) => {
    const gridX = Math.floor((point.x / PITCH_LENGTH) * gridSize);
    const gridY = Math.floor((point.y / PITCH_WIDTH) * gridSize);
    
    if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
      heatmap[gridY][gridX]++;
    }
  });

  return heatmap;
};

/**
 * Calculate time spent in each third of the pitch
 */
export const calculateThirdTimes = (
  gpsData: Array<{ x: number; timestamp: string }>,
  pitchLength: number
): { defensive: number; middle: number; attacking: number } => {
  const times = {
    defensive: 0,
    middle: 0,
    attacking: 0,
  };

  for (let i = 1; i < gpsData.length; i++) {
    const timeDiff = (new Date(gpsData[i].timestamp).getTime() - new Date(gpsData[i - 1].timestamp).getTime()) / 1000;
    const third = getPitchThird(gpsData[i].x, pitchLength);
    times[third] += timeDiff;
  }

  return times;
};

/**
 * Process live GPS data and update analytics in real-time
 */
export const processLiveGpsData = async (
  playerId: string,
  sessionId: string,
  calibration?: PitchCalibration
): Promise<MovementAnalytics | null> => {
  try {
    // Fetch recent GPS data (last 60 seconds)
    const { data: gpsData, error } = await supabase
      .from('gps_tracking')
      .select('*')
      .eq('player_id', playerId)
      .eq('session_id', sessionId)
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())
      .order('timestamp', { ascending: true });

    if (error) throw error;
    if (!gpsData || gpsData.length === 0) return null;

    // Calculate distance
    const distance = calculateDistance(
      gpsData.map((d) => ({ lat: Number(d.latitude), lon: Number(d.longitude) }))
    );

    // Detect sprints
    const sprints = detectSprints(
      gpsData.map((d) => ({ speed: d.speed ? Number(d.speed) : undefined, timestamp: d.timestamp }))
    );

    // Calculate speeds
    const speeds = gpsData.filter(d => d.speed).map(d => Number(d.speed));
    const topSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

    // Calculate time in each third (if calibration available)
    let thirdTimes = { defensive: 0, middle: 0, attacking: 0 };
    if (calibration) {
      // Would need pitch coordinates - simplified for now
      const pitchLength = calibration.dimensions.length;
      // This is a placeholder - actual implementation would convert GPS to pitch coords
      thirdTimes = { defensive: 0, middle: 0, attacking: 0 };
    }

    const analytics: MovementAnalytics = {
      totalDistance: distance,
      sprintCount: sprints.length,
      topSpeed,
      avgSpeed,
      timeInDefensiveThird: thirdTimes.defensive,
      timeInMiddleThird: thirdTimes.middle,
      timeInAttackingThird: thirdTimes.attacking,
    };

    // Update database
    await supabase.from('movement_analytics').upsert({
      player_id: playerId,
      session_id: sessionId,
      total_distance: analytics.totalDistance,
      sprint_count: analytics.sprintCount,
      top_speed: analytics.topSpeed,
      avg_speed: analytics.avgSpeed,
      time_in_defensive_third: analytics.timeInDefensiveThird,
      time_in_middle_third: analytics.timeInMiddleThird,
      time_in_attacking_third: analytics.timeInAttackingThird,
      timestamp: new Date().toISOString(),
    });

    return analytics;
  } catch (error) {
    console.error('Error processing live GPS data:', error);
    return null;
  }
};

/**
 * Fetch analytics for a completed session
 */
export const getSessionAnalytics = async (
  playerId: string,
  sessionId: string
): Promise<MovementAnalytics | null> => {
  try {
    const { data, error } = await supabase
      .from('movement_analytics')
      .select('*')
      .eq('player_id', playerId)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      totalDistance: Number(data.total_distance),
      sprintCount: Number(data.sprint_count),
      topSpeed: Number(data.top_speed),
      avgSpeed: Number(data.avg_speed),
      timeInDefensiveThird: Number(data.time_in_defensive_third),
      timeInMiddleThird: Number(data.time_in_middle_third),
      timeInAttackingThird: Number(data.time_in_attacking_third),
    };
  } catch (error) {
    console.error('Error fetching session analytics:', error);
    return null;
  }
};
