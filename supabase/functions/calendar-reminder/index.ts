import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization - this function should only be called by cron jobs or authenticated admins
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('CALENDAR_REMINDER_SECRET');
    
    // If a secret is configured, require it for authentication
    if (expectedSecret) {
      if (!authHeader) {
        console.error('Missing Authorization header');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Accept either "Bearer <secret>" or just the secret directly
      const providedToken = authHeader.replace('Bearer ', '').trim();
      
      if (providedToken !== expectedSecret) {
        console.error('Invalid authorization token');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // If no secret is configured, check for Supabase service role key
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!authHeader || !authHeader.includes(supabaseAnonKey || '')) {
        console.warn('CALENDAR_REMINDER_SECRET not configured - using fallback auth check');
      }
    }

    const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    
    if (!discordWebhookUrl) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentYear = new Date().getFullYear();
    
    const message = {
      embeds: [{
        title: "🚌 WKU Bus Calendar Update Reminder",
        description: `**Happy New Year ${currentYear}!**\n\nTime to update the WKU transit academic calendar dates.`,
        color: 0xC62828,
        fields: [
          {
            name: "📅 Calendar Source",
            value: "[WKU Academic Calendar](https://www.wku.edu/registrar/academic_calendars/)",
            inline: false
          },
          {
            name: "📝 File to Update",
            value: "`src/lib/academicCalendar.ts`",
            inline: false
          }
        ],
        footer: { text: "WKU Transit App" },
        timestamp: new Date().toISOString()
      }]
    };

    console.log('Sending Discord notification...');
    
    const discordResponse = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error('Discord API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send notification' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Discord notification sent successfully');
    
    return new Response(
      JSON.stringify({ success: true, message: 'Calendar reminder sent to Discord' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Error in calendar-reminder function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
