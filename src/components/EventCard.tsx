import { motion } from 'framer-motion';
import type { CampusEvent } from '@/lib/types';
import { Clock, MapPin, TrendingUp, CalendarPlus, Square, CheckSquare2, ExternalLink } from 'lucide-react';
import { buildGCalURL } from '@/lib/calendarExport';

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

interface EventCardProps {
  event: CampusEvent;
  compact?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function EventCard({ event, compact, selected = false, onToggleSelect }: EventCardProps) {
  const catStyle = CATEGORY_STYLES[event.category] || 'bg-muted text-muted-foreground';
  const calUrl = buildGCalURL(event);
  const selectable = !!onToggleSelect;

  if (compact) {
    return (
      <div
        className={`campus-card-hover p-3 space-y-1.5 relative transition-all ${
          selected ? 'ring-2 ring-primary bg-primary/5' : ''
        }`}
      >
        {selectable && (
          <button
            onClick={() => onToggleSelect(event.id)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-primary transition-colors"
            title={selected ? 'Deselect' : 'Select for calendar'}
          >
            {selected
              ? <CheckSquare2 className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />
            }
          </button>
        )}

        <div className="flex items-start justify-between gap-2 pr-6">
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${catStyle}`}>
            {event.category}
          </span>
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
              title="View event details"
            >
              <ExternalLink className="w-3 h-3" />
              Details
            </a>
          )}
          {calUrl && !selectable && (
            <a
              href={calUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
              title="Add to Google Calendar"
            >
              <CalendarPlus className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`campus-card-hover p-4 space-y-3 relative transition-all ${
        selected ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
    >
      {selectable && (
        <button
          onClick={() => onToggleSelect(event.id)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-primary transition-colors"
          title={selected ? 'Deselect' : 'Select for calendar'}
        >
          {selected
            ? <CheckSquare2 className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4" />
          }
        </button>
      )}

      <div className="flex items-start justify-between gap-2 pr-6">
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
        {calUrl && (
          <a
            href={calUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Add to Google Calendar
          </a>
        )}
      </div>
    </motion.div>
  );
}