import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { discoverEvents, inferCourseTopics, generateWeeklyPlan } from '@/lib/api';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { EventCard } from '@/components/EventCard';
import { EventsExplorer } from '@/components/EventsExplorer';
import {
  Sparkles, RefreshCw, Calendar, Star, LogOut, Loader2, Compass,
  CalendarPlus, Download, CheckSquare, Square, X, ChevronDown, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CampusEvent, ScheduleBlock } from '@/lib/types';
import { downloadICS, buildGCalURL } from '@/lib/calendarExport';
import { ClassCalendarExport } from '@/components/ClassCalendarExport';

type DashView = 'planner' | 'explore';

export function Dashboard() {
  const { profile, classes, setStep, weekGenerated, setWeekGenerated, scheduleBlocks, setScheduleBlocks, setEvents } = useAppStore();
  const [generating, setGenerating] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setLocalEvents] = useState<CampusEvent[]>([]);
  const [courseKeywords, setCourseKeywords] = useState<string[]>([]);
  const [view, setView] = useState<DashView>('planner');

  // Mass-select state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [calDropdownOpen, setCalDropdownOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      setLoadingEvents(true);
      try {
        const keywordsPromise = classes.length > 0 ? inferCourseTopics(classes) : Promise.resolve([]);
        const keywords = await keywordsPromise;
        setCourseKeywords(keywords);

        const discoveredEvents = await discoverEvents(
          profile.university || 'University',
          profile.interests || [],
          keywords,
          profile.year
        );
        setLocalEvents(discoveredEvents);
        setEvents(discoveredEvents);
      } catch (e) {
        console.error('Event discovery error:', e);
        toast({
          title: 'Event discovery issue',
          description: e instanceof Error ? e.message : 'Could not load events.',
          variant: 'destructive',
        });
      } finally {
        setLoadingEvents(false);
      }
    };
    init();
  }, []);

  const generateWeek = async () => {
    setGenerating(true);
    try {
      const planBlocks = await generateWeeklyPlan(classes, events, profile.timePreferences || [], profile.interests || []);
      const classBlocks: ScheduleBlock[] = classes.flatMap((c) =>
        c.days.map((day) => ({
          id: `class-${c.id}-${day}`,
          type: 'class' as const,
          title: c.abbreviation,
          startTime: c.startTime,
          endTime: c.endTime,
          day,
          color: c.color,
          description: c.name,
        }))
      );
      setScheduleBlocks([...classBlocks, ...planBlocks]);
      setWeekGenerated(true);
    } catch (e) {
      console.error('Plan generation error:', e);
      toast({
        title: 'Generation failed',
        description: e instanceof Error ? e.message : 'Could not generate your weekly plan.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = () => {
    setWeekGenerated(false);
    setScheduleBlocks([]);
    setSelectedEventIds(new Set());
    setTimeout(generateWeek, 300);
  };

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleEventSelect = (id: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllEvents = () => {
    setSelectedEventIds(new Set(events.map((e) => e.id)));
    toast({ title: `Selected all ${events.length} events` });
  };

  const clearSelection = () => {
    setSelectedEventIds(new Set());
    setCalDropdownOpen(false);
  };

  const selectedEvents = events.filter((e) => selectedEventIds.has(e.id));

  // ── Calendar export actions ────────────────────────────────────────────────
  const handleDownloadICS = () => {
    if (!selectedEvents.length) return;
    downloadICS(selectedEvents, 'campusflow-events.ics');
    toast({ title: `Downloaded ${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''} as .ics` });
    setCalDropdownOpen(false);
  };

  const handleOpenGCal = () => {
    if (!selectedEvents.length) return;
    const MAX_TABS = 5;
    const toOpen = selectedEvents.slice(0, MAX_TABS);
    toOpen.forEach((ev) => {
      const url = buildGCalURL(ev);
      if (url) window.open(url, '_blank');
    });
    if (selectedEvents.length > MAX_TABS) {
      toast({
        title: `Opened first ${MAX_TABS} in Google Calendar`,
        description: `Use "Download .ics" to add all ${selectedEvents.length} events at once.`,
      });
    }
    setCalDropdownOpen(false);
  };

  const sortedEvents = [...events].sort((a, b) => b.relevance - a.relevance);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-display text-lg">CampusFlow</span>
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setView('planner')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                view === 'planner' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Week Planner
            </button>
            <button
              onClick={() => setView('explore')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                view === 'explore' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> Explore Events
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{profile.university}</span>
            <Button variant="ghost" size="sm" onClick={() => { setStep('onboarding'); setWeekGenerated(false); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {view === 'explore' && <EventsExplorer />}

      {view === 'planner' && (
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Hero / Generate */}
          {!weekGenerated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="campus-gradient rounded-2xl p-8 mb-6 text-center space-y-4"
            >
              <Calendar className="w-12 h-12 mx-auto text-primary" />
              <h1 className="text-3xl font-display">Ready to plan your week?</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                {loadingEvents
                  ? 'Discovering campus events matched to your interests...'
                  : `We'll combine your ${classes.length} classes with ${events.length} campus events matched to your interests.`
                }
              </p>
              {loadingEvents && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding events at {profile.university}...
                </div>
              )}
              {courseKeywords.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                  {courseKeywords.slice(0, 8).map((kw) => (
                    <span key={kw} className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary font-medium">{kw}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button size="lg" onClick={generateWeek} disabled={generating || loadingEvents} className="gap-2 text-base px-8">
                  {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5" /> Generate My Week</>}
                </Button>
                <Button size="lg" variant="outline" onClick={() => setView('explore')} className="gap-2 text-base">
                  <Compass className="w-5 h-5" /> Explore Live Events
                </Button>
              </div>

              {/* Class export — available before generating */}
              {classes.length > 0 && (
                <div className="max-w-xs mx-auto w-full pt-2">
                  <ClassCalendarExport classes={classes} />
                </div>
              )}
            </motion.div>
          )}

          {weekGenerated && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Controls row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-display">Your Week</h1>
                  <p className="text-sm text-muted-foreground">
                    {classes.length} classes · {scheduleBlocks.filter(b => b.type === 'study').length} study blocks · {scheduleBlocks.filter(b => b.type === 'event').length} events
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setView('explore')} className="gap-1.5">
                    <Compass className="w-4 h-4" /> Browse More Events
                  </Button>
                  <Button variant="outline" onClick={regenerate} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Regenerate
                  </Button>
                </div>
              </div>

              {/* Main layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 overflow-x-auto">
                  <WeeklyCalendar blocks={scheduleBlocks} events={events} />
                </div>

                {/* Events sidebar with mass-select */}
                <div className="space-y-3">
                  {/* Class calendar export */}
                  <ClassCalendarExport classes={classes} />

                  {/* Sidebar header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-campus-coral" />
                      <h2 className="font-display text-lg">Recommended Events</h2>
                    </div>
                    {sortedEvents.length > 0 && (
                      <button
                        onClick={selectedEventIds.size === events.length ? clearSelection : selectAllEvents}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {selectedEventIds.size === events.length
                          ? <><Square className="w-3 h-3" /> Deselect all</>
                          : <><CheckSquare className="w-3 h-3" /> Select all</>
                        }
                      </button>
                    )}
                  </div>

                  {/* Selection count + export */}
                  {selectedEventIds.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-xl px-3 py-2"
                    >
                      <span className="text-xs font-medium text-primary flex-1">
                        {selectedEventIds.size} event{selectedEventIds.size !== 1 ? 's' : ''} selected
                      </span>
                      <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}

                  {/* Event list */}
                  <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                    {sortedEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 text-center">No events discovered yet.</p>
                    ) : (
                      sortedEvents.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          compact
                          selected={selectedEventIds.has(event.id)}
                          onToggleSelect={toggleEventSelect}
                        />
                      ))
                    )}
                  </div>

                  {/* Add to Calendar button — shown when anything is selected */}
                  <AnimatePresence>
                    {selectedEventIds.size > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className="relative"
                      >
                        <Button
                          className="w-full gap-2"
                          onClick={() => setCalDropdownOpen((v) => !v)}
                        >
                          <CalendarPlus className="w-4 h-4" />
                          Add {selectedEventIds.size} Event{selectedEventIds.size !== 1 ? 's' : ''} to Calendar
                          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                        </Button>

                        <AnimatePresence>
                          {calDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                              className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-20"
                            >
                              {/* Download .ics — works for ALL calendar apps */}
                              <button
                                onClick={handleDownloadICS}
                                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-start gap-3"
                              >
                                <Download className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">Download .ics file</p>
                                  <p className="text-xs text-muted-foreground">
                                    Adds all {selectedEventIds.size} events at once — works with Google Calendar, Apple Calendar, Outlook
                                  </p>
                                </div>
                              </button>

                              <div className="border-t border-border" />

                              {/* Open in Google Calendar tabs */}
                              <button
                                onClick={handleOpenGCal}
                                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-start gap-3"
                              >
                                <CalendarPlus className="w-4 h-4 mt-0.5 text-campus-coral shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">Open in Google Calendar</p>
                                  <p className="text-xs text-muted-foreground">
                                    {selectedEventIds.size > 5
                                      ? `Opens first 5 tabs — use .ics above to add all ${selectedEventIds.size}`
                                      : `Opens ${selectedEventIds.size} Google Calendar tab${selectedEventIds.size !== 1 ? 's' : ''}`
                                    }
                                  </p>
                                </div>
                              </button>

                              <div className="border-t border-border bg-muted/50 px-4 py-2 flex items-start gap-2">
                                <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                <p className="text-[11px] text-muted-foreground">
                                  Google Calendar doesn't support batch imports via URL — .ics is the best way to add multiple events at once.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-campus-sage-light border border-campus-sage" /> Classes
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-campus-sage-light/50 border border-campus-sage/30" /> Study Blocks
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-campus-coral-light border border-campus-coral" /> Events
                </span>
              </div>
            </motion.div>
          )}
        </main>
      )}
    </div>
  );
}
