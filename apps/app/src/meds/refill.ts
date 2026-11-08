/**
 * Refill reminders — in the app, on the row, quietly.
 *
 * The family types a refill date and how many days before it they want to hear
 * about it. Until notifications arrive (Task 15) that reminder is a calm line on
 * the medicine's own row and a soft count at the top of the list. Not a red
 * badge, not a modal, not a banner across the screen: a refill is a piece of
 * admin a family is already thinking about, and shouting at them about it is the
 * opposite of what this product is for.
 *
 * Nothing here decides *whether* a refill is needed. It reads the date the family
 * typed. There is no quantity on a medication and no arithmetic that could turn
 * "taken twice a day" into "you are running out" — that would be the app telling
 * someone about their medicine rather than holding what they wrote.
 */
import type { Medication } from './doseSlots';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` as the day number since the epoch, or null when it is not a date. */
function dayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Number.isNaN(time) ? null : Math.round(time / DAY_MS);
}

/** Whole days from `today` to `date`: 0 is today, negative is in the past. */
export function daysUntil(date: string, today: string): number | null {
  const target = dayNumber(date);
  const from = dayNumber(today);

  if (target === null || from === null) {
    return null;
  }

  return target - from;
}

/**
 * "12 Nov" — the short date a refill line uses.
 *
 * Short on purpose: the line sits at the end of a row, and "12 November 2026"
 * wraps onto a second line on a 390pt phone at 200% text size. The year is
 * dropped because a refill date is always near.
 */
export function shortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (match === null) {
    return value.trim();
  }

  const month = MONTHS[Number(match[2]) - 1];

  if (month === undefined) {
    return value.trim();
  }

  return `${String(Number(match[3]))} ${month}`;
}

/**
 * The line on a medicine's row, or `null` when there is nothing to say.
 *
 * The window is `refill_reminder_days` before the date the family typed, and it
 * opens exactly when they asked it to: a reminder set for 7 days is silent 8 days
 * out. Once the date has passed the line stays, in the past tense — a refill that
 * was due last Tuesday is still the thing to do next, and a line that vanishes is
 * a line somebody has to remember instead.
 */
export function refillLine(medication: Medication, today: string): string | null {
  if (medication.archivedAt !== null || medication.refillDueOn === null) {
    return null;
  }

  const days = daysUntil(medication.refillDueOn, today);

  if (days === null || days > medication.refillReminderDays) {
    return null;
  }

  if (days < 0) {
    return `Refill was due ${shortDate(medication.refillDueOn)}`;
  }

  if (days === 0) {
    return 'Refill due today';
  }

  if (days === 1) {
    return 'Refill due tomorrow';
  }

  return `Refill due ${shortDate(medication.refillDueOn)}`;
}

/** How many medicines are showing a refill line, for the count at the top. */
export function refillCount(medications: readonly Medication[], today: string): number {
  return medications.filter((medication) => refillLine(medication, today) !== null).length;
}

/**
 * The soft count at the top of the list: "2 refills coming up".
 *
 * It is a count, not a warning, and it never says what to do — "call the
 * pharmacy" is the family's decision and their pharmacy's business.
 */
export function refillCountLine(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return count === 1 ? '1 refill coming up' : `${String(count)} refills coming up`;
}
