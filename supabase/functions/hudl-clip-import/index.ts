import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface HudlClipPayload {
  hudl_url: string;
  player_id: string;
  title?: string;
  tags?: string[];
  match_date?: string;
  description?: string;
}

// Validates that the URL is a genuine Hudl domain to prevent SSRF / spoofing
function isValidHudlUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'www.hudl.com' ||
      parsed.hostname === 'hudl.com' ||
      parsed.hostname.endsWith('.hudl.com')
    );
  } catch {
    return false;
  }
}

// Extract Hudl clip ID from URL patterns like:
//   https://www.hudl.com/video/{id}
//   https://www.hudl.com/play/{team}/{id}
function extractClipId(url: string): string | null {
  const patterns = [
    /\/video\/([a-zA-Z0-9_-]+)/,
    /\/play\/[^/]+\/([a-zA-Z0-9_-]+)/,
    /\/highlights\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body: HudlClipPayload = await req.json();
    const { hudl_url, player_id, title, tags, match_date, description } = body;

    if (!hudl_url || !player_id) {
      return new Response(
        JSON.stringify({ error: 'hudl_url and player_id are required' }),
        { status: 400 },
      );
    }

    if (!isValidHudlUrl(hudl_url)) {
      return new Response(
        JSON.stringify({ error: 'URL must be a valid hudl.com link' }),
        { status: 422 },
      );
    }

    // Verify player exists
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .select('id, name')
      .eq('id', player_id)
      .maybeSingle();

    if (playerErr || !player) {
      return new Response(JSON.stringify({ error: 'Player not found' }), { status: 404 });
    }

    const clipId = extractClipId(hudl_url);

    // Deduplicate by external_id (clip ID)
    if (clipId) {
      const { data: existing } = await supabase
        .from('video_clip')
        .select('id')
        .eq('external_id', clipId)
        .eq('player_id', player_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, id: existing.id, duplicate: true }),
          { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
        );
      }
    }

    const { data: clip, error: insertErr } = await supabase
      .from('video_clip')
      .insert({
        player_id,
        source: 'hudl',
        external_id: clipId,
        url: hudl_url,
        title: title ?? `Hudl clip — ${player.name}`,
        tags: tags ?? [],
        clip_date: match_date ?? null,
        description: description ?? null,
      })
      .select('id')
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ success: true, id: clip.id, player_name: player.name }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
