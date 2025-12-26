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

// Simple in-memory rate limiter (resets on cold start, but provides basic protection)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  record.count++;
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    if (isRateLimited(clientIp)) {
      console.log(`Rate limited IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, message, email }: FeedbackRequest = await req.json();

    // Validate type
    if (!['suggestion', 'bug', 'feedback'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid feedback type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate webhook based on feedback type
    const webhookMap = {
      suggestion: Deno.env.get('DISCORD_WEBHOOK_SUGGESTIONS'),
      bug: Deno.env.get('DISCORD_WEBHOOK_BUGS'),
      feedback: Deno.env.get('DISCORD_WEBHOOK_FEEDBACK'),
    };

    const discordWebhookUrl = webhookMap[type];
    
    if (!discordWebhookUrl) {
      console.error(`Webhook not configured for type: ${type}`);
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10 || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Invalid message length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email if provided
    if (email && (typeof email !== 'string' || email.length > 255)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email' }),
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
