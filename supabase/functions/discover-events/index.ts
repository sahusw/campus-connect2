import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_RETURNED_EVENTS = 12;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  technology: ['tech', 'technology', 'computer', 'coding', 'software', 'data', 'ai', 'artificial intelligence', 'robotics', 'engineering', 'cyber'],
  entrepreneurship: ['startup', 'entrepreneur', 'business', 'career', 'innovation', 'venture', 'pitch', 'networking', 'professional'],
  sports: ['sport', 'athletic', 'fitness', 'basketball', 'football', 'soccer', 'tennis', 'volleyball', 'recreation', 'intramural'],
  music: ['music', 'concert', 'choir', 'orchestra', 'jazz', 'band', 'performance'],
  research: ['research', 'seminar', 'symposium', 'lecture', 'science', 'lab', 'colloquium', 'academic'],
  social: ['social', 'community', 'meetup', 'mixer', 'student life', 'festival', 'welcome', 'celebration'],
  arts: ['art', 'arts', 'theater', 'theatre', 'film', 'design', 'gallery', 'dance', 'poetry', 'creative'],
  wellness: ['wellness', 'mindfulness', 'health', 'meditation', 'yoga', 'well-being', 'counseling'],
};

type CompactEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  date: string;
  time: string;
  location: string;
};

function scoreEventFallback(event: CompactEvent, interests: string[], courseKeywords: string[]) {
  const haystack = [event.title, event.description, event.location, ...(event.tags || [])]
    .join(' ')
    .toLowerCase();

  let score = 30;
  if (interests.includes(event.category)) score += 30;
  for (const interest of interests) {
    if (haystack.includes(interest.toLowerCase())) score += 8;
  }
  for (const keyword of courseKeywords) {
    if (keyword && haystack.includes(keyword.toLowerCase())) score += 6;
  }

  return Math.max(0, Math.min(100, score));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { interests, courseKeywords, year, events: rawEvents } = await req.json();

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return new Response(JSON.stringify({ events: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Fallback to keyword scoring
      const scored = rawEvents
        .map((e: CompactEvent) => ({
          id: e.id,
          relevance: scoreEventFallback(e, interests || [], courseKeywords || []),
        }))
        .sort((a: any, b: any) => b.relevance - a.relevance)
        .slice(0, MAX_RETURNED_EVENTS);

      return new Response(JSON.stringify({ rankedIds: scored }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send compact events to AI for ranking
    const compactEvents = rawEvents.slice(0, 60).map((e: any) => ({
      id: e.id,
      title: e.title,
      description: (e.description || '').slice(0, 120),
      category: e.category,
      tags: (e.tags || []).slice(0, 3),
    }));

    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            {
              role: 'system',
              content: `You rank campus events for a ${year || 'college'} student interested in ${(interests || []).join(', ')}. Their courses relate to ${(courseKeywords || []).join(', ')}. Return the top ${MAX_RETURNED_EVENTS} event IDs with relevance scores (0-100). Only use provided event IDs.`,
            },
            {
              role: 'user',
              content: JSON.stringify({ events: compactEvents }),
            },
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'return_ranked_events',
              description: 'Return ranked event ids and relevance scores',
              parameters: {
                type: 'object',
                properties: {
                  rankedEvents: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        relevance: { type: 'number' },
                      },
                      required: ['id', 'relevance'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['rankedEvents'],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: 'function', function: { name: 'return_ranked_events' } },
        }),
      });

      if (!response.ok) throw new Error(`AI error: ${response.status}`);

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error('No tool call in response');

      const parsed = JSON.parse(toolCall.function.arguments);
      const rankedIds = Array.isArray(parsed.rankedEvents) ? parsed.rankedEvents : [];

      return new Response(JSON.stringify({ rankedIds }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (aiError) {
      console.error('AI ranking failed, using fallback:', aiError);
      const scored = rawEvents
        .map((e: CompactEvent) => ({
          id: e.id,
          relevance: scoreEventFallback(e, interests || [], courseKeywords || []),
        }))
        .sort((a: any, b: any) => b.relevance - a.relevance)
        .slice(0, MAX_RETURNED_EVENTS);

      return new Response(JSON.stringify({ rankedIds: scored }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.error('discover-events error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
