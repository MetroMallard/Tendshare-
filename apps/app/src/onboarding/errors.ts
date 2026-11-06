/**
 * Every way finishing onboarding can go wrong, in the family's words.
 *
 * The rule from the auth screens carries over unchanged: a database message is
 * developer text. `new row violates row-level security policy for table
 * "circles"` tells a tired 58-year-old nothing except that something is broken.
 * So every failure becomes a `title` and a `message` written for a person, and
 * the raw text never reaches a screen, a log line or an analytics event.
 *
 * The plan-limit case is called out by name because the brief is explicit about
 * it: when a limit is hit, the app says what the limit is in plain language and
 * what to do next — never a raw Postgres error, never a dead end.
 */
import { isNetworkError } from '../auth/errors';

export type OnboardingFailureKind =
  | 'offline'
  | 'not_configured'
  | 'signed_out'
  | 'name_missing'
  | 'details_missing'
  | 'plan_limit'
  | 'not_allowed'
  | 'invalid_details'
  | 'already_set_up'
  | 'unknown';

export interface OnboardingFailure {
  readonly kind: OnboardingFailureKind;
  /** One short line: the heading of the message. */
  readonly title: string;
  /** One or two sentences: what happened and what to do next. */
  readonly message: string;
  /** Whether pressing the same button again could plausibly work. */
  readonly retryable: boolean;
}

const FAILURES: Readonly<Record<OnboardingFailureKind, OnboardingFailure>> = {
  offline: {
    kind: 'offline',
    title: "You're offline",
    message:
      "We can't reach the internet right now, so we can't save your circle yet. Everything you've typed is saved on this device — try again when you're back.",
    retryable: true,
  },
  not_configured: {
    kind: 'not_configured',
    title: "Setup isn't available on this copy",
    message:
      'This version of the app was built without its server settings, so nothing can be saved. Nothing is wrong with your account.',
    retryable: false,
  },
  signed_out: {
    kind: 'signed_out',
    title: "You've been signed out",
    message:
      'For your safety we signed you out. Sign in again and your answers will still be here.',
    retryable: true,
  },
  name_missing: {
    kind: 'name_missing',
    title: 'Add your name',
    message: 'We need a name to put on your circle. You can change it at any time.',
    retryable: true,
  },
  details_missing: {
    kind: 'details_missing',
    title: 'Add the person you care for',
    message:
      "We need their first name and how they're related to you before we can set up the circle.",
    retryable: true,
  },
  plan_limit: {
    kind: 'plan_limit',
    title: 'Your plan covers one person',
    message:
      'This circle already looks after the person it was set up for, and the free plan covers one. Family Plus lets one circle look after up to three people — you can change that later in More.',
    retryable: false,
  },
  not_allowed: {
    kind: 'not_allowed',
    title: "We couldn't save that",
    message:
      "Your account doesn't have permission to do that right now. Sign out and back in, then try once more.",
    retryable: true,
  },
  invalid_details: {
    kind: 'invalid_details',
    title: 'Check the details',
    message:
      "One of the names isn't quite right — it may be empty or too long. Fix it and try again.",
    retryable: true,
  },
  already_set_up: {
    kind: 'already_set_up',
    title: 'This circle is already set up',
    message:
      "It looks like your circle was created a moment ago. Open Today — your family's care is there.",
    retryable: true,
  },
  unknown: {
    kind: 'unknown',
    title: 'Something went wrong',
    message:
      "Nothing has been lost — everything you've typed is saved on this device. Please try again in a moment.",
    retryable: true,
  },
};

export function onboardingFailureOf(kind: OnboardingFailureKind): OnboardingFailure {
  return FAILURES[kind];
}

/** The shape we need from a PostgREST error, and nothing more. */
export interface PostgrestFailure {
  readonly code: string | null;
  readonly message: string;
}

/**
 * Postgres / PostgREST error codes, and what each one means for this flow:
 *
 *   * `P0001` — a `raise exception` from our own triggers. The only one that
 *     can fire during onboarding is the plan-limit check on `care_recipients`.
 *   * `42501` — insufficient privilege, i.e. a row-level security refusal.
 *   * `23514` — a check constraint, i.e. a name that is empty or too long.
 *   * `23503` — a foreign key: the profile or circle the write pointed at is
 *     gone, which in practice means the session went stale mid-flow.
 *   * `23505` — a unique violation: the circle or membership already exists.
 */
export interface DescribeOnboardingOptions {
  /** The device says it has no connection. Wins over everything else. */
  readonly offline?: boolean;
  /** This build has no Supabase configuration at all. */
  readonly notConfigured?: boolean;
  /** The session ended between opening the flow and pressing finish. */
  readonly signedOut?: boolean;
}

export function describeOnboardingFailure(
  error: PostgrestFailure | null,
  options: DescribeOnboardingOptions = {},
): OnboardingFailure {
  if (options.notConfigured) {
    return FAILURES.not_configured;
  }

  if (options.signedOut) {
    return FAILURES.signed_out;
  }

  // `isNetworkError` reads `.message` off an Error; a PostgREST failure is a
  // plain object, so it is wrapped before asking. The message is never shown.
  if (options.offline || (error !== null && isNetworkError(new Error(error.message)))) {
    return FAILURES.offline;
  }

  if (error === null) {
    return FAILURES.unknown;
  }

  const { code, message } = error;
  const lower = message.toLowerCase();

  // The plan-limit trigger is the one message that names a real limit; it is
  // matched on its own wording so a future reword still lands somewhere sane.
  if (
    code === 'P0001' ||
    lower.includes('plan cares for') ||
    lower.includes('upgrade to add another')
  ) {
    return FAILURES.plan_limit;
  }

  switch (code) {
    case '42501':
      return FAILURES.not_allowed;
    case '23514':
    case '22001':
      return FAILURES.invalid_details;
    case '23503':
      return FAILURES.signed_out;
    case '23505':
      return FAILURES.already_set_up;
    default:
      break;
  }

  return FAILURES.unknown;
}
