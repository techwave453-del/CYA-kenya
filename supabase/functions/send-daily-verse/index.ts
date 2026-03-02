import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine today's verse by day_of_year modulo available verses
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Fetch all verses from table
    const { data: verses, error: verseError } = await supabase
      .from('bible_verses')
      .select('*')
      .order('day_of_year', { ascending: true });

    if (verseError) {
      console.error('Error fetching verses:', verseError);
      throw verseError;
    }

    if (!verses || verses.length === 0) {
      console.log('No verses available to send');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verse = verses[dayOfYear % verses.length];
    const title = 'Daily Memory Verse';
    const body = `${verse.reference}: ${verse.text.length > 120 ? verse.text.substring(0, 120) + '...' : verse.text}`;

    // Find unique users who have push subscriptions
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .not('user_id', 'is', null);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      throw subsError;
    }

    const userIds = Array.from(new Set(subs.map((s: any) => s.user_id))).filter(Boolean);

    let sent = 0;

    for (const uid of userIds) {
      try {
        const resp = await fetch(sendPushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            recipientUserId: uid,
            title,
            body,
            data: {
              type: 'daily_verse',
              verseId: verse.id,
              reference: verse.reference
            }
          })
        });

        if (resp.ok) sent++;
        else console.error('Failed to send daily push to', uid, await resp.text());
      } catch (error) {
        console.error('Error sending daily push to', uid, error);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-daily-verse:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
