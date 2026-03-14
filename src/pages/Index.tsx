import { useAppStore } from '@/lib/store';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { ScheduleUpload } from '@/components/ScheduleUpload';
import { Dashboard } from '@/components/Dashboard';

const Index = () => {
  const step = useAppStore((s) => s.step);

  return (
    <>
      {step === 'onboarding' && <OnboardingFlow />}
      {step === 'upload' && <ScheduleUpload />}
      {step === 'dashboard' && <Dashboard />}
    </>
  );
};

export default Index;
