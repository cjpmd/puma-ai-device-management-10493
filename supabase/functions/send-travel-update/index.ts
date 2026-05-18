// TODO: implement push-notification / email delivery for travel updates.
// This stub saves the record and marks sent_push=true; replace the body
// with real FCM / email logic when ready.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { travel_update_id, travel_event_id } = await req.json();

    if (!travel_update_id || !travel_event_id) {
      return new Response(
        JSON.stringify({ error: 'travel_update_id and travel_event_id are required' }),
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch the update so we know title / body / target_squads for delivery
    const { data: update, error: fetchErr } = await admin
      .from('travel_update')
      .select('id, title, body, update_type, target_squads, travel_event_id')
      .eq('id', travel_update_id)
      .single();

    if (fetchErr || !update) {
      return new Response(
        JSON.stringify({ error: fetchErr?.message ?? 'Update not found' }),
        { status: 404, headers: corsHeaders },
      );
    }

    // TODO: resolve parent device tokens / emails for target_squads and
    //       dispatch via your push/email provider (FCM, APNs, Resend, etc.).
    console.log(
      `[send-travel-update] stub — would notify parents for update ${travel_update_id}`,
      `on event ${travel_event_id}, squads: ${update.target_squads?.join(', ') || 'all'}`,
    );

    // Mark the update as sent
    await admin
      .from('travel_update')
      .update({ sent_push: true })
      .eq('id', travel_update_id);

    return new Response(
      JSON.stringify({ ok: true, sent: 0, note: 'stub — no notifications dispatched' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('send-travel-update error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Unknown error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
