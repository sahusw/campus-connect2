import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const SEARCH_WINDOW_DAYS = 14;
const SEARCH_RESULTS_PER_QUERY = 4;
const MAX_SOURCE_SNIPPET_CHARS = 700;
const MAX_TOTAL_SOURCE_CHARS = 5000;
const MAX_RETURNED_EVENTS = 8;
const UNIVERSITY_OF_MICHIGAN_KEYS = new Set(['university of michigan', 'umich', 'u-m']);
const OFFICIAL_DOMAIN_MAP: Record<string, string[]> = {
  'university of michigan': ['umich.edu', 'events.umich.edu', 'happenings.umich.edu', 'studentlife.umich.edu', 'maizepages.umich.edu', 'mgoblue.com'],
};
const STOP_WORDS = new Set(['the', 'of', 'at', 'and', 'university', 'college', 'campus']);
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

type RankedEvent = {
  id: string;
  relevance: number;
};

type OfficialEvent = {
  id: string;
  title: string;
  description: string;
  time: string;
  date: string;
  day: string;
  location: string;
  category: string;
  relevance: number;
  tags: string[];
  detailsUrl: string;
  sponsors: string[];
  website?: string;
};

function normalizeUniversityKey(university: string) {
  return university.trim().toLowerCase();
}

function isUniversityOfMichigan(university: string) {
  return UNIVERSITY_OF_MICHIGAN_KEYS.has(normalizeUniversityKey(university));
}

function getOfficialDomains(university: string) {
  const mapped = OFFICIAL_DOMAIN_MAP[normalizeUniversityKey(university)];
  if (mapped) return mapped;

  const tokens = university
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !STOP_WORDS.has(token));

  const inferredDomains = tokens.map((token) => `${token}.edu`);
  return Array.from(new Set(inferredDomains));
}

function getRootSearchDomains(domains: string[]) {
  return Array.from(new Set(domains.map((domain) => domain.replace(/^events\./, '').replace(/^happenings\./, '').replace(/^studentlife\./, '')))).slice(0, 3);
}

function isValidHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isOfficialEventUrl(value: string | undefined, officialDomains: string[]) {
  if (!isValidHttpUrl(value)) return false;

  const hostname = new URL(value!).hostname.toLowerCase();
  return officialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function parseIsoEventStart(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toDayAbbreviation(date: Date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

function dedupeEvents<T extends { title: string; date: string; time: string; location: string }>(events: T[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [event.title, event.date, event.time, event.location].join('::').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeWhitespace(value: string | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function clipText(value: string | undefined, maxChars = 280) {
  const normalized = normalizeWhitespace(value);
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars - 1)}�` : normalized;
}

function inferCategory(parts: string[]) {
  const haystack = parts.join(' ').toLowerCase();

  let bestCategory = 'social';
  let bestScore = -1;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function scoreEventFallback(event: OfficialEvent, interests: string[], courseKeywords: string[]) {
  const haystack = [event.title, event.description, event.location, event.tags.join(' '), event.sponsors.join(' ')]
    .join(' ')
    .toLowerCase();

  let score = 35;
  if (interests.includes(event.category)) score += 30;
  for (const interest of interests) {
    if (haystack.includes(interest.toLowerCase())) score += 8;
  }
  for (const keyword of courseKeywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 6;
  }

  return Math.max(0, Math.min(100, score));
}

async function rankOfficialEventsWithAI(
  events: OfficialEvent[],
  interests: string[],
  courseKeywords: string[],
  year: string | undefined,
  lovableApiKey: string,
) {
  if (events.length === 0) return [] as RankedEvent[];

  const compactEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    time: event.time,
    location: event.location,
    category: event.category,
    tags: event.tags,
    sponsors: event.sponsors,
  }));

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You rank real campus events for a student. Only choose from the provided event IDs. Do not invent or rewrite events. Return up to ${MAX_RETURNED_EVENTS} event IDs with relevance scores from 0 to 100. The student is a ${year || 'student'} interested in ${(interests || []).join(', ')}. Their courses relate to ${(courseKeywords || []).join(', ')}.`,
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

    if (!response.ok) {
      throw new Error(`AI ranking error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [] as RankedEvent[];

    const parsed = JSON.parse(toolCall.function.arguments);
    return Array.isArray(parsed.rankedEvents) ? parsed.rankedEvents : [];
  } catch (error) {
    console.error('AI ranking failed, using fallback scoring:', error);
    return events
      .map((event) => ({
        id: event.id,
        relevance: scoreEventFallback(event, interests, courseKeywords),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, MAX_RETURNED_EVENTS);
  }
}

async function fetchUmichFeedEvents(startIso: string, endIso: string): Promise<OfficialEvent[]> {
  const response = await fetch(`https://events.umich.edu/list/json?filter=all&range=${startIso}to${endIso}&v=2&max-results=100`);
  if (!response.ok) {
    throw new Error(`UMich feed error: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return dedupeEvents(
    data
      .map((raw: any) => {
        const date = raw.date_start;
        const time = typeof raw.time_start === 'string' ? raw.time_start.slice(0, 5) : '';
        const start = parseIsoEventStart(date, time);
        if (!start) return null;

        const sponsors = Array.isArray(raw.sponsors)
          ? raw.sponsors.map((sponsor: any) => normalizeWhitespace(sponsor?.group_name)).filter(Boolean)
          : [];
        const officialTags = Array.isArray(raw.tags) ? raw.tags.map((tag: string) => normalizeWhitespace(tag)).filter(Boolean) : [];
        const title = normalizeWhitespace(raw.combined_title || raw.event_title);
        const description = clipText(raw.description || raw.occurrence_notes || raw.event_subtitle, 320);
        const location = [normalizeWhitespace(raw.location_name), normalizeWhitespace(raw.room)].filter(Boolean).join(', ');
        const detailsUrl = isValidHttpUrl(raw.permalink) ? raw.permalink : raw.website;
        if (!title || !location || !detailsUrl) return null;

        const category = inferCategory([
          title,
          description,
          location,
          normalizeWhitespace(raw.event_type),
          officialTags.join(' '),
          sponsors.join(' '),
        ]);

        const tags = Array.from(new Set([...officialTags, ...sponsors])).slice(0, 3);

        return {
          id: String(raw.id),
          title,
          description,
          time,
          date,
          day: toDayAbbreviation(start),
          location,
          category,
          relevance: 0,
          tags,
          detailsUrl,
          sponsors,
          website: isValidHttpUrl(raw.website) ? raw.website : undefined,
        } satisfies OfficialEvent;
      })
      .filter(Boolean) as OfficialEvent[]
  );
}

async function searchOfficialSources(university: string, officialDomains: string[], firecrawlApiKey: string) {
  const rootDomains = getRootSearchDomains(officialDomains);
  const searchQueries = rootDomains.flatMap((domain) => [
    `site:${domain} ${university} campus events next ${SEARCH_WINDOW_DAYS} days`,
    `site:${domain} ${university} student events next ${SEARCH_WINDOW_DAYS} days`,
  ]);

  const responses = await Promise.all(
    searchQueries.map(async (query) => {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: SEARCH_RESULTS_PER_QUERY,
          scrapeOptions: { formats: ['markdown'] },
        }),
      });

      if (!response.ok) {
        console.error('Firecrawl search failed:', response.status, query);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data.data) ? data.data : [];
    })
  );

  const filteredResults = responses
    .flat()
    .filter((result: any) => isOfficialEventUrl(result.url, officialDomains))
    .slice(0, 10);

  return filteredResults
    .map((result: any) => {
      const snippet = (result.markdown || result.description || '').slice(0, MAX_SOURCE_SNIPPET_CHARS);
      return `SOURCE_URL: ${result.url}\nTITLE: ${result.title || 'Official Event Page'}\nCONTENT:\n${snippet}`;
    })
    .join('\n\n---\n\n')
    .slice(0, MAX_TOTAL_SOURCE_CHARS);
}

async function discoverFallbackEvents(
  university: string,
  interests: string[],
  courseKeywords: string[],
  year: string | undefined,
  lovableApiKey: string,
  firecrawlApiKey: string,
  startIso: string,
  endIso: string,
) {
  const officialDomains = getOfficialDomains(university);
  const sourceContent = await searchOfficialSources(university, officialDomains, firecrawlApiKey);
  if (!sourceContent) return [];

  const systemPrompt = `You extract official campus events for ${university}. Today's date is ${startIso}.\n\nOnly return events that are explicitly present in the provided official source snippets.\nDo not invent, estimate, generalize, or reuse prior-year events.\nIf an event's exact date, time, or official source URL is missing or ambiguous, omit it.\nOnly include events scheduled from ${startIso} through ${endIso}.\n\nThe student is a ${year || 'student'} interested in: ${(interests || []).join(', ')}.\nTheir courses relate to: ${(courseKeywords || []).join(', ')}.\nUse those only to score relevance, not to invent events.\n\nReturn at most ${MAX_RETURNED_EVENTS} events with:\n- title\n- description\n- date in YYYY-MM-DD format\n- time in HH:MM 24-hour format\n- location\n- category: one of technology, entrepreneurship, sports, music, research, social, arts, wellness\n- relevance: 0-100\n- tags: 2-3 short tags\n- detailsUrl: the exact SOURCE_URL for that event\n\nOfficial sources:\n${sourceContent}`;

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Extract only the verifiable official events from these sources.' },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'return_events',
          description: 'Return only official, source-backed campus events',
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
                    location: { type: 'string' },
                    category: { type: 'string', enum: ['technology', 'entrepreneurship', 'sports', 'music', 'research', 'social', 'arts', 'wellness'] },
                    relevance: { type: 'number' },
                    tags: { type: 'array', items: { type: 'string' } },
                    detailsUrl: { type: 'string' },
                  },
                  required: ['title', 'description', 'time', 'date', 'location', 'category', 'relevance', 'tags', 'detailsUrl'],
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
      return [];
    }
    const text = await aiResponse.text();
    console.error('AI error:', aiResponse.status, text);
    throw new Error(`AI error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return [];

  const windowStart = new Date(`${startIso}T00:00:00`);
  const windowEnd = new Date(`${endIso}T23:59:59`);
  const parsed = JSON.parse(toolCall.function.arguments);
  return dedupeEvents(parsed.events || [])
    .map((event: any, index: number) => {
      const start = parseIsoEventStart(event.date, event.time);
      if (!start) return null;
      if (start < windowStart || start > windowEnd) return null;
      if (!isOfficialEventUrl(event.detailsUrl, officialDomains)) return null;

      return {
        ...event,
        id: `ev-${Date.now()}-${index}`,
        day: toDayAbbreviation(start),
      };
    })
    .filter(Boolean);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { university, interests, courseKeywords, year } = await req.json();
    if (!university) {
      return new Response(JSON.stringify({ error: 'university is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const today = new Date();
    const windowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const windowEnd = new Date(windowStart.getTime() + SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const startIso = windowStart.toISOString().split('T')[0];
    const endIso = windowEnd.toISOString().split('T')[0];

    if (isUniversityOfMichigan(university)) {
      const officialEvents = await fetchUmichFeedEvents(startIso, endIso);
      const ranked = await rankOfficialEventsWithAI(officialEvents, interests || [], courseKeywords || [], year, LOVABLE_API_KEY);
      const officialEventMap = new Map(officialEvents.map((event) => [event.id, event]));

      const selected = ranked
        .map((rankedEvent) => {
          const event = officialEventMap.get(rankedEvent.id);
          if (!event) return null;
          return {
            ...event,
            relevance: Math.max(0, Math.min(100, Math.round(rankedEvent.relevance))),
          };
        })
        .filter(Boolean) as OfficialEvent[];

      const finalEvents = (selected.length > 0 ? selected : officialEvents
        .map((event) => ({ ...event, relevance: scoreEventFallback(event, interests || [], courseKeywords || []) }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, MAX_RETURNED_EVENTS));

      return new Response(JSON.stringify({ events: finalEvents }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ events: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fallbackEvents = await discoverFallbackEvents(
      university,
      interests || [],
      courseKeywords || [],
      year,
      LOVABLE_API_KEY,
      FIRECRAWL_API_KEY,
      startIso,
      endIso,
    );

    return new Response(JSON.stringify({ events: fallbackEvents }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('discover-events error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
