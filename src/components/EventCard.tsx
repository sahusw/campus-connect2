import { motion } from 'framer-motion';
import type { CampusEvent } from '@/lib/types';
import { CalendarPlus, Clock, ExternalLink, MapPin, TrendingUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const CATEGORY_STYLES: Record<string, string> = {
  technology: 'bg-campus-sage-light text-campus-sage',
  entrepreneurship: 'bg-campus-coral-light text-campus-coral',
  research: 'bg-campus-sky-light text-campus-sky',
  sports: 'bg-campus-amber-light text-campus-amber',
  wellness: 'bg-campus-violet-light text-campus-violet',
  arts: 'bg-campus-coral-light text-campus-coral',
  social: 'bg-campus-amber-light text-campus-amber',
  music: 'bg-campus-violet-light text-campus-violet',
};
const DEFAULT_EVENT_DURATION_MINUTES = 60;

interface EventCardProps {
  event: CampusEvent;
  compact?: boolean;
}

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

function buildFallbackDetailsUrl(event: CampusEvent) {
  if (event.detailsUrl) return event.detailsUrl;

  const query = [event.title, event.location, event.date].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function EventCard({ event, compact }: EventCardProps) {
  const catStyle = CATEGORY_STYLES[event.category] || 'bg-muted text-muted-foreground';
  const detailsUrl = buildFallbackDetailsUrl(event);
  const calendarUrl = buildGoogleCalendarUrl(event);

  const cardBody = compact ? (
    <div className="campus-card-hover p-3 space-y-1.5 text-left">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm leading-tight">{event.title}</h4>
        <span className="flex items-center gap-1 text-xs text-campus-sage font-medium shrink-0">
          <TrendingUp className="w-3 h-3" />
          {event.relevance}%
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {event.date} · {event.time}
        </span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${catStyle}`}>
          {event.category}
        </span>
      </div>
    </div>
  ) : (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="campus-card-hover p-4 space-y-3 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-tight">{event.title}</h3>
        <span className="flex items-center gap-1 text-sm text-campus-sage font-semibold shrink-0">
          <TrendingUp className="w-4 h-4" />
          {event.relevance}%
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> {event.date} · {event.time}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4" /> {event.location}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${catStyle}`}>
          {event.category}
        </span>
        {event.tags.map((tag) => (
          <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-muted text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {cardBody}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="space-y-1">
          <h4 className="font-medium leading-tight">{event.title}</h4>
          <p className="text-xs text-muted-foreground">{event.date} · {event.time} · {event.location}</p>
        </div>
        <div className="flex flex-col gap-2">
          <a
            href={detailsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            View event details
            <ExternalLink className="w-4 h-4" />
          </a>
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
      </PopoverContent>
    </Popover>
  );
}
