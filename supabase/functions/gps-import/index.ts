import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Accepted CSV column name aliases for each GPS field
const FIELD_ALIASES: Record<string, string[]> = {
  player_name: ['player', 'athlete', 'name', 'player_name'],
  session_date: ['date', 'session_date', 'session date'],
  total_distance_m: ['total distance', 'total_distance', 'distance (m)', 'total_distance_m'],
  hsr_distance_m: ['hsr', 'high speed running', 'hsr_distance_m', 'hsr distance (m)'],
  sprint_distance_m: ['sprint distance', 'sprint_distance_m', 'sprint distance (m)'],
  max_speed_kmh: ['max speed', 'top speed', 'max_speed_kmh', 'max speed (km/h)'],
  accelerations: ['accelerations', 'accel', 'accel count'],
  decelerations: ['decelerations', 'decel', 'decel count'],
  player_load: ['player load', 'player_load', 'load'],
};

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[^a-z0-9 _]/g, '');
}

function detectColumn(headers: string[], field: string): number {
  const aliases = FIELD_ALIASES[field] ?? [field];
  for (let i = 0; i < headers.length; i++) {
    const h = normaliseHeader(headers[i]);
    if (aliases.some((a) => normaliseHeader(a) === h)) return i;
  }
  return -1;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const parse = (line: string) =>
    line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const teamId = formData.get('team_id') as string | null;

    if (!file) return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (!headers.length) {
      return new Response(JSON.stringify({ error: 'Could not parse CSV headers' }), { status: 422 });
    }

    // Detect column indices
    const cols: Record<string, number> = {};
    for (const field of Object.keys(FIELD_ALIASES)) {
      cols[field] = detectColumn(headers, field);
    }

    if (cols.player_name === -1 || cols.session_date === -1) {
      return new Response(
        JSON.stringify({ error: 'CSV must contain player name and session date columns', detected_headers: headers }),
        { status: 422 },
      );
    }

    // Load players for name matching
    let playerQuery = supabase.from('players').select('id, name');
    if (teamId) playerQuery = playerQuery.eq('team_id', teamId);
    const { data: players } = await playerQuery;
    const playerMap = new Map<string, string>();
    for (const p of players ?? []) playerMap.set(p.name.toLowerCase().trim(), p.id);

    const results = { matched: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      const rawName = row[cols.player_name] ?? '';
      const playerId = playerMap.get(rawName.toLowerCase().trim());
      if (!playerId) {
        results.skipped++;
        continue;
      }

      const sessionDate = row[cols.session_date];
      if (!sessionDate) { results.skipped++; continue; }

      const gpsPayload: Record<string, number | null> = {};
      const numericFields = [
        'total_distance_m', 'hsr_distance_m', 'sprint_distance_m',
        'max_speed_kmh', 'accelerations', 'decelerations', 'player_load',
      ];
      for (const f of numericFields) {
        const idx = cols[f];
        if (idx >= 0 && row[idx]) {
          const n = parseFloat(row[idx].replace(',', '.'));
          gpsPayload[f] = isNaN(n) ? null : n;
        }
      }

      // Upsert: match on player_id + session_date + source='gps'
      const { error } = await supabase.from('training_load').upsert(
        {
          player_id: playerId,
          session_date: sessionDate,
          source: 'gps',
          session_type: 'training',
          ...gpsPayload,
        },
        { onConflict: 'player_id,session_date,source', ignoreDuplicates: false },
      );

      if (error) {
        results.errors.push(`${rawName} @ ${sessionDate}: ${error.message}`);
      } else {
        results.matched++;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
