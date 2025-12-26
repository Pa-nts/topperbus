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
    const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    
    if (!discordWebhookUrl) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Discord webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, error: `Discord error: ${discordResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Discord notification sent successfully');
    
    return new Response(
      JSON.stringify({ success: true, message: 'Calendar reminder sent to Discord' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Error in calendar-reminder function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
