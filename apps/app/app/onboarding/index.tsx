import { Redirect } from 'expo-router';

import { OnboardingLoadingView } from '../../src/onboarding/components/OnboardingLoadingView';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { stepPath } from '../../src/onboarding/steps';

/**
 * The way into setup: where the guard sends a signed-in person who has no circle
 * yet, and where someone lands after closing the app mid-flow.
 *
 * It reads the stored draft and forwards to the step they were on — but only
 * as far as their answers justify (`resumeStep`), so nobody arrives at "invite
 * family" for a person who was never named.
 */
export default function OnboardingEntry() {
  const { status, resumeAt } = useOnboarding();

  if (status === 'loading') {
    return <OnboardingLoadingView />;
  }

  return <Redirect href={stepPath(resumeAt)} />;
}
