import { supabase } from '@/integrations/supabase/client';
import type { ClassBlock, CampusEvent } from './types';
import { SUPPORTED_UNIVERSITY } from './constants';
import { fetchUMichEvents } from './umichEvents';

const CLASS_COLORS = [
  'bg-campus-sage-light border-campus-sage',
  'bg-campus-coral-light border-campus-coral',
  'bg-campus-sky-light border-campus-sky',
  'bg-campus-amber-light border-campus-amber',
  'bg-campus-violet-light border-campus-violet',
];

export async function parseScheduleImage(imageBase64: string): Promise<ClassBlock[]> {
  const { data, error } = await supabase.functions.invoke('parse-schedule', {
    body: { imageBase64 },
  });

  if (error) throw new Error(error.message || 'Failed to parse schedule');
  if (data?.error) throw new Error(data.error);

  return (data.courses || []).map((c: any, i: number) => ({
    id: `class-${Date.now()}-${i}`,
    name: c.name,
    abbreviation: c.abbreviation,
    days: c.days,
    startTime: c.startTime,
    endTime: c.endTime,
    color: CLASS_COLORS[i % CLASS_COLORS.length],
  }));
}

export async function inferCourseTopics(courses: ClassBlock[]): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('infer-topics', {
    body: { courses },
  });

  if (error) {
    console.error('Topic inference error:', error);
    return [];
  }
  return data?.keywords || [];
}

export async function discoverEvents(
  university: string,
  interests: string[],
  courseKeywords: string[],
  year?: string
): Promise<CampusEvent[]> {
  const normalizedUniversity = university.trim().toLowerCase();
  const supportedUniversity = SUPPORTED_UNIVERSITY.toLowerCase();

  if (normalizedUniversity && normalizedUniversity !== supportedUniversity && normalizedUniversity !== 'umich') {
    return [];
  }

  const allEvents = await fetchUMichEvents();

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming = allEvents.filter((e) => {
    const d = new Date(`${e.date}T${e.time}:00`);
    return d >= now && d <= windowEnd;
  });

  if (upcoming.length === 0) return [];

  const compactEvents = upcoming.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    tags: e.tags,
    date: e.date,
    time: e.time,
    location: e.location,
  }));

  try {
    const { data, error } = await supabase.functions.invoke('discover-events', {
      body: { interests, courseKeywords, year, events: compactEvents },
    });

    if (error) throw error;

    const rankedIds: Array<{ id: string; relevance: number }> = data?.rankedIds || [];
    const rankMap = new Map(rankedIds.map((r) => [r.id, r.relevance]));

    const ranked = upcoming
      .filter((e) => rankMap.has(e.id))
      .map((e) => ({ ...e, relevance: Math.max(0, Math.min(100, Math.round(rankMap.get(e.id)!))) }))
      .sort((a, b) => b.relevance - a.relevance);

    return ranked.length > 0 ? ranked : fallbackScore(upcoming, interests, courseKeywords);
  } catch (e) {
    console.error('AI ranking failed, using fallback:', e);
    return fallbackScore(upcoming, interests, courseKeywords);
  }
}

function fallbackScore(events: CampusEvent[], interests: string[], courseKeywords: string[]): CampusEvent[] {
  return events
    .map((e) => {
      const haystack = [e.title, e.description, e.location, ...(e.tags || [])].join(' ').toLowerCase();
      let score = 30;
      if (interests.includes(e.category)) score += 30;
      for (const i of interests) {
        if (haystack.includes(i.toLowerCase())) score += 8;
      }
      for (const kw of courseKeywords) {
        if (kw && haystack.includes(kw.toLowerCase())) score += 6;
      }
      return { ...e, relevance: Math.min(100, score) };
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 12);
}

export async function generateWeeklyPlan(
  classes: ClassBlock[],
  events: CampusEvent[],
  timePreferences: string[],
  interests: string[]
) {
  const { data, error } = await supabase.functions.invoke('generate-plan', {
    body: { classes, events, timePreferences, interests },
  });

  if (error) throw new Error(error.message || 'Failed to generate plan');
  if (data?.error) throw new Error(data.error);

  return data.blocks || [];
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}