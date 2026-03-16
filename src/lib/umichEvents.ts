import type { Interest, CampusEvent } from './types';

// Map CSV event types → our Interest categories
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toISOLocal(dtStr: string): string {
  try {
    return new Date(dtStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } catch {
    return '';
  }
}

/**
 * Parse a CSV string, handling quoted fields with commas and newlines.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  
  // Remove BOM if present
  const clean = text.startsWith('\ufeff') ? text.slice(1) : text;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field);
        field = '';
        if (current.length > 1) rows.push(current);
        current = [];
        if (ch === '\r') i++; // skip \n after \r
      } else {
        field += ch;
      }
    }
  }
  // Last field/row
  current.push(field);
  if (current.length > 1) rows.push(current);

  return rows;
}

/**
 * Fetch and parse events from the local events.csv file.
 * CSV columns: Identifier, Start Date / Time, End Date / Time, Title, Subtitle,
 *              Type, Description, Permalink, Building Name, Room, Location Name,
 *              Cost, Tags, Sponsors
 */
export async function fetchUMichEvents(): Promise<CampusEvent[]> {
  const res = await fetch('/events.csv');
  if (!res.ok) throw new Error(`Failed to fetch events.csv: ${res.status}`);
  const text = await res.text();
  
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  
  // Skip header row
  const dataRows = rows.slice(1);
  
  return dataRows
    .map((cols, idx) => {
      const [
        identifier,
        startDateTime,
        endDateTime,
        title,
        subtitle,
        type,
        description,
        permalink,
        buildingName,
        room,
        locationName,
        _cost,
        tags,
        sponsors,
      ] = cols;

      if (!title?.trim() || !startDateTime?.trim()) return null;

      const startDt = new Date(startDateTime);
      if (isNaN(startDt.getTime())) return null;

      const endDt = endDateTime ? new Date(endDateTime) : new Date(startDt.getTime() + 60 * 60 * 1000);
      
      const day = startDt.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = startDt.toISOString().split('T')[0];
      const time = `${startDt.getHours().toString().padStart(2, '0')}:${startDt.getMinutes().toString().padStart(2, '0')}`;
      const timeDisplay = startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      const location = [buildingName?.trim(), room?.trim(), locationName?.trim()]
        .filter(Boolean)
        .join(', ') || 'University of Michigan';

      const parsedTags: string[] = [];
      if (tags?.trim()) parsedTags.push(...tags.split(',').map(t => t.trim()).filter(Boolean));
      if (sponsors?.trim()) parsedTags.push(...sponsors.split(',').map(s => s.trim()).filter(Boolean));

      const cleanDesc = stripHtml(description || subtitle || '').slice(0, 250);

      return {
        id: identifier?.trim() || `csv-${idx}`,
        title: title.trim(),
        description: cleanDesc,
        date: dateStr,
        day,
        time,
        timeDisplay,
        location,
        eventType: type?.trim() || 'Other',
        category: mapTypeToInterest(type || ''),
        tags: parsedTags.slice(0, 4),
        url: permalink?.trim() || undefined,
        dtstart: toISOLocal(startDateTime),
        dtend: toISOLocal(endDateTime || startDateTime),
        relevance: 0,
      } satisfies CampusEvent;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null) as CampusEvent[];
}

/**
 * Score events against user interests using Lovable AI gateway.
 */
export async function scoreEventsWithAI(
  events: CampusEvent[],
  interests: Interest[],
  courseKeywords: string[]
): Promise<CampusEvent[]> {
  if (!events.length) return events;

  // Fallback: category-based scoring (no API call needed)
  return events
    .map((e) => ({
      ...e,
      relevance: computeRelevance(e, interests, courseKeywords),
    }))
    .sort((a, b) => b.relevance - a.relevance);
}

function computeRelevance(event: CampusEvent, interests: Interest[], courseKeywords: string[]): number {
  let score = 30;
  const haystack = [event.title, event.description, event.location, ...(event.tags || [])].join(' ').toLowerCase();

  if (interests.includes(event.category)) score += 35;
  for (const interest of interests) {
    if (haystack.includes(interest.toLowerCase())) score += 8;
  }
  for (const keyword of courseKeywords) {
    if (keyword && haystack.includes(keyword.toLowerCase())) score += 6;
  }

  return Math.max(0, Math.min(100, score));
}
