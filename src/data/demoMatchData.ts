// Demo fixture for the Match Analytics dashboard so coaches can preview the UI
// without needing to upload and process a real match.

const SAMPLE_VIDEO_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

// Build ~40 realistic events spread across 90 minutes
function buildEvents() {
  const events: Array<{
    time: number;
    type: 'pass' | 'shot' | 'tackle' | 'possession_change';
    player_track_id: number;
    team: 'A' | 'B';
    outcome?: string;
  }> = [];
  const types: Array<'pass' | 'shot' | 'tackle' | 'possession_change'> = [
    'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'tackle', 'possession_change', 'shot',
  ];
  const playersA = [1, 2, 3, 4, 5, 6, 7];
  const playersB = [8, 9, 10, 11, 12, 13, 14];
  let t = 12;
  for (let i = 0; i < 42; i++) {
    const type = types[i % types.length];
    const teamA = i % 2 === 0;
    const pool = teamA ? playersA : playersB;
    const tid = pool[i % pool.length];
    const outcome = type === 'pass'
      ? (i % 5 === 0 ? 'incomplete' : 'complete')
      : type === 'shot'
        ? (i % 11 === 0 ? 'goal' : i % 3 === 0 ? 'on_target' : 'off_target')
        : undefined;
    events.push({
      time: Math.round(t * 10) / 10,
      type,
      player_track_id: tid,
      team: teamA ? 'A' : 'B',
      outcome,
    });
    t += 1.5 + Math.random() * 130;
  }
  return events;
}

// Sparse 20×12 heatmap intensities for a few players
function buildHeatmap(centerX: number, centerY: number, spread = 3): Array<[number, number, number]> {
  const cells: Array<[number, number, number]> = [];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 20; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const intensity = Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread));
      if (intensity > 0.08) cells.push([x, y, Math.round(intensity * 100) / 100]);
    }
  }
  return cells;
}

const events = buildEvents();

const playerMetrics: Record<string, any> = {
  '1':  { team: 'A', passes: 38, passes_completed: 32, pass_success_pct: 84, shots: 1, tackles: 4, xg: 0.18, distance_m: 8420, minutes_played: 89, contribution_score: 76 },
  '2':  { team: 'A', passes: 24, passes_completed: 18, pass_success_pct: 75, shots: 0, tackles: 6, xg: 0.02, distance_m: 7990, minutes_played: 89, contribution_score: 58 },
  '3':  { team: 'A', passes: 41, passes_completed: 36, pass_success_pct: 88, shots: 3, tackles: 2, xg: 0.62, distance_m: 9120, minutes_played: 89, contribution_score: 91 },
  '4':  { team: 'A', passes: 19, passes_completed: 14, pass_success_pct: 74, shots: 4, tackles: 1, xg: 0.74, distance_m: 8650, minutes_played: 89, contribution_score: 82 },
  '5':  { team: 'A', passes: 27, passes_completed: 22, pass_success_pct: 81, shots: 1, tackles: 3, xg: 0.12, distance_m: 7430, minutes_played: 75, contribution_score: 54 },
  '6':  { team: 'A', passes: 22, passes_completed: 17, pass_success_pct: 77, shots: 0, tackles: 5, xg: 0.04, distance_m: 8210, minutes_played: 89, contribution_score: 49 },
  '7':  { team: 'A', passes: 15, passes_completed: 12, pass_success_pct: 80, shots: 2, tackles: 2, xg: 0.31, distance_m: 6980, minutes_played: 62, contribution_score: 47 },
  '8':  { team: 'B', passes: 31, passes_completed: 23, pass_success_pct: 74, shots: 0, tackles: 5, xg: 0.03, distance_m: 8240, minutes_played: 89, contribution_score: 52 },
  '9':  { team: 'B', passes: 26, passes_completed: 19, pass_success_pct: 73, shots: 2, tackles: 3, xg: 0.28, distance_m: 8620, minutes_played: 89, contribution_score: 61 },
  '10': { team: 'B', passes: 18, passes_completed: 12, pass_success_pct: 67, shots: 3, tackles: 1, xg: 0.41, distance_m: 8910, minutes_played: 89, contribution_score: 68 },
  '11': { team: 'B', passes: 22, passes_completed: 14, pass_success_pct: 64, shots: 1, tackles: 2, xg: 0.09, distance_m: 7560, minutes_played: 80, contribution_score: 41 },
  '12': { team: 'B', passes: 14, passes_completed: 9,  pass_success_pct: 64, shots: 0, tackles: 7, xg: 0.01, distance_m: 8120, minutes_played: 89, contribution_score: 44 },
  '13': { team: 'B', passes: 19, passes_completed: 13, pass_success_pct: 68, shots: 0, tackles: 4, xg: 0.02, distance_m: 7780, minutes_played: 89, contribution_score: 38 },
  '14': { team: 'B', passes: 11, passes_completed: 7,  pass_success_pct: 64, shots: 0, tackles: 2, xg: 0.00, distance_m: 5240, minutes_played: 45, contribution_score: 22 },
};

