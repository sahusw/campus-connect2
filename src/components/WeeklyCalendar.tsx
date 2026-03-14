import { useMemo } from 'react';
import type { ScheduleBlock } from '@/lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am to 9pm

function timeToRow(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h - 8) * 4 + Math.floor(m / 15) + 2; // +2 for header row
}

function formatHour(h: number): string {
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

const TYPE_LABELS: Record<string, string> = {
  class: '📚',
  study: '✏️',
  event: '⭐',
  free: '',
};

interface WeeklyCalendarProps {
  blocks: ScheduleBlock[];
}

export function WeeklyCalendar({ blocks }: WeeklyCalendarProps) {
  const dayColumns = useMemo(() => {
    return DAYS.map((day) => ({
      day,
      blocks: blocks.filter((b) => b.day === day),
    }));
  }, [blocks]);

  return (
    <div className="campus-card overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(6,1fr)] min-h-[600px]" style={{ gridTemplateRows: `40px repeat(${14 * 4}, 1fr)` }}>
        {/* Header */}
        <div className="border-b border-r bg-muted/50 p-2" />
        {DAYS.map((day) => (
          <div key={day} className="border-b border-r bg-muted/50 p-2 text-center">
            <span className="text-xs font-semibold text-muted-foreground">{day}</span>
          </div>
        ))}

        {/* Time labels */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="border-r text-[10px] text-muted-foreground pr-2 text-right pt-0.5"
            style={{ gridRow: `${(hour - 8) * 4 + 2} / span 4`, gridColumn: 1 }}
          >
            {formatHour(hour)}
          </div>
        ))}

        {/* Hour grid lines */}
        {HOURS.map((hour) => (
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
        ))}

        {/* Blocks */}
        {dayColumns.map(({ day, blocks: dayBlocks }, di) =>
          dayBlocks.map((block) => {
            const startRow = timeToRow(block.startTime);
            const endRow = timeToRow(block.endTime);
            const span = endRow - startRow;

            return (
              <div
                key={block.id}
                className={`${block.color} border-l-3 rounded-md m-0.5 p-1.5 overflow-hidden cursor-pointer transition-all hover:shadow-md z-10 flex flex-col`}
                style={{
                  gridRow: `${startRow} / span ${span}`,
                  gridColumn: di + 2,
                }}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">{TYPE_LABELS[block.type]}</span>
                  <span className="text-[11px] font-semibold truncate">{block.title}</span>
                </div>
                {span > 3 && (
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {block.startTime}–{block.endTime}
                  </span>
                )}
                {span > 5 && block.location && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    📍 {block.location}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
