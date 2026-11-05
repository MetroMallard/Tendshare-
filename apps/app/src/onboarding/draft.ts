/**
 * The half-finished onboarding, and how it survives a closed app.
 *
 * Onboarding is the one flow where a person may genuinely be interrupted: a
 * parent calls, the phone dies, the browser tab is closed on a shared computer.
 * Losing a typed name at that moment is the sort of small insult that makes
 * someone stop. So every answer is written to device storage as it is typed,
 * and the step they were on is remembered with it.
 *
 * Two rules keep the stored draft from becoming a liability:
 *
 *   * **It holds only what these three screens ask for** — a display name, the
 *     cared-for person's first name, a relationship word and a list of email
 *     addresses. No health detail, ever. That is also why it is safe to keep in
 *     the keychain: there is nothing medical in it to leak.
 *   * **It is deleted the moment the circle is created**, and "Start over"
 *     deletes it on demand. A draft that outlives its purpose is just stale
 *     personal data.
 *
 * Everything here is pure: parsing, serialising and deciding which step to
 * resume on. The storage adapter is `draftStore.ts`.
 */
import { isPlausibleEmail } from '../auth/code';
import { isOnboardingStep, type OnboardingStep } from './steps';
import { MAX_INVITES, cleanText, isRelationship, type Relationship } from './validation';

/**
 * Bumped when the shape changes. A draft from an older build is discarded
 * rather than migrated: it is three answers, and re-asking is cheaper than
 * carrying a migration for a flow this small.
 */
export const DRAFT_VERSION = 1;

export interface OnboardingDraft {
  readonly version: number;
  /** Where the person was when they left. */
  readonly step: OnboardingStep;
  readonly displayName: string;
  readonly recipientName: string;
  readonly relationship: Relationship | null;
  readonly invites: readonly string[];
  /**
   * A circle that was created but never got its person — the one state the flow
   * can leave behind if the network dies between the two writes. Keeping the id
   * is what lets "try again" finish the job instead of making a second circle.
   */
  readonly circleId: string | null;
}

export function emptyDraft(): OnboardingDraft {
  return {
    version: DRAFT_VERSION,
    step: 'you',
    displayName: '',
    recipientName: '',
    relationship: null,
    invites: [],
    circleId: null,
  };
}

export function serialiseDraft(draft: OnboardingDraft): string {
  return JSON.stringify(draft);
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? cleanText(value).slice(0, max) : '';
}

function asCircleId(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value) ? value : null;
}

function asInvites(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const addresses: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const address = entry.trim().toLowerCase();

    if (isPlausibleEmail(address) && !seen.has(address) && addresses.length < MAX_INVITES) {
      seen.add(address);
      addresses.push(address);
    }
  }

  return addresses;
}

/**
 * Read a stored draft back, defensively.
 *
 * Anything unreadable — old JSON, a truncated write, a value someone edited in
 * devtools — becomes an empty draft rather than an exception. A crash on launch
 * because a stored string is malformed would be a far worse bug than losing
 * three answers.
 */
export function parseDraft(raw: string | null | undefined): OnboardingDraft {
  if (typeof raw !== 'string' || raw.length === 0) {
    return emptyDraft();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyDraft();
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return emptyDraft();
  }

  const record = parsed as Record<string, unknown>;

  if (record.version !== DRAFT_VERSION) {
    return emptyDraft();
  }

  return {
    version: DRAFT_VERSION,
    step: isOnboardingStep(record.step) ? record.step : 'you',
    displayName: asText(record.displayName, 200),
    recipientName: asText(record.recipientName, 200),
    relationship: isRelationship(record.relationship) ? record.relationship : null,
    invites: asInvites(record.invites),
    circleId: asCircleId(record.circleId),
  };
}

export function hasName(draft: OnboardingDraft): boolean {
  return cleanText(draft.displayName).length > 0;
}

export function hasRecipient(draft: OnboardingDraft): boolean {
  return cleanText(draft.recipientName).length > 0 && draft.relationship !== null;
}

/** Anything worth losing — what makes "Start over" worth offering. */
export function draftHasContent(draft: OnboardingDraft): boolean {
  return (
    hasName(draft) ||
    cleanText(draft.recipientName).length > 0 ||
    draft.relationship !== null ||
    draft.invites.length > 0 ||
    draft.circleId !== null
  );
}

/**
 * Where to put someone who comes back.
 *
 * The stored step is a request, not a promise: a step whose answers are missing
 * sends them back to the last screen that can fill the gap, so nobody lands on
 * "invite family" for a person who has not been named yet.
 */
export function resumeStep(draft: OnboardingDraft): OnboardingStep {
  switch (draft.step) {
    case 'you':
      return 'you';
    case 'care':
      return hasName(draft) ? 'care' : 'you';
    case 'invite':
      if (hasRecipient(draft)) {
        return 'invite';
      }
      return hasName(draft) ? 'care' : 'you';
    default:
      return 'you';
  }
}
