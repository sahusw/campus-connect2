import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EventPopoverContent } from '@/components/EventPopoverContent';
import type { CampusEvent, ScheduleBlock } from '@/lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

function timeToRow(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h - 8) * 4 + Math.floor(m / 15) + 2;
}

function formatHour(h: number): string {
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

const TYPE_LABELS: Record<string, string> = {
  class: 'C',
  study: 'S',
  event: 'E',
  free: '',
};

interface WeeklyCalendarProps {
  blocks: ScheduleBlock[];
  events: CampusEvent[];
}

function findMatchingEvent(block: ScheduleBlock, events: CampusEvent[]) {
  return events.find((event) =>
    event.title === block.title &&
    event.day === block.day &&
    event.time === block.startTime &&
    (event.location || '') === (block.location || '')
  );
}

export function WeeklyCalendar({ blocks, events }: WeeklyCalendarProps) {
  const dayColumns = useMemo(() => {
    return DAYS.map((day) => ({
      day,
      blocks: blocks.filter((b) => b.day === day),
    }));
  }, [blocks]);

  return (
    <div className="campus-card overflow-x-auto">
      <div
        className="grid min-h-[600px] min-w-[980px] grid-cols-[60px_repeat(7,minmax(130px,1fr))]"
        style={{ gridTemplateRows: `40px repeat(${14 * 4}, 1fr)` }}
      >
        <div className="border-b border-r bg-muted/50 p-2" />
        {DAYS.map((day) => (
          <div key={day} className="border-b border-r bg-muted/50 p-2 text-center">
            <span className="text-xs font-semibold text-muted-foreground">{day}</span>
          </div>
        ))}

        {HOURS.map((hour) => (
          <div
            key={hour}
            className="border-r pr-2 pt-0.5 text-right text-[10px] text-muted-foreground"
            style={{ gridRow: `${(hour - 8) * 4 + 2} / span 4`, gridColumn: 1 }}
          >
            {formatHour(hour)}
          </div>
        ))}

        {HOURS.map((hour) =>
          DAYS.map((_, di) => (
            <div
              key={`grid-${hour}-${di}`}
              className="border-b border-r border-border/50"
              style={{
                gridRow: `${(hour - 8) * 4 + 2} / span 4`,
                gridColumn: di + 2,
              }}
            />
          ))
        )}

        {dayColumns.map(({ blocks: dayBlocks }, di) =>
          dayBlocks.map((block) => {
            const startRow = timeToRow(block.startTime);
            const endRow = timeToRow(block.endTime);
            const span = Math.max(1, endRow - startRow);
            const matchingEvent = block.type === 'event' ? findMatchingEvent(block, events) : undefined;
            const blockClassName = `${block.color} border-l-3 m-0.5 flex h-full flex-col overflow-hidden rounded-md p-1.5 transition-all hover:shadow-md z-10 ${matchingEvent ? 'cursor-pointer' : 'cursor-default'}`;
            const blockStyle = {
              gridRow: `${startRow} / span ${span}`,
              gridColumn: di + 2,
            };
            const blockInner = (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">{TYPE_LABELS[block.type]}</span>
                  <span className="truncate text-[11px] font-semibold">{block.title}</span>
                </div>
                {span > 3 && (
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {block.startTime}-{block.endTime}
                  </span>
                )}
                {span > 5 && block.location && (
                  <span className="truncate text-[10px] text-muted-foreground">
                    Loc: {block.location}
                  </span>
                )}
              </>
            );

            if (!matchingEvent) {
              return (
                <div key={block.id} className={blockClassName} style={blockStyle}>
                  {blockInner}
                </div>
              );
            }

            return (
              <Popover key={block.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={blockClassName}
                    style={blockStyle}
                  >
                    {blockInner}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" sideOffset={8} className="w-80">
                  <EventPopoverContent event={matchingEvent} />
                </PopoverContent>
              </Popover>
            );
          })
        )}
      </div>
    </div>
  );
}