const playerTrackingData = Object.entries(playerMetrics).map(([id, m]) => ({
  track_id: Number(id),
  duration_seconds: (m.minutes_played as number) * 60,
  duration_frames: (m.minutes_played as number) * 60 * 30,
  total_distance_px: (m.distance_m as number) * 12,
  first_frame: 0,
  last_frame: (m.minutes_played as number) * 60 * 30,
}));

const heatmaps: Record<string, Array<[number, number, number]>> = {
  '1':  buildHeatmap(2, 6, 2),    // GK A
  '3':  buildHeatmap(8, 5, 3.5),  // Mid A
  '4':  buildHeatmap(14, 6, 3),   // Striker A
  '5':  buildHeatmap(9, 8, 3),    // Wide A
  '8':  buildHeatmap(18, 6, 2),   // GK B
  '10': buildHeatmap(11, 6, 3.5), // Mid B
  '12': buildHeatmap(5, 7, 3),    // Defender B
};

const teamMetrics = {
  A: { possession_pct: 58, passes: 186, passes_completed: 151, pass_success_pct: 81, shots: 12, shots_on_target: 5, xg: 1.83, tackles: 23, goals: 2 },
  B: { possession_pct: 42, passes: 141, passes_completed: 97,  pass_success_pct: 69, shots: 6,  shots_on_target: 2, xg: 0.86, tackles: 24, goals: 1 },
};

const divergenceMetrics = {
  A: {
    goals_vs_xg: +0.17,
    shot_efficiency: 41.7,
    possession_vs_chances: 'high_conversion',
    dominance_score: 72,
  },
  B: {
    goals_vs_xg: +0.14,
    shot_efficiency: 33.3,
    possession_vs_chances: 'low_volume',
    dominance_score: 38,
  },
};

const ballTrackingData = {
  total_frames: 162000,
  detection_stages: { yolo: 138420, motion: 14280, kalman: 6840, lost: 2460 },
  play_switches: events
    .filter(e => e.type === 'possession_change')
    .map(e => ({ time: e.time, from_track: e.player_track_id, to_track: e.player_track_id + 1 })),
};

export const demoMatchInsights = {
  status: 'complete' as const,
  summary:
    "Team A controlled the match through midfield possession (58%) and converted their territorial dominance into a 2-1 victory. Track #3 dictated the tempo from central midfield, while #4 was clinical with an xG of 0.74 from four shots. Team B were resilient defensively but struggled to build sustained attacks, completing only 69% of their passes under sustained pressure.",
  team_strengths: [
    'High pass completion under pressure (81%) created consistent attacking platforms',
    'Effective use of width by #5 and #7 stretched the opposition back line',
    'Strong defensive recovery — #2 and #6 combined for 11 successful tackles',
  ],
  team_weaknesses: [
    'Shot conversion below xG in the second half — 4 high-quality chances missed',
    'Vulnerable to direct counter-attacks down the right flank in transition',
    'Set-piece delivery quality dropped after the 60th minute',
  ],
  top_performers: [
    { track_id: 3, reason: 'Highest contribution score (91). 36/41 passes completed and orchestrated 7 of the 12 shot-creating sequences.' },
    { track_id: 4, reason: 'Clinical finishing — 4 shots for 0.74 xG, scored 1 and forced 2 saves.' },
    { track_id: 1, reason: 'Played out from the back successfully under high press; 84% pass accuracy from goalkeeper.' },
  ],
  coaching_focus: [
    'Train shot quality finishing drills — convert high-xG chances at a higher rate',
    'Drill defensive shape during transition moments, especially right-back coverage when #5 advances',
  ],
  error: null,
};

export const demoMatchJob = {
  id: 'demo-job',
  match_id: 'demo',
  status: 'complete',
  output_video_path: 'demo/sample.mp4',
  output_video_url: SAMPLE_VIDEO_URL,
  output_highlights_path: null,
  ball_tracking_data: ballTrackingData,
  player_tracking_data: playerTrackingData,
  event_data: { events },
  team_metrics: teamMetrics,
  player_metrics: playerMetrics,
  heatmaps,
  divergence_metrics: divergenceMetrics,
};

export const demoMatch = {
  id: 'demo',
  title: 'Demo Match · Lions FC vs Eagles United',
  match_date: new Date().toISOString().slice(0, 10),
  location: 'Hackney Marshes',
  status: 'complete',
};

export const DEMO_VIDEO_URL = SAMPLE_VIDEO_URL;
