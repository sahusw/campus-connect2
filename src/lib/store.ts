import { create } from 'zustand';
import type { UserProfile, ClassBlock, CampusEvent, ScheduleBlock } from './types';

interface AppState {
  step: 'onboarding' | 'upload' | 'dashboard';
  onboardingStep: number;
  profile: Partial<UserProfile>;
  classes: ClassBlock[];
  events: CampusEvent[];
  scheduleBlocks: ScheduleBlock[];
  weekGenerated: boolean;

  setStep: (step: AppState['step']) => void;
  setOnboardingStep: (step: number) => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  setClasses: (classes: ClassBlock[]) => void;
  setEvents: (events: CampusEvent[]) => void;
  setScheduleBlocks: (blocks: ScheduleBlock[]) => void;
  setWeekGenerated: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  step: 'onboarding',
  onboardingStep: 0,
  profile: {},
  classes: [],
  events: [],
  scheduleBlocks: [],
  weekGenerated: false,

  setStep: (step) => set({ step }),
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
  updateProfile: (data) => set((s) => ({ profile: { ...s.profile, ...data } })),
  setClasses: (classes) => set({ classes }),
  setEvents: (events) => set({ events }),
  setScheduleBlocks: (scheduleBlocks) => set({ scheduleBlocks }),
  setWeekGenerated: (weekGenerated) => set({ weekGenerated }),
}));
