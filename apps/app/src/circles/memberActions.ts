/**
 * The three writes the members screen makes, and what to say when one fails.
 *
 * Every call is scoped by `circle_id` **and** re-checked by Row Level Security:
 * the client is never the thing that decides whether somebody may change a role.
 * That is why a refusal is not treated as a bug — it is an expected answer, and
 * it gets a plain sentence rather than a red error box with a database code in
 * it.
 *
 * The mapping from a Postgres error to a sentence is a pure function with a
 * table of tests, for the same reason `resolveAuthRedirect` is: a raw
 * `row-level security policy` string reaching a 60-year-old's screen is the kind
 * of detail that makes a calm app feel broken.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { CIRCLE_NAME_MAX_LENGTH } from './roles';
import type { CircleRole } from './circleState';

export type MemberProblem = 'not_allowed' | 'plan_limit' | 'offline' | 'unknown';

export interface MemberProblemCopy {
  readonly title: string;
  readonly message: string;
}

export interface MemberActionResult {
  readonly ok: boolean;
  /** Present only when `ok` is false. */
  readonly problem?: MemberProblem;
}

/**
 * What went wrong, from what the server said.
 *
 * Order matters: a plan-limit refusal is a `P0001` raised by our own trigger and
 * must not be read as a permission problem, and a network failure arrives as a
 * `TypeError` with no code at all.
 */
export function memberProblemOf(input: {
  readonly message?: string | null;
  readonly code?: string | null;
}): MemberProblem {
  const message = (input.message ?? '').toLowerCase();
  const code = input.code ?? '';

  if (/plan covers up to|plan cares for/.test(message)) {
    return 'plan_limit';
  }

  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return 'not_allowed';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('timeout')
  ) {
    return 'offline';
  }

  return 'unknown';
}

/** One calm sentence per problem, in the second person. */
export function memberProblemCopy(problem: MemberProblem): MemberProblemCopy {
  switch (problem) {
    case 'not_allowed':
      return {
        title: 'Only the owner can do that',
        message: 'Nothing has changed. Ask whoever set the circle up to make this change.',
      };
    case 'plan_limit':
      return {
        title: 'Your plan is full',
        message:
          'This plan covers a set number of people, and everyone already in the circle stays exactly where they are. Nobody has been removed.',
      };
    case 'offline':
      return {
        title: 'You’re offline',
        message: 'Nothing has changed. Try again when you’re back online.',
      };
    default:
      return {
        title: 'That didn’t save',
        message: 'Nothing has changed. Please try again in a moment.',
      };
  }
}

/**
 * The circle name, checked before it is sent.
 *
 * 40 characters is a soft limit: long enough for "Margaret's circle — the
 * Joneses", short enough to fit one line in a header on a 390px phone. The
 * database allows 80, so a name saved by another client still loads.
 */
export function validateCircleName(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return 'Please give the circle a name.';
  }

  if (trimmed.length > CIRCLE_NAME_MAX_LENGTH) {
    return `Keep it to ${String(CIRCLE_NAME_MAX_LENGTH)} characters or fewer.`;
  }

  return null;
}

function failureOf(error: { message?: string | null; code?: string | null }): MemberActionResult {
  return { ok: false, problem: memberProblemOf(error) };
}

/**
 * Change somebody's role.
 *
 * `.select('id')` is deliberate: an UPDATE that the policy filters out returns
 * no error and no rows, and "zero rows changed" has to read as a refusal rather
 * than a success.
 */
export async function changeMemberRole(
  client: SupabaseClient,
  input: { readonly circleId: string; readonly profileId: string; readonly role: CircleRole },
): Promise<MemberActionResult> {
  const { data, error } = await client
    .from('circle_members')
    .update({ role: input.role })
    .eq('circle_id', input.circleId)
    .eq('profile_id', input.profileId)
    .select('id');

  if (error !== null) {
    return failureOf(error);
  }

  return (data?.length ?? 0) > 0 ? { ok: true } : { ok: false, problem: 'not_allowed' };
}

/** Remove somebody from the circle. Their account and their data are untouched. */
export async function removeCircleMember(
  client: SupabaseClient,
  input: { readonly circleId: string; readonly profileId: string },
): Promise<MemberActionResult> {
  const { data, error } = await client
    .from('circle_members')
    .delete()
    .eq('circle_id', input.circleId)
    .eq('profile_id', input.profileId)
    .select('id');

  if (error !== null) {
    return failureOf(error);
  }

  return (data?.length ?? 0) > 0 ? { ok: true } : { ok: false, problem: 'not_allowed' };
}

/** Rename the circle. Owner only, enforced by the `circles_update_owner` policy. */
export async function renameCircle(
  client: SupabaseClient,
  input: { readonly circleId: string; readonly name: string },
): Promise<MemberActionResult> {
  const name = input.name.trim();

  if (validateCircleName(name) !== null) {
    return { ok: false, problem: 'unknown' };
  }

  const { data, error } = await client
    .from('circles')
    .update({ name })
    .eq('id', input.circleId)
    .select('id');

  if (error !== null) {
    return failureOf(error);
  }

  return (data?.length ?? 0) > 0 ? { ok: true } : { ok: false, problem: 'not_allowed' };
}
