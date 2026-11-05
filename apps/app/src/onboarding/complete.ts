/**
 * The finish button, as one ordered flow.
 *
 * Three rows are written, in this order and no other:
 *
 *   1. `profiles.display_name` — an UPDATE. The row already exists (the signup
 *      trigger wrote it), and this is the one column the owner may change.
 *   2. `circles` — INSERT with the caller as owner. The AFTER INSERT trigger
 *      creates the owner membership in the same statement.
 *   3. `care_recipients` — INSERT for the person from screen 2.
 *
 * Order matters twice over. The circle needs the profile to exist as its owner,
 * and the care recipient needs the circle. Writing the person first would mean
 * a `care_recipients` row pointing at nothing.
 *
 * ## What happens when step 3 fails
 *
 * A circle with no person in it is a broken state: Today would have nothing to
 * show, and the plan's "one person cared for" limit would be spent on an empty
 * circle. So the flow **undoes** step 2 — deletes the circle it just created —
 * and only then reports the failure. A retry then starts clean and creates one
 * circle, not two.
 *
 * If the undo itself fails (the network died between the two calls), the circle
 * id is returned with the failure and kept in the draft. The next attempt skips
 * circle creation entirely and finishes the job on the circle that already
 * exists. Either way the person ends up with exactly one circle and one person.
 */
import { describeOnboardingFailure, onboardingFailureOf, type OnboardingFailure } from './errors';
import type { OnboardingDraft } from './draft';
import { checkDisplayName, checkRecipientName, cleanText } from './validation';
import type { OnboardingWrites } from './writes';

export interface CompleteOnboardingInput {
  readonly userId: string;
  readonly draft: OnboardingDraft;
  /** A circle left over from an earlier attempt, if there is one. */
  readonly existingCircleId?: string | null;
  readonly offline?: boolean;
  readonly notConfigured?: boolean;
}

export type CompleteOnboardingResult =
  | {
      readonly ok: true;
      readonly circleId: string;
      readonly invites: readonly string[];
    }
  | {
      readonly ok: false;
      readonly failure: OnboardingFailure;
      /** A circle that exists and still needs its person — keep it for the retry. */
      readonly circleId: string | null;
    };

/** `circles.name` allows 80 characters; a first name cannot approach that. */
export function circleNameFor(recipientName: string): string {
  const name = cleanText(recipientName);
  return `${name}'s circle`.slice(0, 80);
}

function failed(failure: OnboardingFailure, circleId: string | null): CompleteOnboardingResult {
  return { ok: false, failure, circleId };
}

export async function completeOnboarding(
  writes: OnboardingWrites,
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const { draft } = input;

  if (input.notConfigured === true) {
    return failed(onboardingFailureOf('not_configured'), input.existingCircleId ?? null);
  }

  // Validate before writing anything: a failure now costs nothing.
  const name = checkDisplayName(draft.displayName);
  if (!name.ok) {
    return failed(onboardingFailureOf('name_missing'), input.existingCircleId ?? null);
  }

  const recipient = checkRecipientName(draft.recipientName);
  if (!recipient.ok || draft.relationship === null) {
    return failed(onboardingFailureOf('details_missing'), input.existingCircleId ?? null);
  }

  if (input.offline === true) {
    return failed(onboardingFailureOf('offline'), input.existingCircleId ?? null);
  }

  // 1. The name on their profile.
  const nameFailure = await writes.saveDisplayName(input.userId, name.value);
  if (nameFailure !== null) {
    return failed(
      describeOnboardingFailure(nameFailure, { offline: input.offline }),
      input.existingCircleId ?? null,
    );
  }

  // 2. The circle — unless an earlier attempt already made one.
  let circleId = input.existingCircleId ?? null;

  if (circleId === null) {
    const created = await writes.createCircle({
      name: circleNameFor(recipient.value),
      ownerId: input.userId,
    });

    if (!created.ok) {
      return failed(describeOnboardingFailure(created.failure, { offline: input.offline }), null);
    }

    circleId = created.circleId;
  }

  // 3. The person the circle is for.
  const recipientFailure = await writes.createRecipient({
    circleId,
    fullName: recipient.value,
    relationship: draft.relationship,
  });

  if (recipientFailure !== null) {
    // Undo step 2 so a retry cannot leave two circles behind.
    const undoFailure = await writes.deleteCircle(circleId);

    return failed(
      describeOnboardingFailure(recipientFailure, { offline: input.offline }),
      undoFailure === null ? null : circleId,
    );
  }

  return { ok: true, circleId, invites: draft.invites };
}
