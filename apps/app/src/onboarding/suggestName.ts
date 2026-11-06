/**
 * What to call the person who just signed in.
 *
 * Nobody wants to type their own name into a phone that already knows it, so
 * screen 1 arrives filled in when we can honestly fill it. The order below is
 * the order of trustworthiness:
 *
 *   1. the name the identity provider gave us (`full_name`, then `name` — Google
 *      sends the first, Apple the second);
 *   2. the `profiles.display_name` the signup trigger already wrote;
 *   3. the local part of their email address, tidied into something a person
 *      would recognise: `sara.jones` becomes "Sara Jones".
 *
 * A suggestion, never a decision — the field is theirs to overwrite.
 */
import { cleanText } from './validation';

/** What the signup trigger writes when it has nothing better. */
const PLACEHOLDER_NAMES = new Set(['someone']);

/**
 * "sara.jones" / "sara_jones99" / "sara+jones" -> "Sara Jones".
 *
 * Digits and plus-addressing are dropped because they are a mailbox, not a
 * name; dots, underscores and hyphens become word breaks. If nothing readable
 * survives, the suggestion is empty and the field simply starts blank.
 */
export function prettifyEmailLocalPart(localPart: string): string {
  const words = localPart
    .split('@')[0]
    ?.replace(/\+.*$/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/[0-9]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words === undefined || words.length === 0) {
    return '';
  }

  return words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ')
    .slice(0, 80);
}

export interface NameSuggestionInput {
  /** `profiles.display_name`, written by the signup trigger. */
  readonly profileName?: string | null;
  /** `user.user_metadata` from the identity provider. */
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly email?: string | null;
}

function metadataName(metadata: NameSuggestionInput['metadata']): string {
  if (!metadata) {
    return '';
  }

  for (const key of ['full_name', 'name', 'display_name'] as const) {
    const value = metadata[key];

    if (typeof value === 'string' && cleanText(value).length > 0) {
      return cleanText(value).slice(0, 80);
    }
  }

  return '';
}

export function suggestDisplayName({ profileName, metadata, email }: NameSuggestionInput): string {
  const fromProvider = metadataName(metadata);
  if (fromProvider.length > 0) {
    return fromProvider;
  }

  const fromProfile = cleanText(profileName ?? '');
  if (fromProfile.length > 0 && !PLACEHOLDER_NAMES.has(fromProfile.toLowerCase())) {
    return fromProfile.slice(0, 80);
  }

  return prettifyEmailLocalPart(email ?? '');
}
