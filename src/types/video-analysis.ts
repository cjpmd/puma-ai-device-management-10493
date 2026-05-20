export interface CvEvent {
  time: number;
  type: string;
  player_track_id?: number;
  team?: string | null;
  outcome?: string;
  confidence?: number;
  position?: [number, number];
  speed?: number;
  xg?: number;
}

export interface CoachTag {
  id: string;
  time: number; // seconds from recording start
  type: string; // goal | yellow_card | red_card | substitution | key_moment | foul | corner | penalty
  notes?: string;
  tagged_by?: string;
}

export type TimelineEventSource = 'cv' | 'coach';

export interface TimelineEvent {
  time: number;
  type: string;
  source: TimelineEventSource;
  player_track_id?: number;
  team?: string | null;
  outcome?: string;
  notes?: string;
  tagged_by?: string;
  id?: string;
  xg?: number;
}

export interface HeatmapData {
  grid_w: number;
  grid_h: number;
  cells: Array<[number, number, number]>; // [gx, gy, count]
}

export interface PlayerMetrics {
  track_id?: number;
  team?: string | null;
  distance_m?: number;
  top_speed_kmh?: number;
  sprints?: number;
  minutes_played?: number;
  passes?: number;
  passes_completed?: number;
  pass_success_pct?: number;
  shots?: number;
  tackles?: number;
  xg?: number;
  contribution_score?: number;
}

export interface TeamMetrics {
  passes?: number;
  passes_completed?: number;
  pass_success_pct?: number;
  shots?: number;
  tackles?: number;
  possession_changes?: number;
  possession_pct?: number;
  xg?: number;
}

export interface BallTrackingData {
  positions: Array<{ time: number; x: number; y: number }>;
}

export interface VideoSegment {
  start: number;
  end: number;
  label?: string;
  player_track_id?: number;
  event_type?: string;
}

export interface ProcessingJobResult {
  events?: CvEvent[];
  player_metrics?: Record<string, PlayerMetrics>;
  team_stats?: Record<string, TeamMetrics>;
  ball_tracking?: BallTrackingData;
  heatmaps?: Record<string, HeatmapData>;
  output_video_path?: string;
  stitched_video_path?: string;
  duration_seconds?: number;
}

export interface ProcessingJob {
  id: string;
  match_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  output_video_path?: string;
  event_data?: { events: CvEvent[] };
  player_metrics?: Record<string, PlayerMetrics>;
  heatmaps?: Record<string, HeatmapData>;
  error_message?: string;
}
