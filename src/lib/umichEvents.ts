import type { Interest } from './types';

export interface UMichEvent {
  id: string;
  title: string;
  description: string;
  date: string;           // "Mon, Mar 17"
  day: string;            // "Mon"
  time: string;           // "18:00"
  timeDisplay: string;    // "6:00pm"
  location: string;
  eventType: string;      // raw type from UMich e.g. "Lecture / Discussion"
  category: Interest;     // mapped to our interest categories
  tags: string[];
  url: string;
  dtstart: string;        // ISO for calendar export
  dtend: string;
  relevance: number;      // filled in by AI suggestion step
}

// Map UMich event types → our Interest categories
const TYPE_TO_INTEREST: Record<string, Interest> = {
  'lecture / discussion': 'research',
  'conference / symposium': 'research',
  'presentation': 'research',
  'workshop / seminar': 'technology',
  'class / instruction': 'technology',
  'performance': 'music',
  'film screening': 'arts',
  'exhibition': 'arts',
  'fair / festival': 'social',
  'reception / open house': 'social',
  'social / informal gathering': 'social',
  'meeting': 'social',
  'sporting event': 'sports',
  'recreational / games': 'sports',
  'exercise / fitness': 'wellness',
  'well-being': 'wellness',
  'community service': 'social',
  'careers / jobs': 'entrepreneurship',
  'tours': 'arts',
  'other': 'social',
};

function mapTypeToInterest(typeName: string): Interest {
  const key = (typeName || '').toLowerCase().trim();
  return TYPE_TO_INTEREST[key] || 'social';
}

function formatDateDisplay(dtStr: string): { date: string; day: string; time: string; timeDisplay: string } {
  try {
    const dt = new Date(dtStr);
    const day = dt.toLocaleDateString('en-US', { weekday: 'short' });
    const date = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
    const timeDisplay = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { date, day, time, timeDisplay };
  } catch {
    return { date: '', day: 'Mon', time: '12:00', timeDisplay: '12:00pm' };
  }
}

function toISOLocal(dtStr: string): string {
  try {
    return new Date(dtStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } catch {
    return '';
  }
}

// Uses allorigins.win as a CORS proxy to fetch the UMich JSON API
const PROXY = 'https://api.allorigins.win/get?url=';
const UMICH_BASE = 'https://events.umich.edu';

export async function fetchUMichEvents(): Promise<UMichEvent[]> {
  // Fetch ~3 months of upcoming events, up to 150
  const apiUrl = `${UMICH_BASE}/list?v=json&range=3months&filter=upcoming`;
  const proxyUrl = `${PROXY}${encodeURIComponent(apiUrl)}`;

  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);

  const wrapper = await res.json();
  // allorigins wraps the content in { contents: "..." }
  const raw = typeof wrapper.contents === 'string' ? wrapper.contents : JSON.stringify(wrapper.contents);
  const data: any[] = JSON.parse(raw);

  if (!Array.isArray(data)) throw new Error('Unexpected API response shape');

  return data.slice(0, 150).map((e: any, idx: number) => {
    const { date, day, time, timeDisplay } = formatDateDisplay(e.datetime_start || e.date_start || '');
    const typeName = e.type_name || e.event_type || 'Other';
    const tags: string[] = [];
    if (e.sponsor) tags.push(e.sponsor);
    if (typeName) tags.push(typeName);

    return {
      id: String(e.id || e.event_id || `umich-${idx}`),
      title: e.event_title || e.title || 'Untitled Event',
      description: stripHtml(e.description || e.event_description || '').slice(0, 200),
      date,
      day,
      time,
      timeDisplay,
      location: e.location || e.building_name || 'University of Michigan',
      eventType: typeName,
      category: mapTypeToInterest(typeName),
      tags,
      url: e.permalink || `${UMICH_BASE}/event/${e.id}`,
      dtstart: toISOLocal(e.datetime_start || ''),
      dtend: toISOLocal(e.datetime_end || e.datetime_start || ''),
      relevance: 0,
    };
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

// Score events against user interests using Claude AI
export async function scoreEventsWithAI(
  events: UMichEvent[],
  interests: Interest[],
  courseKeywords: string[]
): Promise<UMichEvent[]> {
  if (!events.length) return events;

  const interestLabels = interests.map((i) => {
    const map: Record<Interest, string> = {
      technology: 'Technology & Computer Science',
      entrepreneurship: 'Entrepreneurship & Business',
      sports: 'Sports & Athletics',
      music: 'Music & Performance',
      research: 'Academic Research & Lectures',
      social: 'Social Events & Community',
      arts: 'Arts, Film & Culture',
      wellness: 'Wellness & Fitness',
    };
    return map[i] || i;
  });

  // Build a compact list for the AI prompt
  const eventList = events
    .map((e) => `${e.id}|||${e.title}|||${e.eventType}|||${e.description.slice(0, 80)}`)
    .join('\n');

  const prompt = `You are a university event recommendation assistant. A UMich student is interested in: ${interestLabels.join(', ')}.
${courseKeywords.length > 0 ? `Their courses relate to: ${courseKeywords.join(', ')}.` : ''}

Rate each of the following REAL UMich events on a relevance scale of 0-100 based on how well it matches the student's interests.
Return ONLY a JSON array of objects with exactly these fields: {"id": "...", "score": <number 0-100>}
Do NOT add any explanation. Do NOT invent events. Only score the events listed.

Events (format: id|||title|||type|||description):
${eventList}`;

  // Call Claude via the Anthropic API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const result = await response.json();
  const text = result.content?.[0]?.text || '[]';
  const cleaned = text.replace(/```json|```/g, '').trim();

  let scores: Array<{ id: string; score: number }> = [];
  try {
    scores = JSON.parse(cleaned);
  } catch {
    // If parsing fails, fall back to category-based scoring
    return events.map((e) => ({
      ...e,
      relevance: interests.includes(e.category) ? 70 : 40,
    }));
  }

  const scoreMap = new Map(scores.map((s) => [String(s.id), s.score]));
  return events
    .map((e) => ({ ...e, relevance: scoreMap.get(e.id) ?? (interests.includes(e.category) ? 60 : 30) }))
    .sort((a, b) => b.relevance - a.relevance);
}

// Generate an .ics file blob from selected events
export function generateICS(events: UMichEvent[]): Blob {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusFlow//UMich Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const e of events) {
    const uid = `${e.id}-${Date.now()}@campusflow.umich`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtstart = e.dtstart || now;
    const dtend = e.dtend || dtstart;
    const summary = e.title.replace(/,/g, '\\,').replace(/;/g, '\\;');
    const description = e.description.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
    const location = e.location.replace(/,/g, '\\,');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `URL:${e.url}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
}

// Build a Google Calendar "Add Event" URL for a single event
export function buildGCalURL(event: UMichEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${event.dtstart}/${event.dtend}`,
    details: `${event.description}\n\nMore info: ${event.url}`,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
