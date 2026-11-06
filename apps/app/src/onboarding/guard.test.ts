/**
 * `resolveOnboardingRedirect` — the second half of the route guard, as a table.
 *
 * The two rules that matter:
 *   * a person who already has a circle never sees onboarding again;
 *   * a person with no circle is never left staring at an empty app.
 *
 * Both are checked across every route in the app, because either mistake is a
 * person stuck: one in setup they already did, the other in a product that
 * looks broken on first launch.
 */
import { describe, expect, it } from 'vitest';

import { HOME_PATH, SIGN_IN_PATH } from '../navigation/authGuard';
import type { CircleState } from '../circles/circleState';
import { resolveOnboardingRedirect } from './guard';
import { ONBOARDING_ROOT } from './steps';

const SHELL = ['(tabs)', 'index'] as const;
const ROOT: readonly string[] = [];
const YOU = ['onboarding', 'you'] as const;
const CARE = ['onboarding', 'care'] as const;
const INVITE = ['onboarding', 'invite'] as const;
const ONBOARDING_ENTRY = ['onboarding'] as const;
const SIGN_IN = ['(auth)', 'sign-in'] as const;
const GALLERY = ['gallery'] as const;
const AUTH_PREVIEW = ['auth-preview'] as const;
const ONBOARDING_PREVIEW = ['onboarding-preview'] as const;
const CIRCLES_PREVIEW = ['circles-preview'] as const;

const ONBOARDING_ROUTES = [ONBOARDING_ENTRY, YOU, CARE, INVITE] as const;
const SHELL_ROUTES = [SHELL, ROOT] as const;
const HIDDEN_ROUTES = [GALLERY, AUTH_PREVIEW, ONBOARDING_PREVIEW, CIRCLES_PREVIEW] as const;

const CIRCLE_STATES: readonly CircleState[] = ['loading', 'none', 'incomplete', 'ready', 'error'];

describe('a person with a circle', () => {
  it('never sees onboarding, from any of its screens', () => {
    for (const segments of ONBOARDING_ROUTES) {
      expect(
        resolveOnboardingRedirect({ status: 'signedIn', segments, circleState: 'ready' }),
      ).toBe(HOME_PATH);
    }
  });

  it('stays on the app shell', () => {
    for (const segments of SHELL_ROUTES) {
      expect(
        resolveOnboardingRedirect({ status: 'signedIn', segments, circleState: 'ready' }),
      ).toBeNull();
    }
  });
});

describe('a person with no circle', () => {
  it('is sent into setup from the shell, wherever they land in it', () => {
    for (const segments of SHELL_ROUTES) {
      for (const circleState of ['none', 'incomplete'] as const) {
        expect(resolveOnboardingRedirect({ status: 'signedIn', segments, circleState })).toBe(
          ONBOARDING_ROOT,
        );
      }
    }
  });

  it('is left alone inside setup, so the flow can run', () => {
    for (const segments of ONBOARDING_ROUTES) {
      expect(
        resolveOnboardingRedirect({ status: 'signedIn', segments, circleState: 'none' }),
      ).toBeNull();
    }
  });

  it('is not bounced out of a half-finished setup either', () => {
    // 'incomplete' is a circle that never got its person. The flow resumes and
    // adopts it, so leaving the person on the screen is the whole point.
    for (const segments of ONBOARDING_ROUTES) {
      expect(
        resolveOnboardingRedirect({ status: 'signedIn', segments, circleState: 'incomplete' }),
      ).toBeNull();
    }
  });
});

describe('when there is no answer yet', () => {
  it('moves nobody while the circle lookup is still running', () => {
    for (const segments of [...ONBOARDING_ROUTES, ...SHELL_ROUTES]) {
      expect(
        resolveOnboardingRedirect({ status: 'signedIn', segments, circleState: 'loading' }),
      ).toBeNull();
    }
  });

  it('moves nobody when the lookup failed, rather than guessing', () => {
    for (const segments of [...ONBOARDING_ROUTES, ...SHELL_ROUTES]) {
      expect(
        resolveOnboardingRedirect({ status: 'signedIn', segments, circleState: 'error' }),
      ).toBeNull();
    }
  });
});

describe('anybody who is not signed in', () => {
  it('is left entirely to the auth guard', () => {
    for (const status of ['loading', 'signedOut', 'notConfigured'] as const) {
      for (const segments of [...ONBOARDING_ROUTES, ...SHELL_ROUTES]) {
        for (const circleState of CIRCLE_STATES) {
          expect(resolveOnboardingRedirect({ status, segments, circleState })).toBeNull();
        }
      }
    }
  });
});

describe('the hidden previews', () => {
  it('stay reachable whatever the circle state is', () => {
    for (const segments of HIDDEN_ROUTES) {
      for (const circleState of CIRCLE_STATES) {
        expect(resolveOnboardingRedirect({ status: 'signedIn', segments, circleState })).toBeNull();
      }
    }
  });
});

describe('the two rules hold across every route', () => {
  const ALL_ROUTES = [...ONBOARDING_ROUTES, ...SHELL_ROUTES, SIGN_IN, ...HIDDEN_ROUTES] as const;

  it('only ever answers with a known destination', () => {
    for (const status of ['loading', 'signedOut', 'signedIn', 'notConfigured'] as const) {
      for (const segments of ALL_ROUTES) {
        for (const circleState of CIRCLE_STATES) {
          const destination = resolveOnboardingRedirect({ status, segments, circleState });
          expect([null, HOME_PATH, ONBOARDING_ROOT, SIGN_IN_PATH]).toContain(destination);
        }
      }
    }
  });

  it('never sends a signed-out person anywhere', () => {
    for (const segments of ALL_ROUTES) {
      for (const circleState of CIRCLE_STATES) {
        expect(
          resolveOnboardingRedirect({ status: 'signedOut', segments, circleState }),
        ).toBeNull();
      }
    }
  });
});
