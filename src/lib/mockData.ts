import type { ClassBlock, CampusEvent, ScheduleBlock } from './types';

const CLASS_COLORS = [
  'bg-campus-sage-light border-campus-sage',
  'bg-campus-coral-light border-campus-coral',
  'bg-campus-sky-light border-campus-sky',
  'bg-campus-amber-light border-campus-amber',
  'bg-campus-violet-light border-campus-violet',
];

export const MOCK_CLASSES: ClassBlock[] = [
  { id: '1', name: 'Intro to Computer Science', abbreviation: 'EECS 183', days: ['Mon', 'Wed'], startTime: '10:00', endTime: '11:30', color: CLASS_COLORS[0] },
  { id: '2', name: 'Calculus I', abbreviation: 'MATH 115', days: ['Tue', 'Thu'], startTime: '13:00', endTime: '14:30', color: CLASS_COLORS[1] },
  { id: '3', name: 'Intro to Psychology', abbreviation: 'PSYCH 111', days: ['Mon', 'Wed', 'Fri'], startTime: '14:00', endTime: '15:00', color: CLASS_COLORS[2] },
  { id: '4', name: 'Academic Writing', abbreviation: 'ENGLISH 125', days: ['Tue', 'Thu'], startTime: '10:00', endTime: '11:30', color: CLASS_COLORS[3] },
];

export const MOCK_EVENTS: CampusEvent[] = [
  { id: 'e1', title: 'MHacks Hackathon Kickoff', description: 'Join Michigan\'s largest hackathon! Build something amazing in 36 hours.', time: '18:00', date: 'Fri, Mar 20', day: 'Fri', location: 'North Campus', category: 'technology', relevance: 95, tags: ['hackathon', 'coding', 'prizes'], detailsUrl: 'https://mhacks.org' },
  { id: 'e2', title: 'Startup Pitch Night', description: 'Watch student founders pitch their ideas to real investors.', time: '19:00', date: 'Wed, Mar 18', day: 'Wed', location: 'Ross School of Business', category: 'entrepreneurship', relevance: 88, tags: ['startups', 'networking', 'business'], detailsUrl: 'https://cfe.umich.edu' },
  { id: 'e3', title: 'AI Research Seminar', description: 'Prof. Smith presents latest findings in neural architecture search.', time: '16:00', date: 'Thu, Mar 19', day: 'Thu', location: 'BBB 1670', category: 'research', relevance: 92, tags: ['AI', 'research', 'CS'], detailsUrl: 'https://cse.engin.umich.edu' },
  { id: 'e4', title: 'Yoga & Mindfulness', description: 'Free yoga session for students. All levels welcome.', time: '08:00', date: 'Tue, Mar 17', day: 'Tue', location: 'CCRB Studio', category: 'wellness', relevance: 70, tags: ['yoga', 'wellness', 'free'], detailsUrl: 'https://recsports.umich.edu' },
  { id: 'e5', title: 'Open Mic Night', description: 'Perform or watch! Poetry, music, comedy - anything goes.', time: '20:00', date: 'Fri, Mar 20', day: 'Fri', location: 'Michigan Union', category: 'arts', relevance: 65, tags: ['music', 'performance', 'social'], detailsUrl: 'https://uunions.umich.edu' },
  { id: 'e6', title: 'Intramural Basketball', description: 'Sign up for spring intramural basketball leagues.', time: '17:00', date: 'Mon, Mar 16', day: 'Mon', location: 'IMSB', category: 'sports', relevance: 72, tags: ['basketball', 'sports', 'team'], detailsUrl: 'https://recsports.umich.edu/intramurals' },
  { id: 'e7', title: 'Web Dev Workshop', description: 'Learn React and modern web development from scratch.', time: '15:00', date: 'Sat, Mar 21', day: 'Sat', location: 'Duderstadt Center', category: 'technology', relevance: 90, tags: ['coding', 'workshop', 'beginner'], detailsUrl: 'https://www.dc.umich.edu' },
  { id: 'e8', title: 'Career Fair Prep', description: 'Resume reviews, mock interviews, and networking tips.', time: '12:00', date: 'Wed, Mar 18', day: 'Wed', location: 'Career Center', category: 'entrepreneurship', relevance: 85, tags: ['career', 'resume', 'networking'], detailsUrl: 'https://careercenter.umich.edu' },
];

