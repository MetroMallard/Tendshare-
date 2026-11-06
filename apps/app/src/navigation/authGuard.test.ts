/**
 * `resolveAuthRedirect` — the whole route guard, as a table.
 *
 * Two rules matter more than the rest: nobody signed out ever sees the app
 * shell, and nobody signed in is ever parked on the sign-in form. Both are
 * checked below across every route in the app, because a redirect bug is a
 * person locked out of their parent's medication list.
 */
import { describe, expect, it } from 'vitest';

import {
  HOME_PATH,
  SIGN_IN_PATH,
  isAuthRoute,
  isHiddenRoute,
  resolveAuthRedirect,
  type GuardInput,
} from './authGuard';

const SHELL = ['(tabs)', 'index'] as const;
const PROFILE_PREVIEW = ['profile-preview'] as const;
const ROOT: readonly string[] = [];
const SIGN_IN = ['(auth)', 'sign-in'] as const;
const VERIFY = ['(auth)', 'verify'] as const;
const GALLERY = ['gallery'] as const;
const PREVIEW = ['auth-preview'] as const;

const ALL_ROUTES: readonly (readonly string[])[] = [SHELL, ROOT, SIGN_IN, VERIFY, GALLERY, PREVIEW];

function redirect(input: GuardInput): string | null {
  return resolveAuthRedirect(input);
}

describe('while the stored session is still loading', () => {
  it('moves nobody, so a signed-in person is not bounced through sign-in', () => {
    for (const segments of ALL_ROUTES) {
      expect(redirect({ status: 'loading', segments, hasPendingEmail: false })).toBeNull();
    }
  });
});

describe('signed out', () => {
  it('cannot reach the app shell', () => {
    expect(redirect({ status: 'signedOut', segments: SHELL, hasPendingEmail: false })).toBe(
      SIGN_IN_PATH,
    );
    expect(redirect({ status: 'signedOut', segments: ROOT, hasPendingEmail: false })).toBe(
      SIGN_IN_PATH,
    );
  });

  it('stays on sign-in', () => {
    expect(redirect({ status: 'signedOut', segments: SIGN_IN, hasPendingEmail: false })).toBeNull();
  });

  it('stays on verify while a code has just been sent', () => {
    expect(redirect({ status: 'signedOut', segments: VERIFY, hasPendingEmail: true })).toBeNull();
  });

  it('goes back to sign-in on a reload of verify with no pending email', () => {
    // The address the code went to lived in memory; a reload lost it, and a form
    // with nothing to verify is worse than starting again.
    expect(redirect({ status: 'signedOut', segments: VERIFY, hasPendingEmail: false })).toBe(
      SIGN_IN_PATH,
    );
  });

  it('can still open the hidden routes, which hold no care data', () => {
    expect(redirect({ status: 'signedOut', segments: GALLERY, hasPendingEmail: false })).toBeNull();
    expect(redirect({ status: 'signedOut', segments: PREVIEW, hasPendingEmail: false })).toBeNull();
  });
});

describe('signed in', () => {
  it('never lands on sign-in', () => {
    expect(redirect({ status: 'signedIn', segments: SIGN_IN, hasPendingEmail: false })).toBe(
      HOME_PATH,
    );
  });

  it('is sent home from verify as well', () => {
    expect(redirect({ status: 'signedIn', segments: VERIFY, hasPendingEmail: true })).toBe(
      HOME_PATH,
    );
  });

  it('stays on the shell', () => {
    expect(redirect({ status: 'signedIn', segments: SHELL, hasPendingEmail: false })).toBeNull();
    expect(redirect({ status: 'signedIn', segments: ROOT, hasPendingEmail: false })).toBeNull();
  });

  it('keeps the hidden routes reachable', () => {
    expect(redirect({ status: 'signedIn', segments: GALLERY, hasPendingEmail: false })).toBeNull();
    expect(redirect({ status: 'signedIn', segments: PREVIEW, hasPendingEmail: false })).toBeNull();
  });
});

describe('not configured', () => {
  it('sends the shell to sign-in, the one screen that can explain it', () => {
    expect(redirect({ status: 'notConfigured', segments: SHELL, hasPendingEmail: false })).toBe(
      SIGN_IN_PATH,
    );
  });

  it('leaves sign-in alone, so the explanation is readable', () => {
    expect(
      redirect({ status: 'notConfigured', segments: SIGN_IN, hasPendingEmail: false }),
    ).toBeNull();
  });
});

describe('the two rules hold across every route', () => {
  it('never sends a signed-in person to sign-in', () => {
    for (const segments of ALL_ROUTES) {
      for (const hasPendingEmail of [true, false]) {
        expect(redirect({ status: 'signedIn', segments, hasPendingEmail })).not.toBe(SIGN_IN_PATH);
      }
    }
  });

  it('never leaves a signed-out person on the shell', () => {
    for (const segments of [SHELL, ROOT]) {
      for (const hasPendingEmail of [true, false]) {
        expect(redirect({ status: 'signedOut', segments, hasPendingEmail })).toBe(SIGN_IN_PATH);
      }
    }
  });

  it('only ever answers with a known destination', () => {
    const statuses: GuardInput['status'][] = ['loading', 'signedOut', 'signedIn', 'notConfigured'];

    for (const status of statuses) {
      for (const segments of ALL_ROUTES) {
        for (const hasPendingEmail of [true, false]) {
          const destination = redirect({ status, segments, hasPendingEmail });
          expect([null, HOME_PATH, SIGN_IN_PATH]).toContain(destination);
        }
      }
    }
  });
});

describe('route classification', () => {
  it('recognises the auth group', () => {
    expect(isAuthRoute(SIGN_IN)).toBe(true);
    expect(isAuthRoute(VERIFY)).toBe(true);
    expect(isAuthRoute(SHELL)).toBe(false);
    expect(isAuthRoute(ROOT)).toBe(false);
  });

  it('recognises the hidden routes', () => {
    expect(isHiddenRoute(GALLERY)).toBe(true);
    expect(isHiddenRoute(PREVIEW)).toBe(true);
    expect(isHiddenRoute(PROFILE_PREVIEW)).toBe(true);
    expect(isHiddenRoute(SHELL)).toBe(false);
    expect(isHiddenRoute(ROOT)).toBe(false);
  });
});
