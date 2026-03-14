import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { university, interests, courseKeywords, year } = await req.json();
    if (!university) {
      return new Response(JSON.stringify({ error: 'university is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    // Step 1: Try to scrape university events page via Firecrawl
    let scrapedContent = '';
    if (FIRECRAWL_API_KEY) {
      try {
        const searchQuery = `${university} campus events clubs activities next week`;
        console.log('Searching with Firecrawl:', searchQuery);

        const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 5,
            scrapeOptions: { formats: ['markdown'] },
          }),
        });

        if (searchResp.ok) {
          const searchData = await searchResp.json();
          if (searchData.data) {
            scrapedContent = searchData.data
              .map((r: any) => `## ${r.title || 'Event Page'}\nURL: ${r.url}\n${r.markdown || r.description || ''}`)
              .join('\n\n---\n\n')
              .slice(0, 8000);
            console.log('Scraped content length:', scrapedContent.length);
          }
        } else {
          console.error('Firecrawl search failed:', searchResp.status);
        }
      } catch (e) {
        console.error('Firecrawl error:', e);
      }
    }

    // Step 2: Use LLM to generate/extract structured events
    const today = new Date();
    const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const dateRange = `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${twoWeeksOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const systemPrompt = `You are a campus event discovery engine for ${university}. 
Today's date is ${today.toISOString().split('T')[0]}.

The student is a ${year || 'student'} interested in: ${(interests || []).join(', ')}.
Their courses relate to: ${(courseKeywords || []).join(', ')}.

${scrapedContent ? `Here is real data scraped from the web about campus events:\n\n${scrapedContent}\n\nUse this real data to extract actual events. Supplement with plausible events if needed.` : `Generate realistic and plausible campus events for ${university} in the date range ${dateRange}. Make them specific to this university and the student's interests.`}

Return 8-12 events happening in the next 14 days. Each event should have:
- title: specific event name
- description: 1-2 sentence description
- time: HH:MM 24-hour format
- date: e.g., "Mon, Mar 17"
- day: day abbreviation (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- location: specific campus location
- category: one of: technology, entrepreneurship, sports, music, research, social, arts, wellness
- relevance: 0-100 score based on how well it matches the student's interests and courses
- tags: 2-3 relevant tags

Rank events by relevance to the student's profile. Events matching course subjects or stated interests should score higher.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Find and recommend campus events for the next 14 days (${dateRange}).` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_events',
            description: 'Return discovered campus events',
            parameters: {
              type: 'object',
              properties: {
                events: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      time: { type: 'string' },
                      date: { type: 'string' },
                      day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
                      location: { type: 'string' },
                      category: { type: 'string', enum: ['technology', 'entrepreneurship', 'sports', 'music', 'research', 'social', 'arts', 'wellness'] },
                      relevance: { type: 'number' },
                      tags: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['title', 'description', 'time', 'date', 'day', 'location', 'category', 'relevance', 'tags'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['events'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_events' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI usage limit reached. Please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await aiResponse.text();
      console.error('AI error:', aiResponse.status, t);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');

    const parsed = JSON.parse(toolCall.function.arguments);
    // Add IDs to events
    const events = (parsed.events || []).map((ev: any, i: number) => ({
      ...ev,
      id: `ev-${Date.now()}-${i}`,
    }));

    console.log('Discovered events:', events.length);
    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('discover-events error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
