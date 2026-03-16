import type { CampusEvent } from '@/lib/types';
import { CalendarPlus, ExternalLink } from 'lucide-react';
import { buildGCalURL } from '@/lib/calendarExport';

interface EventPopoverContentProps {
  event: CampusEvent;
}

export function EventPopoverContent({ event }: EventPopoverContentProps) {
  const calendarUrl = buildGCalURL(event);
  const detailsUrl = event.url;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="font-medium leading-tight">{event.title}</h4>
        <p className="text-xs text-muted-foreground">
          {event.date} · {event.time}
          {event.location ? ` · ${event.location}` : ''}
        </p>
      </div>

      {event.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{event.description}</p>
      )}

      <div className="flex flex-col gap-2">
        {detailsUrl ? (
          <a
            href={detailsUrl}
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
