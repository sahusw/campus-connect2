import { motion } from 'framer-motion';
import type { CampusEvent } from '@/lib/types';
import { Clock, MapPin, TrendingUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EventPopoverContent } from '@/components/EventPopoverContent';

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
}

export function EventCard({ event, compact }: EventCardProps) {
  const catStyle = CATEGORY_STYLES[event.category] || 'bg-muted text-muted-foreground';

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
      <PopoverContent align="start" className="w-80">
        <EventPopoverContent event={event} />
      </PopoverContent>
    </Popover>
  );
}
