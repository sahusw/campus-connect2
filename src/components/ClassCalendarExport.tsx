import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Download, ChevronDown, Check, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ClassBlock } from '@/lib/types';
import { downloadClassICS, type ClassExportMode } from '@/lib/calendarExport';

interface ClassCalendarExportProps {
  classes: ClassBlock[];
}

const MODES: { value: ClassExportMode; label: string; sublabel: string; icon: React.ReactNode }[] = [
  {
    value: 'this-week',
    label: 'This week only',
    sublabel: 'Adds one session per class for the current week',
    icon: <Calendar className="w-4 h-4 text-campus-sky shrink-0" />,
  },
  {
    value: 'repeat-semester',
    label: 'Repeat for a semester',
    sublabel: 'Repeats weekly for 16 weeks from today',
    icon: <RefreshCw className="w-4 h-4 text-campus-sage shrink-0" />,
  },
  {
    value: 'repeat-forever',
    label: 'Repeat weekly forever',
    sublabel: 'Recurs every week with no end date',
    icon: <RefreshCw className="w-4 h-4 text-campus-coral shrink-0" />,
  },
];

export function ClassCalendarExport({ classes }: ClassCalendarExportProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClassExportMode>('repeat-semester');
  const { toast } = useToast();

  if (classes.length === 0) return null;

  const handleDownload = () => {
    downloadClassICS(classes, selected);
    const modeLabel = MODES.find((m) => m.value === selected)?.label.toLowerCase() ?? '';
    toast({
      title: `Downloaded ${classes.length} class${classes.length !== 1 ? 'es' : ''} as .ics`,
      description: `Mode: ${modeLabel}. Open the file to import into Google Calendar, Apple Calendar, or Outlook.`,
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left"
      >
        <GraduationCap className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-medium flex-1">Add classes to calendar</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-30"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-semibold">Export {classes.length} class{classes.length !== 1 ? 'es' : ''}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose how often to repeat, then download the .ics file.
              </p>
            </div>

            {/* Class list preview */}
            <div className="px-4 pb-3 space-y-1">
              {classes.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`w-2 h-2 rounded-full border ${c.color.split(' ')[0]} ${c.color.split(' ')[1]}`}
                  />
                  <span className="font-medium text-foreground">{c.abbreviation}</span>
                  <span className="truncate">{c.days.join(', ')} · {c.startTime}–{c.endTime}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border" />

            {/* Mode selector */}
            <div className="p-2 space-y-1">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setSelected(mode.value)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                    selected === mode.value
                      ? 'bg-primary/8 border border-primary/25'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  <div className="mt-0.5">{mode.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{mode.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mode.sublabel}</p>
                  </div>
                  {selected === mode.value && (
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-border" />

            {/* Download button */}
            <div className="p-3">
              <Button className="w-full gap-2" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Download .ics file
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Open the downloaded file — your calendar app will import it automatically.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
