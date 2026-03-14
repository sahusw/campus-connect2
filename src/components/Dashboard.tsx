import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { discoverEvents, inferCourseTopics, generateWeeklyPlan } from '@/lib/api';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { EventCard } from '@/components/EventCard';
import { EventsExplorer } from '@/components/EventsExplorer';
import { Sparkles, RefreshCw, Calendar, Star, LogOut, Loader2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CampusEvent, ScheduleBlock } from '@/lib/types';

type DashView = 'planner' | 'explore';

export function Dashboard() {
  const { profile, classes, setStep, weekGenerated, setWeekGenerated, scheduleBlocks, setScheduleBlocks, setEvents } = useAppStore();
  const [generating, setGenerating] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setLocalEvents] = useState<CampusEvent[]>([]);
  const [courseKeywords, setCourseKeywords] = useState<string[]>([]);
  const [view, setView] = useState<DashView>('planner');
  const { toast } = useToast();

  // On mount, discover events and infer topics
  useEffect(() => {
    const init = async () => {
      setLoadingEvents(true);
      try {
        const keywordsPromise = classes.length > 0
          ? inferCourseTopics(classes)
          : Promise.resolve([]);

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
          description: e instanceof Error ? e.message : 'Could not load events. You can still generate your week.',
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
      const planBlocks = await generateWeeklyPlan(
        classes,
        events,
        profile.timePreferences || [],
        profile.interests || []
      );

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
    setTimeout(generateWeek, 300);
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

          {/* Nav tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setView('planner')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                view === 'planner'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Week Planner
            </button>
            <button
              onClick={() => setView('explore')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                view === 'explore'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Explore Events
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile.university}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStep('onboarding'); setWeekGenerated(false); }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Explore Events view */}
      {view === 'explore' && <EventsExplorer />}

      {/* Week Planner view */}
      {view === 'planner' && (
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Hero / Generate section */}
          {!weekGenerated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
                    <span key={kw} className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary font-medium">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button
                  size="lg"
                  onClick={generateWeek}
                  disabled={generating || loadingEvents}
                  className="gap-2 text-base px-8"
                >
                  {generating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> Generate My Week</>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setView('explore')}
                  className="gap-2 text-base"
                >
                  <Compass className="w-5 h-5" /> Explore Live Events
                </Button>
              </div>
            </motion.div>
          )}

          {weekGenerated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Controls */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-display">Your Week</h1>
                  <p className="text-sm text-muted-foreground">
                    {classes.length} classes · {scheduleBlocks.filter(b => b.type === 'study').length} study blocks · {scheduleBlocks.filter(b => b.type === 'event').length} events
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                {/* Calendar */}
                <div className="lg:col-span-2 overflow-x-auto">
                  <WeeklyCalendar blocks={scheduleBlocks} events={events} />
                </div>

                {/* Events sidebar */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-campus-coral" />
                    <h2 className="font-display text-lg">Recommended Events</h2>
                  </div>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {sortedEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 text-center">No events discovered yet.</p>
                    ) : (
                      sortedEvents.map((event) => (
                        <EventCard key={event.id} event={event} compact />
                      ))
                    )}
                  </div>
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
