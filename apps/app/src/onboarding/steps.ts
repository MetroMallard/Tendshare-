/**
 * The three onboarding screens, as data.
 *
 * Three is the whole budget. A person who has just signed in on a phone in a
 * hospital corridor gets asked three short things and then lands on Today:
 *
 *   1. **You** — what we should call them.
 *   2. **Who you're caring for** — a first name and how they are related.
 *   3. **Invite family** — the addresses, or an honest "later".
 *
 * The order, the paths and the "Step 1 of 3" label all come from this file, so
 * a screen cannot disagree with the progress indicator or with the guard about
 * where a step lives.
 */

export const ONBOARDING_STEPS = ['you', 'care', 'invite'] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The path segment the group lives under: `/onboarding/you`. */
export const ONBOARDING_SEGMENT = 'onboarding';

/** Where the guard sends a signed-in person who has no circle yet. */
export const ONBOARDING_ROOT = '/onboarding';

export const STEP_COUNT = ONBOARDING_STEPS.length;

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

/** `/onboarding/care` — never built by hand in a screen. */
export function stepPath(step: OnboardingStep): string {
  return `${ONBOARDING_ROOT}/${step}`;
}

/** 1, 2 or 3. */
export function stepNumber(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

/**
 * "Step 1 of 3" — quiet, in the eyebrow position. A loud stepper with three
 * circles and a progress bar reads as a form to fill in, which is exactly the
 * feeling onboarding has to avoid.
 */
export function stepLabel(step: OnboardingStep): string {
  return `Step ${String(stepNumber(step))} of ${String(STEP_COUNT)}`;
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepNumber(step)] ?? null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return stepNumber(step) > 1 ? (ONBOARDING_STEPS[stepNumber(step) - 2] ?? null) : null;
}

/** From `useSegments()`: is this route inside the onboarding group? */
export function isOnboardingRoute(segments: readonly string[]): boolean {
  return segments[0] === ONBOARDING_SEGMENT;
}