export function generateScheduleBlocks(classes: ClassBlock[], events: CampusEvent[]): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];

  classes.forEach((c) => {
    c.days.forEach((day) => {
      blocks.push({
        id: `class-${c.id}-${day}`,
        type: 'class',
        title: c.abbreviation,
        startTime: c.startTime,
        endTime: c.endTime,
        day,
        color: c.color,
        description: c.name,
      });
    });
  });

  const studyBlocks: Omit<ScheduleBlock, 'id'>[] = [
    { type: 'study', title: 'Study: EECS 183', startTime: '12:00', endTime: '13:00', day: 'Mon', color: 'bg-campus-sage-light/50 border-campus-sage/30' },
    { type: 'study', title: 'Study: MATH 115', startTime: '15:00', endTime: '16:00', day: 'Tue', color: 'bg-campus-coral-light/50 border-campus-coral/30' },
    { type: 'study', title: 'Study: PSYCH 111', startTime: '11:30', endTime: '12:30', day: 'Wed', color: 'bg-campus-sky-light/50 border-campus-sky/30' },
    { type: 'study', title: 'Study: ENGLISH 125', startTime: '12:00', endTime: '13:00', day: 'Thu', color: 'bg-campus-amber-light/50 border-campus-amber/30' },
    { type: 'study', title: 'Review Session', startTime: '10:00', endTime: '11:30', day: 'Fri', color: 'bg-muted border-border' },
  ];

  studyBlocks.forEach((sb, i) => {
    blocks.push({ ...sb, id: `study-${i}` });
  });

  const topEvents = events.slice(0, 4);
  topEvents.forEach((ev) => {
    const endHour = parseInt(ev.time.split(':')[0]) + 1;
    blocks.push({
      id: `event-${ev.id}`,
      type: 'event',
      title: ev.title,
      startTime: ev.time,
      endTime: `${endHour.toString().padStart(2, '0')}:00`,
      day: ev.day,
      color: 'bg-campus-coral-light border-campus-coral',
      location: ev.location,
      description: ev.description,
    });
  });

  return blocks;
}

export const INTERESTS_OPTIONS = [
  { value: 'technology' as const, label: 'Technology', emoji: '💻' },
  { value: 'entrepreneurship' as const, label: 'Entrepreneurship', emoji: '🚀' },
  { value: 'sports' as const, label: 'Sports', emoji: '⚽' },
  { value: 'music' as const, label: 'Music', emoji: '🎵' },
  { value: 'research' as const, label: 'Research', emoji: '🔬' },
  { value: 'social' as const, label: 'Social Events', emoji: '🎉' },
  { value: 'arts' as const, label: 'Arts', emoji: '🎨' },
  { value: 'wellness' as const, label: 'Wellness', emoji: '🧘' },
];

export const YEAR_OPTIONS = [
  { value: 'freshman' as const, label: 'Freshman', emoji: '🌱' },
  { value: 'sophomore' as const, label: 'Sophomore', emoji: '📚' },
  { value: 'junior' as const, label: 'Junior', emoji: '⚡' },
  { value: 'senior' as const, label: 'Senior', emoji: '🎓' },
];

export const TIME_OPTIONS = [
  { value: 'morning' as const, label: 'Morning', emoji: '🌅', desc: '8am – 12pm' },
  { value: 'afternoon' as const, label: 'Afternoon', emoji: '☀️', desc: '12pm – 5pm' },
  { value: 'evening' as const, label: 'Evening', emoji: '🌙', desc: '5pm – 10pm' },
];
