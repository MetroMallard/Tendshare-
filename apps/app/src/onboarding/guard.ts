/**
 * The onboarding gate, as a pure function.
 *
 * Task 4 answered "signed in or not?" with `resolveAuthRedirect`. This is the
 * second half of the same question, and it is deliberately a separate function
 * rather than a bigger one: auth does not know what a circle is, and the circle
 * lookup must never be able to lock a signed-out person out of sign-in.
 *
 * Two rules, in order of importance:
 *
 *   1. **Nobody with a circle ever sees onboarding again.** Someone who finished
 *      setup on their phone and then signs in on a laptop must land on Today, not
 *      on "What should we call you?".
 *   2. **Nobody without one is dropped into an empty app.** A signed-in person
 *      with no circle belongs in setup — that is the only screen that can give
 *      them something to look at.
 *
 * And one refusal that matters as much as the rules: while the answer is still
 * loading, or when the lookup failed, this returns `null`. Moving a person on a
 * guess is how a slow network becomes a redirect loop.
 */
import { HOME_PATH, isHiddenRoute } from '../navigation/authGuard';
import type { CircleState } from '../circles/circleState';
import { ONBOARDING_ROOT, isOnboardingRoute } from './steps';

export interface OnboardingGuardInput {
  readonly status: 'loading' | 'signedOut' | 'signedIn' | 'notConfigured';
  /** From `useSegments()`: `['onboarding','care']`, `['(tabs)','index']`, `[]`… */
  readonly segments: readonly string[];
  readonly circleState: CircleState;
}

export function resolveOnboardingRedirect({
  status,
  segments,
  circleState,
}: OnboardingGuardInput): string | null {
  // Signed out, still loading, or built without a server: the auth guard owns
  // every one of those cases, and it runs first.
  if (status !== 'signedIn') {
    return null;
  }

  // The component gallery, the auth preview and the onboarding preview hold no
  // care data and exist so the owner and QA can look at states on purpose.
  if (isHiddenRoute(segments)) {
    return null;
  }

  // No opinion yet — and an error is not an answer.
  if (circleState === 'loading' || circleState === 'error') {
    return null;
  }

  const inOnboarding = isOnboardingRoute(segments);

  if (circleState === 'ready') {
    return inOnboarding ? HOME_PATH : null;
  }

  // 'none' or 'incomplete': setup is where this person belongs. `incomplete`
  // stays in the flow on purpose — the resumed run adopts the half-made circle
  // instead of creating a second one.
  return inOnboarding ? null : ONBOARDING_ROOT;
}
