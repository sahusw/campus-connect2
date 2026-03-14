export type Year = 'freshman' | 'sophomore' | 'junior' | 'senior';

export type Interest = 
  | 'technology' | 'entrepreneurship' | 'sports' | 'music' 
  | 'research' | 'social' | 'arts' | 'wellness';

export type TimePreference = 'morning' | 'afternoon' | 'evening';

export interface UserProfile {
  university: string;
  year: Year;
  interests: Interest[];
  timePreferences: TimePreference[];
}

export interface ClassBlock {
  id: string;
  name: string;
  abbreviation: string;
  days: string[];
  startTime: string;
  endTime: string;
  color: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  time: string;
  date: string;
  day: string;
  location: string;
  category: Interest;
  relevance: number;
  tags: string[];
  detailsUrl?: string;
}

export interface ScheduleBlock {
  id: string;
  type: 'class' | 'study' | 'event' | 'free';
  title: string;
  startTime: string;
  endTime: string;
  day: string;
  color: string;
  location?: string;
  description?: string;
}
