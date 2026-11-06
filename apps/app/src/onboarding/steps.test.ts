import { describe, expect, it } from 'vitest';

import {
  ONBOARDING_ROOT,
  ONBOARDING_STEPS,
  STEP_COUNT,
  isOnboardingRoute,
  isOnboardingStep,
  nextStep,
  previousStep,
  stepLabel,
  stepNumber,
  stepPath,
} from './steps';

describe('the three steps', () => {
  it('are exactly three, in the order the brief gives', () => {
    expect(ONBOARDING_STEPS).toEqual(['you', 'care', 'invite']);
    expect(STEP_COUNT).toBe(3);
  });

  it('number from one', () => {
    expect(stepNumber('you')).toBe(1);
    expect(stepNumber('care')).toBe(2);
    expect(stepNumber('invite')).toBe(3);
  });

  it('say "Step n of 3" quietly', () => {
    expect(stepLabel('you')).toBe('Step 1 of 3');
    expect(stepLabel('care')).toBe('Step 2 of 3');
    expect(stepLabel('invite')).toBe('Step 3 of 3');
  });

  it('have their own path, under one root', () => {
    expect(stepPath('you')).toBe('/onboarding/you');
    expect(stepPath('care')).toBe('/onboarding/care');
    expect(stepPath('invite')).toBe('/onboarding/invite');
    expect(ONBOARDING_ROOT).toBe('/onboarding');
  });
});

describe('moving between steps', () => {
  it('goes forward until the last screen, then stops', () => {
    expect(nextStep('you')).toBe('care');
    expect(nextStep('care')).toBe('invite');
    expect(nextStep('invite')).toBeNull();
  });

  it('goes back until the first screen, then stops', () => {
    expect(previousStep('you')).toBeNull();
    expect(previousStep('care')).toBe('you');
    expect(previousStep('invite')).toBe('care');
  });
});

describe('route classification', () => {
  it('recognises the onboarding routes', () => {
    expect(isOnboardingRoute(['onboarding'])).toBe(true);
    expect(isOnboardingRoute(['onboarding', 'care'])).toBe(true);
    expect(isOnboardingRoute(['(tabs)', 'index'])).toBe(false);
    expect(isOnboardingRoute([])).toBe(false);
  });

  it('recognises a step, and nothing else', () => {
    expect(isOnboardingStep('care')).toBe(true);
    expect(isOnboardingStep('nope')).toBe(false);
    expect(isOnboardingStep(undefined)).toBe(false);
    expect(isOnboardingStep(2)).toBe(false);
  });
});
