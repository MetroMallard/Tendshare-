/**
 * Every way signing in can go wrong, turned into one calm sentence.
 *
 * Two rules decide the copy here:
 *
 * 1. **Never reveal whether an email is registered.** Nothing in this file may
 *    say "no account with that email", and nothing may echo the address back.
 *    A wrong code and an expired code get the same words, because the server
 *    genuinely cannot tell us apart from an attacker and neither should the UI.
 * 2. **Name the next step, not the failure.** "Ask for a new code" beats
 *    "OTP verification failed". No jargon, no error codes, no scolding.
 *
 * The raw error is deliberately not carried into the UI or into any log line:
 * GoTrue messages are developer text and can echo the address that was typed.
 */
import { AuthError } from '@supabase/supabase-js';

export type AuthFailureKind =
  | 'offline'
  | 'invalid_code'
  | 'too_many_attempts'
  | 'rate_limited'
  | 'email_invalid'
  | 'provider_unavailable'
  | 'provider_cancelled'
  | 'not_configured'
  | 'unknown';

export interface AuthFailure {
  readonly kind: AuthFailureKind;
  /** One short line, the heading of the message. */
  readonly title: string;
  /** One or two sentences: what happened and what to do. */
  readonly message: string;
  /** Whether pressing the same button again could plausibly work. */
  readonly retryable: boolean;
}

const FAILURES: Readonly<Record<AuthFailureKind, AuthFailure>> = {
  offline: {
    kind: 'offline',
    title: "You're offline",
    message:
      "We can't reach the internet right now. Check your connection and try again — nothing you've typed is lost.",
    retryable: true,
  },
  invalid_code: {
    kind: 'invalid_code',
    title: "That code didn't work",
    message:
      "Check the code in your email and try once more. If it's been a while since the email arrived, ask for a new code.",
    retryable: true,
  },
  too_many_attempts: {
    kind: 'too_many_attempts',
    title: 'Too many tries',
    message:
      'We paused sign-in for a few minutes to keep the account safe. Please try again shortly.',
    retryable: true,
  },
  rate_limited: {
    kind: 'rate_limited',
    title: 'One moment',
    message: 'We just sent a code. Give it a minute before asking for another one.',
    retryable: true,
  },
  email_invalid: {
    kind: 'email_invalid',
    title: 'Check the email address',
    message: "That address doesn't look quite right. Fix the spelling and we'll send a code.",
    retryable: true,
  },
  provider_unavailable: {
    kind: 'provider_unavailable',
    title: "That sign-in isn't switched on yet",
    message:
      "We can't use that account to sign in at the moment. Your email works just as well — use it instead.",
    retryable: true,
  },
  provider_cancelled: {
    kind: 'provider_cancelled',
    title: 'Sign-in cancelled',
    message: "Nothing has changed. You can try again whenever you're ready.",
    retryable: true,
  },
  not_configured: {
    kind: 'not_configured',
    title: "Sign-in isn't set up on this copy",
    message:
      'This version of the app was built without its sign-in settings. Nothing is wrong with your account.',
    retryable: false,
  },
  unknown: {
    kind: 'unknown',
    title: 'Something went wrong',
    message: "Nothing has been lost. Please try again in a moment.",
    retryable: true,
  },
};

export function failureOf(kind: AuthFailureKind): AuthFailure {
  return FAILURES[kind];
}

/** The error code and status from a Supabase auth error, or nulls. */
interface ErrorShape {
  readonly code: string | null;
  readonly status: number | null;
  readonly message: string;
}

function shapeOf(error: unknown): ErrorShape {
  if (error instanceof AuthError) {
    return {
      code: error.code ?? null,
      status: error.status ?? null,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return { code: null, status: null, message: error.message };
  }

  return { code: null, status: null, message: '' };
}

/**
 * A fetch that never reached the server. `fetch` on native throws a plain
 * `TypeError` with this wording; on the web the browser refuses quietly and
 * supabase-js wraps it as "Failed to fetch".
 */
export function isNetworkError(error: unknown): boolean {
  const { message } = shapeOf(error);
  const lower = message.toLowerCase();

  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound')
  );
}

const ATTEMPT_CODES = new Set(['over_request_rate_limit', 'invalid_credentials']);

export interface DescribeOptions {
  /** The device says it has no connection. Wins over everything else. */
  readonly offline?: boolean;
}

/**
 * Map anything thrown by supabase-js into the copy the screen shows.
 *
 * `offline` is passed in from the network watcher because a failed fetch and a
 * switched-off radio are different stories for the person reading it.
 */
export function describeAuthFailure(
  error: unknown,
  options: DescribeOptions = {},
): AuthFailure {
  if (options.offline || isNetworkError(error)) {
    return FAILURES.offline;
  }

  const { code, status, message } = shapeOf(error);
  const lower = message.toLowerCase();

  // The server refuses a disabled provider with a validation error whose text is
  // the only signal: "Unsupported provider: provider is not enabled".
  if (
    code === 'provider_disabled' ||
    code === 'oauth_provider_not_supported' ||
    lower.includes('provider is not enabled') ||
    lower.includes('unsupported provider')
  ) {
    return FAILURES.provider_unavailable;
  }

  switch (code) {
    case 'otp_expired':
    case 'session_expired':
      // Wrong and expired codes are indistinguishable to the server, and saying
      // which one it was would leak more than it helps.
      return FAILURES.invalid_code;
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return FAILURES.rate_limited;
    case 'over_request_rate_limit':
      return FAILURES.too_many_attempts;
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return FAILURES.email_invalid;
    case 'otp_disabled':
    case 'email_provider_disabled':
      return FAILURES.not_configured;
    case 'user_banned':
      return FAILURES.too_many_attempts;
    default:
      break;
  }

  if (status === 429 || ATTEMPT_CODES.has(code ?? '')) {
    return FAILURES.too_many_attempts;
  }

  if (status === 400 || status === 403 || status === 422) {
    // A rejected token, an unreadable code, a failed challenge: all the same
    // advice — check the digits, or ask for a fresh one.
    return FAILURES.invalid_code;
  }

  return FAILURES.unknown;
}
