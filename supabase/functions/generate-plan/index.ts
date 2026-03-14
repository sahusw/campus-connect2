import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { classes, events, timePreferences, interests } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const classesJson = JSON.stringify(classes || []);
    const eventsJson = JSON.stringify(events || []);

    const systemPrompt = `You are a smart weekly planner for a college student. Generate a balanced weekly plan.

The student's existing classes:
${classesJson}

Available campus events (already ranked by relevance):
${eventsJson}

Student prefers activities during: ${(timePreferences || []).join(', ')}
Student interests: ${(interests || []).join(', ')}

Rules:
1. NEVER overlap with existing class times
2. Add study blocks (45-90 min) after or near related classes
3. Pick the top 3-5 most relevant events that fit free time slots
4. Leave some free time - don't overschedule
5. Respect time preferences for non-class activities
6. Study blocks should be labeled "Study: [Course Name]"

Return schedule blocks for the week. Each block needs:
- type: "study" or "event" (don't include classes, those are already handled)
- title: descriptive title
- startTime: HH:MM 24-hour
- endTime: HH:MM 24-hour
- day: Mon/Tue/Wed/Thu/Fri/Sat/Sun
- location: (for events, use the event location; for study, suggest "Library" or "Study Room")
- description: brief note

Generate 8-15 additional blocks (study + events combined).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a smart weekly plan with study blocks and recommended events.' },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_plan',
            description: 'Return the generated weekly plan blocks',
            parameters: {
              type: 'object',
              properties: {
                blocks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['study', 'event'] },
                      title: { type: 'string' },
                      startTime: { type: 'string' },
                      endTime: { type: 'string' },
                      day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
                      location: { type: 'string' },
                      description: { type: 'string' },
                    },
                    required: ['type', 'title', 'startTime', 'endTime', 'day'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['blocks'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_plan' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI usage limit reached. Please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI error:', response.status, t);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');

    const parsed = JSON.parse(toolCall.function.arguments);
    const blocks = (parsed.blocks || []).map((b: any, i: number) => ({
      ...b,
      id: `plan-${Date.now()}-${i}`,
      color: b.type === 'study' 
        ? 'bg-campus-sage-light/50 border-campus-sage/30'
        : 'bg-campus-coral-light border-campus-coral',
    }));

    console.log('Generated plan blocks:', blocks.length);
    return new Response(JSON.stringify({ blocks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-plan error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
