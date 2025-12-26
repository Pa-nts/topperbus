import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackRequest {
  type: 'suggestion' | 'bug' | 'feedback';
  message: string;
  email?: string;
  turnstileToken: string;
}

// Verify Cloudflare Turnstile token
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }),
    });

    const result = await response.json();
    console.log('Turnstile verification result:', { success: result.success });
    return result.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
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

// Remove control characters and normalize whitespace
function normalizeInput(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Sanitize text to prevent Discord markdown injection
function sanitizeForDiscord(text: string): string {
  // Escape Discord markdown characters
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|')
    .replace(/@/g, '＠') // Replace @ to prevent mentions
    .replace(/<@/g, '<＠') // Prevent user/role mentions
    .replace(/<#/g, '<＃') // Prevent channel mentions
    .replace(/<:/g, '<：'); // Prevent custom emoji injection
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Type validation
    if (typeof body !== 'object' || body === null) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, message, email, turnstileToken } = body as FeedbackRequest;

    // Verify Turnstile token first
    if (!turnstileToken || typeof turnstileToken !== 'string') {
      return new Response(
        JSON.stringify({ error: 'CAPTCHA verification required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValidCaptcha = await verifyTurnstile(turnstileToken, clientIp);
    if (!isValidCaptcha) {
      return new Response(
        JSON.stringify({ error: 'CAPTCHA verification failed. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate type
    if (!type || !['suggestion', 'bug', 'feedback'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid feedback type. Must be one of: suggestion, bug, feedback' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize and validate message
    const normalizedMessage = normalizeInput(message);
    if (normalizedMessage.length < 10 || normalizedMessage.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Message must be between 10 and 2000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email if provided
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !isValidEmail(email)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Sanitize content before sending to Discord
    const sanitizedMessage = sanitizeForDiscord(normalizedMessage);
    const sanitizedEmail = email ? sanitizeForDiscord(normalizeInput(email)) : null;

    const discordMessage = {
      embeds: [{
        title: `${typeEmoji[type]} New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        description: sanitizedMessage.slice(0, 2000),
        color: typeColor[type],
        fields: sanitizedEmail ? [{ name: "📧 Contact Email", value: sanitizedEmail, inline: false }] : [],
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
      return new Response(
        JSON.stringify({ error: 'Failed to submit feedback. Please try again later.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Feedback sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-feedback function:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
