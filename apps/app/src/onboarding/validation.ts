/**
 * What the three screens accept, as arithmetic.
 *
 * Every rule here mirrors a database constraint exactly, so a person is never
 * told their answer is fine and then handed a Postgres error:
 *
 *   * `profiles.display_name` — `char_length(btrim(display_name)) between 1 and 80`
 *   * `care_recipients.full_name` — `char_length(btrim(full_name)) between 1 and 120`
 *   * `care_recipients.relationship` — free text, 1 to 60 characters
 *
 * The client check is a courtesy, not the guard: the constraints stay the judge.
 * This module only makes sure the common mistakes are caught before a round trip.
 */
import { isPlausibleEmail, normaliseEmail } from '../auth/code';

/** `profiles.display_name` allows 80 characters after trimming. */
export const DISPLAY_NAME_MAX = 80;

/** `care_recipients.full_name` allows 120 characters after trimming. */
export const RECIPIENT_NAME_MAX = 120;

/**
 * The short picker from the brief. Five options, stored as the words the family
 * reads — "Mother", not "mother" or a code. The schema takes free text, so this
 * list is a convenience the app owns and can grow without a migration.
 */
export const RELATIONSHIPS = ['Mother', 'Father', 'Partner', 'Grandparent', 'Other'] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

export function isRelationship(value: unknown): value is Relationship {
  return typeof value === 'string' && (RELATIONSHIPS as readonly string[]).includes(value);
}

/**
 * Trim, and collapse runs of whitespace to one space.
 *
 * Phones insert a trailing space after an autocompleted word, and a name typed
 * as "  Mary   Ann " should be stored as "Mary Ann" rather than failing a length
 * check or looking odd on every screen afterwards.
 */
export function cleanText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export type TextProblem = 'required' | 'too_long';

export type TextCheck =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly problem: TextProblem };

function checkText(input: string, max: number): TextCheck {
  const value = cleanText(input);

  if (value.length === 0) {
    return { ok: false, problem: 'required' };
  }

  if (value.length > max) {
    return { ok: false, problem: 'too_long' };
  }

  return { ok: true, value };
}

export function checkDisplayName(input: string): TextCheck {
  return checkText(input, DISPLAY_NAME_MAX);
}

export function checkRecipientName(input: string): TextCheck {
  return checkText(input, RECIPIENT_NAME_MAX);
}

/** The inline message under a name field, or `undefined` when it is fine. */
export function textProblemMessage(problem: TextProblem, what: 'your name' | 'their name'): string {
  return problem === 'required'
    ? `Please add ${what}.`
    : `That's a little long — keep ${what} to ${String(
        what === 'your name' ? DISPLAY_NAME_MAX : RECIPIENT_NAME_MAX,
      )} characters or fewer.`;
}

/** The most addresses one screen will take. Invites are a later task; this is a sanity cap. */
export const MAX_INVITES = 10;

export type InviteProblem = 'invalid' | 'duplicate' | 'full';

export type InviteResult =
  | { readonly ok: true; readonly addresses: readonly string[] }
  | { readonly ok: false; readonly problem: InviteProblem };

/**
 * Add one address to the list.
 *
 * Returns a new list rather than mutating: the draft is React state, and an
 * in-place push is the classic way an "Add another" button stops re-rendering.
 * Duplicates are refused quietly — adding the same sibling twice would mean two
 * invitations to the same inbox.
 */
export function addInvite(addresses: readonly string[], raw: string): InviteResult {
  const address = normaliseEmail(raw);

  if (!isPlausibleEmail(address)) {
    return { ok: false, problem: 'invalid' };
  }

  if (addresses.includes(address)) {
    return { ok: false, problem: 'duplicate' };
  }

  if (addresses.length >= MAX_INVITES) {
    return { ok: false, problem: 'full' };
  }

  return { ok: true, addresses: [...addresses, address] };
}

export function removeInvite(addresses: readonly string[], address: string): readonly string[] {
  return addresses.filter((candidate) => candidate !== address);
}

export function inviteProblemMessage(problem: InviteProblem): string {
  switch (problem) {
    case 'invalid':
      return "That address doesn't look quite right. Check the spelling and try again.";
    case 'duplicate':
      return "You've already added that address.";
    case 'full':
      return `You can add up to ${String(MAX_INVITES)} addresses here. You can invite more later.`;
    default:
      return 'Something went wrong. Please try again.';
  }
}
