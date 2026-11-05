/**
 * "Does this person already have a family circle?"
 *
 * That one question decides whether a signed-in person belongs in onboarding or
 * on Today, so it is answered by a pure function over a small snapshot, with a
 * table of tests — the same approach as `resolveAuthRedirect`, and for the same
 * reason: a wrong answer here either traps someone in setup they already did or
 * shows a brand-new account an empty app.
 *
 * There are four possible answers, and each has a different consequence:
 *
 *   * `none` — no circle at all. Onboarding, from the first screen.
 *   * `incomplete` — an owned circle that never got its person, which is what a
 *     network failure between the two writes leaves behind. Onboarding, resumed,
 *     and the existing circle is adopted rather than a second one created.
 *   * `ready` — a circle with someone in it, or a circle someone else invited
 *     them into. Never see onboarding again.
 *   * `loading` / `error` — no opinion. Never move a person on a guess.
 */
export type CircleRole = 'owner' | 'family_member' | 'view_only' | 'visiting_helper';

export interface MembershipSummary {
  readonly circleId: string;
  readonly role: CircleRole;
}

export interface CircleSnapshot {
  readonly memberships: readonly MembershipSummary[];
  /** Circles that already have a person being cared for. */
  readonly circleIdsWithRecipient: readonly string[];
}

export type CircleState = 'loading' | 'none' | 'incomplete' | 'ready' | 'error';

export interface CircleResolution {
  readonly state: Exclude<CircleState, 'loading' | 'error'>;
  /** The owned circle that still needs its person, when there is one. */
  readonly circleId: string | null;
}

export function resolveCircleState(snapshot: CircleSnapshot): CircleResolution {
  const { memberships, circleIdsWithRecipient } = snapshot;

  if (memberships.length === 0) {
    return { state: 'none', circleId: null };
  }

  // Someone invited this person into their circle. That is a working circle,
  // not a reason to ask them to set up their own — joining is a later task.
  const invited = memberships.some((membership) => membership.role !== 'owner');
  if (invited) {
    return { state: 'ready', circleId: null };
  }

  const owned = memberships.filter((membership) => membership.role === 'owner');
  const withPerson = owned.find((membership) =>
    circleIdsWithRecipient.includes(membership.circleId),
  );

  if (withPerson) {
    return { state: 'ready', circleId: null };
  }

  // Every owned circle is waiting for its person. Resume the first one rather
  // than creating another: two circles from one aborted signup is the bug this
  // whole snapshot exists to prevent.
  return { state: 'incomplete', circleId: owned[0]?.circleId ?? null };
}
