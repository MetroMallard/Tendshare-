/**
 * Where a signed-in person belongs, as arithmetic.
 *
 * The route guard is a redirect, and redirects are the easiest thing in an app
 * to get subtly wrong — a signed-out visitor landing on the shell, or a
 * signed-in one staring at the sign-in form. So the decision is a pure function
 * with a table of tests, and the layout only carries it out.
 */

export const AUTH_GROUP = '(auth)';
export const SIGN_IN_PATH = '/sign-in';
export const HOME_PATH = '/';

/**
 * Hidden routes: the component gallery and the auth state preview. They are not
 * the app shell, hold no care data, and are how the owner and QA look at every
 * state on purpose. They stay reachable in any session state.
 */
export const HIDDEN_ROUTES: readonly string[] = ['gallery', 'auth-preview'];

export interface GuardInput {
  readonly status: 'loading' | 'signedOut' | 'signedIn' | 'notConfigured';
  /** From `useSegments()`: `['(auth)','verify']`, `['(tabs)','index']`, `[]`… */
  readonly segments: readonly string[];
  /** A code was just sent to an address, so the verify screen has something to show. */
  readonly hasPendingEmail: boolean;
}

export function isAuthRoute(segments: readonly string[]): boolean {
  return segments[0] === AUTH_GROUP;
}

export function isHiddenRoute(segments: readonly string[]): boolean {
  const first = segments[0];
  return first !== undefined && HIDDEN_ROUTES.includes(first);
}

/**
 * Where to go, or `null` to stay put.
 *
 * Two rules, in order of importance: nobody signed out sees the shell, and
 * nobody signed in is parked on the sign-in form.
 */
export function resolveAuthRedirect({
  status,
  segments,
  hasPendingEmail,
}: GuardInput): string | null {
  if (status === 'loading') {
    // The stored session has not been read yet. Moving now would bounce a
    // signed-in person through the sign-in form on every cold start.
    return null;
  }

  if (isHiddenRoute(segments)) {
    return null;
  }

  if (status === 'notConfigured') {
    // The sign-in screen is the one place that can explain this honestly.
    return isAuthRoute(segments) ? null : SIGN_IN_PATH;
  }

  if (status === 'signedIn') {
    return isAuthRoute(segments) ? HOME_PATH : null;
  }

  // signedOut
  if (!isAuthRoute(segments)) {
    return SIGN_IN_PATH;
  }

  // A reload on the verify screen loses the address the code was sent to; there
  // is nothing to verify without it, so start again rather than show a dead form.
  const isVerify = segments[1] === 'verify';
  if (isVerify && !hasPendingEmail) {
    return SIGN_IN_PATH;
  }

  return null;
}
