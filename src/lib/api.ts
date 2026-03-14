import { supabase } from '@/integrations/supabase/client';
import type { ClassBlock, CampusEvent } from './types';

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
  const { data, error } = await supabase.functions.invoke('discover-events', {
    body: { university, interests, courseKeywords, year },
  });

  if (error) throw new Error(error.message || 'Failed to discover events');
  if (data?.error) throw new Error(data.error);

  return data.events || [];
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
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
