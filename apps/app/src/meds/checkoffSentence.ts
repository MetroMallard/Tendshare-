/**
 * Who ticked a dose, and when — in plain words.
 *
 * A ticked dose is never shown as a bare checkmark. A checkmark answers "done",
 * and what a family needs to know is *who did it* and *when*: two siblings
 * standing in the same kitchen at nine in the evening are asking exactly that.
 *
 * So the row says "Sara, 8:12 am", the Today card says "Sara ticked this at
 * 8:12 am", and the screen reader says the whole fact — the medicine, the clock
 * time, and who — because a control whose state is only a colour is a control
 * half the family cannot use.
 *
 * `takenByName` is `null` in exactly one case: the person who ticked has since
 * deleted their account, and the check-off row was kept with `on delete set
 * null`. The dose was still given; that is a fact about the person being cared
 * for, not about the account. So the sentence stays and the name becomes
 * "Someone" rather than the row vanishing.
 */
import { clockLabel } from './doseSlots';

/** Who did it, as a name a family would use. */
export function actorName(name: string | null): string {
  const trimmed = name?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : 'Someone';
}

/**
 * A moment as a clock time: "8:12 am".
 *
 * Local time, from the device's own clock, because the family reading the row is
 * in the room where it happened. Built by hand rather than through `Intl` so the
 * output is identical on every phone and in every test.
 */
export function spokenTime(takenAt: string): string {
  const parsed = new Date(takenAt);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const suffix = parsed.getHours() < 12 ? 'am' : 'pm';
  const hour = parsed.getHours() % 12 === 0 ? 12 : parsed.getHours() % 12;

  return `${String(hour)}:${String(parsed.getMinutes()).padStart(2, '0')} ${suffix}`;
}

export interface CheckOffFact {
  readonly takenByName: string | null;
  readonly takenAt: string;
}

/**
 * The line under a ticked dose: "Sara, 8:12 am".
 *
 * When the timestamp cannot be read at all (a malformed value from a client
 * clock) the name stands alone rather than the row saying "Invalid Date".
 */
export function checkOffLine(checkOff: CheckOffFact): string {
  const name = actorName(checkOff.takenByName);
  const time = spokenTime(checkOff.takenAt);

  return time.length > 0 ? `${name}, ${time}` : name;
}

/**
 * The whole fact for the Today card: "Sara ticked this at 8:12 am".
 *
 * Past tense, because it happened. A family member reading it at ten at night
 * should not have to work out whether "Sara, 8:12 am" means the dose is still
 * due at 8:12 am tomorrow.
 */
export function tickedSentence(checkOff: CheckOffFact): string {
  const name = actorName(checkOff.takenByName);
  const time = spokenTime(checkOff.takenAt);

  return time.length > 0 ? `${name} ticked this at ${time}` : `${name} ticked this`;
}

export interface TickControlCopyInput {
  readonly medicationName: string;
  /** `HH:MM` or `HH:MM:SS`. */
  readonly doseTime: string;
  readonly checkOff: CheckOffFact | null;
}

/**
 * What the tick control says to a screen reader.
 *
 * Three things, always in the same order: the state ("Ticked" or "Not ticked"),
 * the medicine and its clock time, and — when it is ticked — who did it and
 * when. That is the sentence the brief asks for: *"Ticked: Metformin 8:00 am, by
 * Sara"*. The state comes first so it is heard before the label is lost to a
 * long medicine name.
 */
export function tickAccessibilityLabel(input: TickControlCopyInput): string {
  const subject = `${input.medicationName} ${clockLabel(input.doseTime)}`;

  if (input.checkOff === null) {
    return `Not ticked: ${subject}`;
  }

  return `Ticked: ${subject}, by ${actorName(input.checkOff.takenByName)}`;
}

/** What pressing the tick control will do, for the spoken hint. */
export function tickAccessibilityHint(checkOff: CheckOffFact | null): string {
  return checkOff === null
    ? 'Marks this dose as given.'
    : 'Opens a question about undoing this tick.';
}

export interface UndoCopy {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
}

/**
 * The words on the ConfirmSheet before a tick is undone.
 *
 * Undoing is a second tap with a confirmation, because it **deletes** the row —
 * there is no update path on a check-off, by design, so the undo and any re-tick
 * both reach the change history rather than one silently rewriting the other.
 * The message names what disappears and says the history keeps it.
 */
export function undoCopy(input: {
  readonly medicationName: string;
  readonly doseTime: string;
  readonly checkOff: CheckOffFact;
}): UndoCopy {
  const who = actorName(input.checkOff.takenByName);

  return {
    title: 'Undo this tick?',
    message: `${who} ticked the ${clockLabel(input.doseTime)} ${input.medicationName}. Undoing it puts the dose back to not taken. The change history keeps both.`,
    confirmLabel: 'Undo the tick',
  };
}
