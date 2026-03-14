import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Calendar, Download, Search, Filter, CheckSquare,
  Square, Loader2, ExternalLink, MapPin, Clock, X,
  CalendarPlus, ChevronDown, RefreshCw, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import type { Interest } from '@/lib/types';
import {
  fetchUMichEvents,
  scoreEventsWithAI,
  generateICS,
  buildGCalURL,
  type UMichEvent,
} from '@/lib/umichEvents';

const EVENT_TYPES = [
  'All Types',
  'Lecture / Discussion',
  'Workshop / Seminar',
  'Performance',
  'Sporting Event',
  'Exhibition',
  'Film Screening',
  'Social / Informal Gathering',
  'Conference / Symposium',
  'Fair / Festival',
  'Well-being',
  'Community Service',
  'Careers / Jobs',
];

const INTEREST_LABELS: Record<Interest, string> = {
  technology: '💻 Technology',
  entrepreneurship: '🚀 Entrepreneurship',
  sports: '⚽ Sports',
  music: '🎵 Music',
  research: '🔬 Research',
  social: '🎉 Social',
  arts: '🎨 Arts',
  wellness: '🧘 Wellness',
};

const RELEVANCE_COLOR = (r: number) => {
  if (r >= 80) return 'text-campus-sage bg-campus-sage-light border-campus-sage';
  if (r >= 60) return 'text-campus-sky bg-campus-sky-light border-campus-sky';
  if (r >= 40) return 'text-campus-amber bg-campus-amber-light border-campus-amber';
  return 'text-muted-foreground bg-muted border-border';
};

type Tab = 'all' | 'suggested';

