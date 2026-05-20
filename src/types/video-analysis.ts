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
  // Touch breakdown — populated by TouchTracker in the analysis pipeline
  touches?: number;           // alias for touches_total (backward compat)
  touches_total?: number;
  touches_receive?: number;   // first contact receiving an inbound ball
  touches_control?: number;   // settling / turning with the ball
  touches_pass?: number;      // the kick/release itself on a pass
  touches_shot?: number;      // outbound contacts at shot velocity (≥12 m/s)
  touches_dribble?: number;   // dribble contacts sampled every 1.5s to cap counts
  // Pass direction breakdown — populated by PassAnalyser
  passes_attempted?: number;
  passes_completed_count?: number;  // renamed to avoid conflict with passes_completed pct field
  pass_accuracy?: number;           // 0–100
  passes_forward?: number;
  passes_sideways?: number;
  passes_back?: number;
  // Cross-session identity — populated by JerseyNumberTracker
  jersey_number?: number | null;
  player_name?: string | null;
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
  // Touch totals — populated by TouchTracker
  total_touches?: number;
  touches_per_type?: {
    receive: number;
    control: number;
    pass: number;
    shot: number;
    dribble: number;
  };
  // Pass direction breakdown — populated by PassAnalyser
  pass_attempts?: number;
  pass_completions?: number;
  pass_accuracy_pct?: number;
  passes_forward?: number;
  passes_sideways?: number;
  passes_back?: number;
}

export interface PassNetworkNode {
  track_id: number;
  avg_x: number;   // normalised 0–1 (left → right)
  avg_y: number;   // normalised 0–1 (top → bottom)
  pass_count: number;
  jersey_number?: number | null;
  player_name?: string | null;
}

export interface PassNetworkEdge {
  from: number;   // track_id
  to: number;     // track_id
  count: number;
  direction: 'forward' | 'sideways' | 'back';
}

export interface PassNetwork {
  nodes: PassNetworkNode[];
  edges: PassNetworkEdge[];
}

export interface TeamPassStats {
  pass_attempts: number;
  pass_completions: number;
  pass_accuracy_pct: number;
  passes_forward: number;
  passes_sideways: number;
  passes_back: number;
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
  home_pass_network?: PassNetwork;   // Team A pass network
  away_pass_network?: PassNetwork;   // Team B pass network
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
