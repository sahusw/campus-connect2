import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { SUPPORTED_UNIVERSITY } from '@/lib/constants';
import { INTERESTS_OPTIONS, YEAR_OPTIONS, TIME_OPTIONS } from '@/lib/mockData';
import type { Interest, TimePreference } from '@/lib/types';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { MandalaLogo } from '@/components/MandalaLogo';
import { Button } from '@/components/ui/button';

const STEPS = ['university', 'year', 'interests', 'times'] as const;

export function OnboardingFlow() {
  const { onboardingStep, setOnboardingStep, updateProfile, profile, setStep } = useAppStore();

  useEffect(() => {
    if (profile.university !== SUPPORTED_UNIVERSITY) {
      updateProfile({ university: SUPPORTED_UNIVERSITY });
    }
  }, [profile.university, updateProfile]);

  const canProceed = () => {
    switch (STEPS[onboardingStep]) {
      case 'university': return true;
      case 'year': return !!profile.year;
      case 'interests': return (profile.interests?.length || 0) > 0;
      case 'times': return (profile.timePreferences?.length || 0) > 0;
      default: return false;
    }
  };

  const next = () => {
    if (STEPS[onboardingStep] === 'university') {
      updateProfile({ university: SUPPORTED_UNIVERSITY });
    }
    if (onboardingStep < STEPS.length - 1) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      setStep('upload');
    }
  };

  const back = () => {
    if (onboardingStep > 0) setOnboardingStep(onboardingStep - 1);
  };

  const toggleInterest = (interest: Interest) => {
    const current = profile.interests || [];
    const updated = current.includes(interest)
      ? current.filter((i) => i !== interest)
      : [...current, interest];
    updateProfile({ interests: updated });
  };

  const toggleTime = (time: TimePreference) => {
    const current = profile.timePreferences || [];
    const updated = current.includes(time)
      ? current.filter((t) => t !== time)
      : [...current, time];
    updateProfile({ timePreferences: updated });
  };

  return (
    <div className="min-h-screen campus-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= onboardingStep ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={onboardingStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {STEPS[onboardingStep] === 'university' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MandalaLogo className="w-6 h-6 text-primary" />
                    <span className="text-sm font-medium text-primary">Mandala</span>
                  </div>
                  <h1 className="text-3xl font-display mb-2">Mandala currently serves UMich only</h1>
                  <p className="text-muted-foreground">Your account will be set to the University of Michigan for event discovery and planning.</p>
                </div>
                <div className="campus-card p-5 bg-card">
                  <div className="text-sm text-muted-foreground mb-1">Supported school</div>
                  <div className="text-lg font-medium">{SUPPORTED_UNIVERSITY}</div>
                </div>
              </div>
            )}

            {STEPS[onboardingStep] === 'year' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-display mb-2">What year are you in?</h1>
                  <p className="text-muted-foreground">This helps us tailor recommendations to your level.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {YEAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateProfile({ year: opt.value })}
                      className={`campus-card-hover p-5 text-left transition-all ${
                        profile.year === opt.value
                          ? 'ring-2 ring-primary bg-campus-sage-light'
                          : ''
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{opt.emoji}</span>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {STEPS[onboardingStep] === 'interests' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-display mb-2">What are you into?</h1>
                  <p className="text-muted-foreground">Select all that interest you. We'll find matching events.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {INTERESTS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => toggleInterest(opt.value)}
                      className={`campus-card-hover p-4 text-left transition-all ${
                        profile.interests?.includes(opt.value)
                          ? 'ring-2 ring-primary bg-campus-sage-light'
                          : ''
                      }`}
                    >
                      <span className="text-xl mb-1 block">{opt.emoji}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {STEPS[onboardingStep] === 'times' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-display mb-2">When do you prefer activities?</h1>
                  <p className="text-muted-foreground">We'll schedule events during your preferred windows.</p>
                </div>
                <div className="space-y-3">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => toggleTime(opt.value)}
                      className={`campus-card-hover p-5 w-full text-left flex items-center gap-4 transition-all ${
                        profile.timePreferences?.includes(opt.value)
                          ? 'ring-2 ring-primary bg-campus-sage-light'
                          : ''
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <div>
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-sm text-muted-foreground">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={back}
            disabled={onboardingStep === 0}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={next}
            disabled={!canProceed()}
            className="gap-2"
          >
            {onboardingStep === STEPS.length - 1 ? 'Continue' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

