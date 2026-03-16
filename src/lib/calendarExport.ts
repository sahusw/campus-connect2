import type { CampusEvent, ClassBlock } from './types';

// ── iCal escaping & date helpers ─────────────────────────────────────────────

function esc(s: string): string {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → compact UTC iCal string: 20260317T180000Z */
function toICalUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    `${pad2(d.getUTCMonth() + 1)}` +
    `${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}` +
    `${pad2(d.getUTCMinutes())}` +
    `${pad2(d.getUTCSeconds())}Z`
  );
}

/** Date → local datetime string for Google Calendar URLs: 20260317T180000 */
function toGCalLocal(d: Date): string {
  return (
    `${d.getFullYear()}` +
    `${pad2(d.getMonth() + 1)}` +
    `${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}` +
    `${pad2(d.getMinutes())}` +
    `${pad2(d.getSeconds())}`
  );
}

/** Fold long iCal lines at 75 chars (RFC 5545 requirement) */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}

function pushLine(lines: string[], line: string) {
  lines.push(foldLine(line));
}

// ── Campus event helpers ──────────────────────────────────────────────────────

/**
 * Parse a CampusEvent's date+time into a JS Date.
 * Handles YYYY-MM-DD (ISO) and "Mon, Mar 17" (display) formats.
 */
export function parseEventDate(event: CampusEvent): Date | null {
  const { date, time } = event;
  if (!date || !time) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
    const d = new Date(`${date}T${time}:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const year = new Date().getFullYear();
  const attempt = new Date(`${date} ${year} ${time}`);
  if (!isNaN(attempt.getTime())) {
    if (attempt.getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000) {
      attempt.setFullYear(year + 1);
    }
    return attempt;
  }
  return null;
}

export function buildGCalURL(event: CampusEvent): string | null {
  const start = parseEventDate(event);
  if (!start) return null;
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const details = [
    event.description,
    event.url ? `More info: ${event.url}` : '',
  ].filter(Boolean).join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGCalLocal(start)}/${toGCalLocal(end)}`,
    location: event.location || '',
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateICS(events: CampusEvent[]): Blob {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mandala//UMich Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Mandala Events',
  ];

  const now = toICalUTC(new Date());

  for (const ev of events) {
    const start = parseEventDate(ev);
    if (!start) continue;

    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const uid = `mandala-event-${ev.id}@umich.edu`;
    const eventUrl = ev.url || '';

    const descParts = [ev.description];
    if (eventUrl) descParts.push(`More info: ${eventUrl}`);
    if (ev.tags?.length) descParts.push(`Tags: ${ev.tags.join(', ')}`);

    lines.push('BEGIN:VEVENT');
    pushLine(lines, `UID:${uid}`);
    pushLine(lines, `DTSTAMP:${now}`);
    pushLine(lines, `DTSTART:${toICalUTC(start)}`);
    pushLine(lines, `DTEND:${toICalUTC(end)}`);
    pushLine(lines, `SUMMARY:${esc(ev.title)}`);
    pushLine(lines, `DESCRIPTION:${esc(descParts.join('\n\n'))}`);
    pushLine(lines, `LOCATION:${esc(ev.location || '')}`);
    if (eventUrl) pushLine(lines, `URL:${eventUrl}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
}

export function downloadICS(events: CampusEvent[], filename = 'mandala-events.ics'): void {
  triggerDownload(generateICS(events), filename);
}

// ── Class export helpers ──────────────────────────────────────────────────────

const DAY_TO_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// iCal BYDAY abbreviations (2-letter)
const DAY_TO_ICAL: Record<string, string> = {
  Sun: 'SU', Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA',
};

/**
 * Given a day name like "Mon" and an HH:MM time, return the next upcoming
 * Date that falls on that day of the week (today or future).
 */
function nextOccurrence(dayName: string, time: string): Date {
  const targetDow = DAY_TO_NUM[dayName] ?? 1;
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const diff = (targetDow - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + diff);
  return candidate;
}

export type ClassExportMode = 'this-week' | 'repeat-forever' | 'repeat-semester';

/**
 * Generate an .ics blob for the user's classes.
 *
 * Modes:
 *   'this-week'       — one concrete VEVENT per class session this week (no recurrence)
 *   'repeat-forever'  — weekly recurring VEVENT with no end date (RRULE:FREQ=WEEKLY)
 *   'repeat-semester' — weekly recurring for ~16 weeks (typical semester)
 */
export function generateClassICS(classes: ClassBlock[], mode: ClassExportMode): Blob {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mandala//UMich Classes//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:My Classes',
  ];

  const now = toICalUTC(new Date());

  for (const cls of classes) {
    for (const dayName of cls.days) {
      const firstOccurrence = nextOccurrence(dayName, cls.startTime);

      // Build start and end Date objects
      const [sh, sm] = cls.startTime.split(':').map(Number);
      const [eh, em] = cls.endTime.split(':').map(Number);
      const startDate = new Date(firstOccurrence);
      startDate.setHours(sh, sm, 0, 0);
      const endDate = new Date(firstOccurrence);
      endDate.setHours(eh, em, 0, 0);
      if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1); // safety

      const uid = `mandala-class-${cls.id}-${dayName}@umich.edu`;
      const summary = `${cls.abbreviation} — ${cls.name}`;

      lines.push('BEGIN:VEVENT');
      pushLine(lines, `UID:${uid}`);
      pushLine(lines, `DTSTAMP:${now}`);
      pushLine(lines, `DTSTART:${toICalUTC(startDate)}`);
      pushLine(lines, `DTEND:${toICalUTC(endDate)}`);
      pushLine(lines, `SUMMARY:${esc(summary)}`);
      pushLine(lines, `DESCRIPTION:${esc(cls.name)}`);

      if (mode === 'repeat-forever') {
        pushLine(lines, `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_ICAL[dayName]}`);
      } else if (mode === 'repeat-semester') {
        // 16-week semester from first occurrence
        const until = new Date(startDate);
        until.setDate(until.getDate() + 16 * 7);
        pushLine(lines, `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_ICAL[dayName]};UNTIL=${toICalUTC(until)}`);
      }
      // 'this-week' → no RRULE, just the single concrete event

      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
}

export function downloadClassICS(classes: ClassBlock[], mode: ClassExportMode): void {
  const modeLabel = mode === 'this-week' ? 'this-week' : mode === 'repeat-semester' ? 'semester' : 'recurring';
  triggerDownload(generateClassICS(classes, mode), `my-classes-${modeLabel}.ics`);
}

// ── Shared download trigger ───────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

