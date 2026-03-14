import type { CampusEvent } from '@/lib/types';
import { CalendarPlus, ExternalLink } from 'lucide-react';

const DEFAULT_EVENT_DURATION_MINUTES = 60;

function parseEventStart(event: CampusEvent) {
  const isoLikeMatch = event.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = event.time.match(/^(\d{1,2}):(\d{2})$/);

  if (isoLikeMatch && timeMatch) {
    const [, year, month, day] = isoLikeMatch;
    const [, hours, minutes] = timeMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
  }

  const directParse = new Date(`${event.date} ${event.time}`);
  if (!Number.isNaN(directParse.getTime())) {
    return directParse;
  }

  const currentYear = new Date().getFullYear();
  const dateLabel = event.date.includes(',')
    ? event.date.split(',').slice(1).join(',').trim()
    : event.date.trim();
  const inferredYearParse = new Date(`${dateLabel} ${currentYear} ${event.time}`);

  if (Number.isNaN(inferredYearParse.getTime())) return null;
  if (inferredYearParse.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
    inferredYearParse.setFullYear(currentYear + 1);
  }

  return inferredYearParse;
}

function formatGoogleCalendarDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function buildGoogleCalendarUrl(event: CampusEvent) {
  const start = parseEventStart(event);
  if (!start) return null;

  const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000);
  const details = [event.description, event.tags.length ? `Tags: ${event.tags.join(', ')}` : '', event.detailsUrl || '']
    .filter(Boolean)
    .join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleCalendarDate(start)}/${formatGoogleCalendarDate(end)}`,
    location: event.location,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface EventPopoverContentProps {
  event: CampusEvent;
}

export function EventPopoverContent({ event }: EventPopoverContentProps) {
  const calendarUrl = buildGoogleCalendarUrl(event);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="font-medium leading-tight">{event.title}</h4>
        <p className="text-xs text-muted-foreground">{event.date} · {event.time} · {event.location}</p>
      </div>
      <div className="flex flex-col gap-2">
        {event.detailsUrl ? (
          <a
            href={event.detailsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            View event details
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            No official event page available.
          </div>
        )}
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Add to Google Calendar
            <CalendarPlus className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
