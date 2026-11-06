/**
 * Which circle is "mine" right now.
 *
 * A person can be in several: the one they set up for their mother, and the one
 * their sister invited them into for their father. Every tab is about one of
 * them at a time, so the app has to answer "which one?" the same way every time
 * — and the answer is a pure function with a table of tests, because a switcher
 * that lands on the wrong family is the kind of bug nobody forgives.
 *
 * Three rules:
 *
 *   1. **What they chose last wins**, if they are still in it. The choice is
 *      remembered per device (see `activeCircleStore`), not per account: the
 *      phone in the kitchen and the laptop in the office are used by different
 *      people at different times.
 *   2. **If that circle is gone** — they were removed, or it was deleted — fall
 *      back to the first circle they are in. Never to "no circle": being
 *      removed from one family should not empty the app for the other.
 *   3. **One circle means no switcher at all.** A picker with a single option is
 *      clutter for the people this app is for; `shouldShowSwitcher` is the one
 *      place that decides, so no screen can add one by accident.
 */
import type { CircleRole } from './circleState';

export type PlanTier = 'free' | 'family' | 'family_plus';

export interface CircleSummary {
  readonly circleId: string;
  /**
   * The circle's name, or `null` when this role cannot read it.
   *
   * A visiting helper cannot read `circles` at all — the role gets the narrow
   * slice and the circle's settings are not part of it — so the name falls back
   * to the person being cared for, which they can read.
   */
  readonly name: string | null;
  readonly role: CircleRole;
  readonly planTier: PlanTier;
  /** Who this circle is for, when the role may see them. */
  readonly recipientName: string | null;
  /**
   * How many people are in the circle, or `null` when the role cannot see the
   * roster (a visiting helper). Never guessed, never shown as a wrong number.
   */
  readonly memberCount: number | null;
}

/**
 * What to call a circle on screen.
 *
 * The name if there is one; otherwise "Caring for Margaret" — the family always
 * knows who they are caring for, so that is the more useful label for the one
 * role that cannot read the name.
 */
export function circleDisplayName(circle: CircleSummary): string {
  const name = circle.name?.trim();

  if (name !== undefined && name.length > 0) {
    return name;
  }

  const recipient = circle.recipientName?.trim();

  if (recipient !== undefined && recipient.length > 0) {
    return `Caring for ${recipient}`;
  }

  return 'Your circle';
}

/**
 * The circle to work in: the remembered one when it is still theirs, otherwise
 * the first they belong to.
 *
 * `circles` is in the order the database returned them (oldest membership
 * first), so the fallback is stable across launches rather than random.
 */
export function chooseActiveCircle(
  circles: readonly CircleSummary[],
  rememberedId: string | null,
): CircleSummary | null {
  if (circles.length === 0) {
    return null;
  }

  if (rememberedId !== null) {
    const remembered = circles.find((circle) => circle.circleId === rememberedId);

    if (remembered !== undefined) {
      return remembered;
    }
  }

  return circles[0] ?? null;
}

/** A switcher with one option is clutter, not a choice. */
export function shouldShowSwitcher(circles: readonly CircleSummary[]): boolean {
  return circles.length > 1;
}

/**
 * Where a remembered choice should be written.
 *
 * `null` means "nothing to remember": there is only one circle, or none. The
 * store is then cleared, so a device does not keep a stale id around after a
 * family shrinks back to one circle.
 */
export function rememberedChoiceFor(
  circles: readonly CircleSummary[],
  activeId: string | null,
): string | null {
  if (!shouldShowSwitcher(circles) || activeId === null) {
    return null;
  }

  return circles.some((circle) => circle.circleId === activeId) ? activeId : null;
}
