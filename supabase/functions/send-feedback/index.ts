import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackRequest {
  type: 'suggestion' | 'bug' | 'feedback';
  message: string;
  email?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    
    if (!discordWebhookUrl) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, message, email }: FeedbackRequest = await req.json();

    if (!message || message.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Message too short' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typeEmoji = {
      suggestion: '💡',
      bug: '🐛',
      feedback: '💬'
    };

    const typeColor = {
      suggestion: 0x22C55E,
      bug: 0xEF4444,
      feedback: 0x3B82F6
    };

    const discordMessage = {
      embeds: [{
        title: `${typeEmoji[type]} New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        description: message.slice(0, 2000),
        color: typeColor[type],
        fields: email ? [{ name: "📧 Contact Email", value: email, inline: false }] : [],
        footer: { text: "WKU Transit Feedback" },
        timestamp: new Date().toISOString()
      }]
    };

    console.log('Sending feedback to Discord:', { type, hasEmail: !!email });

    const discordResponse = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error('Discord webhook error:', errorText);
      throw new Error('Failed to send to Discord');
    }

    console.log('Feedback sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-feedback function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