export function EventsExplorer() {
  const { profile, classes } = useAppStore();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('all');
  const [events, setEvents] = useState<UMichEvent[]>([]);
  const [suggestedEvents, setSuggestedEvents] = useState<UMichEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);

  // Fetch real events on mount
  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoadingEvents(true);
    try {
      const fetched = await fetchUMichEvents();
      setEvents(fetched);
    } catch (err) {
      toast({
        title: 'Could not load events',
        description: err instanceof Error ? err.message : 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadSuggestions() {
    if (!events.length) { toast({ title: 'Events still loading…', description: 'Please wait a moment and try again.' }); return; }
    setLoadingSuggestions(true);
    setTab('suggested');
    try {
      const courseKeywords = classes.flatMap((c) => [c.name, c.abbreviation]);
      const scored = await scoreEventsWithAI(
        events,
        profile.interests || [],
        courseKeywords
      );
      setSuggestedEvents(scored.filter((e) => e.relevance >= 40).slice(0, 30));
    } catch (err) {
      toast({
        title: 'AI suggestion failed',
        description: err instanceof Error ? err.message : 'Could not get suggestions.',
        variant: 'destructive',
      });
      setSuggestedEvents([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  // Filtered view for "All" tab
  const displayedEvents = useMemo(() => {
    let list = tab === 'suggested' ? suggestedEvents : events;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.eventType.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'All Types') {
      list = list.filter((e) => e.eventType === typeFilter);
    }
    return list;
  }, [tab, events, suggestedEvents, search, typeFilter]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      displayedEvents.forEach((e) => next.add(e.id));
      return next;
    });
    toast({ title: `Selected ${displayedEvents.length} events` });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function getSelectedEvents(): UMichEvent[] {
    return [...events, ...suggestedEvents].filter(
      (e, i, arr) => selectedIds.has(e.id) && arr.findIndex((x) => x.id === e.id) === i
    );
  }

  function downloadICS() {
    const sel = getSelectedEvents();
    if (!sel.length) return;
    const blob = generateICS(sel);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'umich-events.ics';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${sel.length} events as .ics` });
    setCalendarMenuOpen(false);
  }

  function addToGoogleCalendar() {
    const sel = getSelectedEvents();
    if (!sel.length) return;
    if (sel.length === 1) {
      window.open(buildGCalURL(sel[0]), '_blank');
    } else {
      // Open up to 5 in separate tabs
      sel.slice(0, 5).forEach((e) => window.open(buildGCalURL(e), '_blank'));
      if (sel.length > 5) {
        toast({ title: `Opened first 5 events`, description: 'Download .ics to add all at once.' });
      }
    }
    setCalendarMenuOpen(false);
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-display text-lg">Explore Events</span>
            {!loadingEvents && (
              <span className="text-xs text-muted-foreground ml-1">
                {events.length} live events from events.umich.edu
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === 'all' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => { if (suggestedEvents.length === 0) loadSuggestions(); else setTab('suggested'); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                tab === 'suggested' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              For You
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadSuggestions()}
            disabled={loadingSuggestions || loadingEvents}
            className="gap-1.5 text-xs hidden sm:flex"
          >
            {loadingSuggestions ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh suggestions
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* "For You" banner */}
        <AnimatePresence>
          {tab === 'suggested' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="campus-gradient rounded-xl p-4 flex items-center gap-3"
            >
              <Star className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Personalized for your interests</p>
                <p className="text-xs text-muted-foreground">
                  Based on: {(profile.interests || []).map((i) => INTEREST_LABELS[i]).join(' · ') || 'your profile'}
                </p>
              </div>
              {loadingSuggestions && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto text-primary shrink-0" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search + filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, locations, keywords…"
              className="pl-9 h-9 bg-card"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Type filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTypeMenu((v) => !v)}
              className="h-9 px-3 rounded-md border border-border bg-card text-sm flex items-center gap-2 hover:bg-muted transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{typeFilter}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {showTypeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute top-full mt-1 right-0 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[220px]"
                >
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTypeFilter(t); setShowTypeMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${
                        typeFilter === t ? 'text-primary font-medium' : 'text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Select all / clear */}
          <Button variant="outline" size="sm" onClick={selectAll} className="gap-1.5 h-9">
            <CheckSquare className="w-3.5 h-3.5" /> Select all
          </Button>
          {selectedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1.5 h-9">
              <Square className="w-3.5 h-3.5" /> Clear ({selectedCount})
            </Button>
          )}
        </div>

        {/* Result count */}
        <p className="text-xs text-muted-foreground">
          {loadingEvents || loadingSuggestions
            ? 'Loading…'
            : `${displayedEvents.length} event${displayedEvents.length !== 1 ? 's' : ''}`}
          {selectedCount > 0 && ` · ${selectedCount} selected`}
        </p>

        {/* Loading skeleton */}
        {(loadingEvents || (tab === 'suggested' && loadingSuggestions)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-pulse">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-4/5" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Event grid */}
        {!loadingEvents && !(tab === 'suggested' && loadingSuggestions) && (
          <>
            {displayedEvents.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground space-y-2">
                <Calendar className="w-10 h-10 mx-auto opacity-30" />
                <p className="font-medium">No events found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {displayedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    selected={selectedIds.has(event.id)}
                    onToggle={() => toggleSelect(event.id)}
                    showRelevance={tab === 'suggested'}
                  />
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Sticky calendar action bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">
                {selectedCount} event{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <div className="flex flex-wrap gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </Button>

                {/* Calendar dropdown */}
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => setCalendarMenuOpen((v) => !v)}
                    className="gap-1.5"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Add to Calendar
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <AnimatePresence>
                    {calendarMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute bottom-full mb-2 right-0 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[200px]"
                      >
                        <button
                          onClick={downloadICS}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2.5"
                        >
                          <Download className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Download .ics file</div>
                            <div className="text-xs text-muted-foreground">Works with Apple, Outlook & more</div>
                          </div>
                        </button>
                        <button
                          onClick={addToGoogleCalendar}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2.5"
                        >
                          <CalendarPlus className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Add to Google Calendar</div>
                            <div className="text-xs text-muted-foreground">
                              {selectedCount > 5 ? `Opens first 5 (use .ics for all)` : `Opens ${selectedCount} tab${selectedCount !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Single Event Card ----

interface EventCardProps {
  event: UMichEvent;
  selected: boolean;
  onToggle: () => void;
  showRelevance: boolean;
}

function EventCard({ event, selected, onToggle, showRelevance }: EventCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border bg-card p-4 cursor-pointer transition-all hover:shadow-md group ${
        selected ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-border/80'
      }`}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div className="absolute top-3 right-3" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="h-4 w-4"
        />
      </div>

      <div className="space-y-2.5 pr-6">
        {/* Type badge + relevance */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
            {event.eventType}
          </span>
          {showRelevance && event.relevance > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${RELEVANCE_COLOR(event.relevance)}`}>
              {event.relevance}% match
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-medium text-sm leading-snug line-clamp-2">{event.title}</h3>

        {/* Date/time */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{event.date}{event.timeDisplay ? ` · ${event.timeDisplay}` : ''}</span>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{event.description}</p>
        )}

        {/* Tags + link */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {event.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-[10px] text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Details <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
