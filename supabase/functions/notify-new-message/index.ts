import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessagePayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messageId, conversationId, senderId, content } = await req.json() as MessagePayload;

    console.log('Processing new message notification:', { messageId, conversationId, senderId });

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', senderId)
      .maybeSingle();

    const senderName = senderProfile?.username || 'Someone';

    // Get all participants in the conversation except the sender
    const { data: participants, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId);

    if (partError) {
      console.error('Error fetching participants:', partError);
      throw partError;
    }

    if (!participants || participants.length === 0) {
      console.log('No other participants to notify');
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Notifying ${participants.length} participants`);

    // Send push notification to each participant
    let notifiedCount = 0;
    for (const participant of participants) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            recipientUserId: participant.user_id,
            title: `💬 ${senderName}`,
            body: content.length > 100 ? content.substring(0, 100) + '...' : content,
            data: {
              conversationId,
              messageId,
              type: 'message',
            },
          }),
        });

        if (response.ok) {
          notifiedCount++;
        } else {
          console.error('Failed to send notification:', await response.text());
        }
      } catch (error) {
        console.error('Error sending notification to participant:', error);
      }
    }

    return new Response(JSON.stringify({ success: true, notified: notifiedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in notify-new-message:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
