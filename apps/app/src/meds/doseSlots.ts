/**
 * Today's doses, worked out on the phone.
 *
 * The database stores a *schedule* — the clock times the family typed — and one
 * row per tick. A dose is never stored, because nothing runs at midnight to
 * create tomorrow's rows (there is no scheduler, and a phone in a kitchen may be
 * offline all night). So the screen derives the day's slots here, in one pure
 * function with a table of tests.
 *
 * That is the whole reason this file exists: a dose can never render as "not
 * scheduled" when it is really "not taken". The worst failure this product has
 * is a family member ticking a dose that was never offered, or *not* ticking one
 * because the screen did not know it existed.
 *
 * ## Nothing here knows what a medicine does
 *
 * A slot carries the family's own words — name, strength, form, instructions —
 * and a clock time. There is no dose amount, no quantity and no arithmetic on a
 * strength anywhere in this file, and there must never be: Tendshare organizes
 * care; it never gives it.
 */

/** One clock time the family typed. `timeOfDay` is `HH:MM` or `HH:MM:SS`. */
export interface MedTime {
  readonly id: string;
  readonly timeOfDay: string;
  /** Free text as typed: "morning", "with breakfast". Optional. */
  readonly label: string | null;
  readonly sortOrder: number;
}

/** A medicine exactly as the family wrote it. */
export interface Medication {
  readonly id: string;
  readonly circleId: string;
  readonly careRecipientId: string;
  readonly name: string;
  readonly strength: string | null;
  readonly form: string | null;
  readonly instructions: string | null;
  /** ISO `YYYY-MM-DD`, or null when the family did not say. */
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly refillDueOn: string | null;
  readonly refillReminderDays: number;
  /** Set when the medicine was archived. It stays in the list, greyed, never deleted. */
  readonly archivedAt: string | null;
  readonly times: readonly MedTime[];
}

/** One ticked dose slot. The only row a dose ever creates. */
export interface CheckOff {
  readonly id: string;
  readonly medicationId: string;
  /** ISO `YYYY-MM-DD`. */
  readonly doseDate: string;
  /** `HH:MM` or `HH:MM:SS`. */
  readonly doseTime: string;
  /** Who ticked it, or null when that account has been deleted. */
  readonly takenByName: string | null;
  /** ISO timestamp, stamped by the database. Never backdated. */
  readonly takenAt: string;
}

/** A medicine at one clock time on one day. */
export interface DoseSlot {
  /** `medicationId|doseDate|HH:MM` — stable across a re-read. */
  readonly key: string;
  readonly medicationId: string;
  readonly medicationName: string;
  readonly strength: string | null;
  readonly form: string | null;
  readonly instructions: string | null;
  readonly doseDate: string;
  /** `HH:MM`, normalised from whatever the database returned. */
  readonly doseTime: string;
  /** The clock time as the family would say it: "8:00 am". */
  readonly clock: string;
  readonly timeLabel: string | null;
  /** The tick, or null when this slot is still open. */
  readonly checkOff: CheckOff | null;
}

/** Every dose at one clock time, in the order the day runs. */
export interface ClockGroup {
  readonly doseTime: string;
  readonly clock: string;
  readonly slots: readonly DoseSlot[];
}

const CLOCK_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * `"08:00:00"`, `"8:00"` or `"8:0"` → `{ hours: 8, minutes: 0 }`, or null.
 *
 * Postgres hands back `HH:MM:SS`; a fixture or a hand-typed time may not. Every
 * function below takes either, so nothing downstream has to care.
 */
export function parseClock(value: string): { readonly hours: number; readonly minutes: number } | null {
  const match = CLOCK_PATTERN.exec(value.trim());

  if (match === null) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/** `"08:00:00"` → `"08:00"`. An unparseable value comes back unchanged. */
export function normalizeClock(value: string): string {
  const parsed = parseClock(value);

  if (parsed === null) {
    return value.trim();
  }

  return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`;
}

/**
 * `"08:00"` → `"8:00 am"`, `"13:00"` → `"1:00 pm"`.
 *
 * The family typed a time of day, not a 24-hour clock, so it is read back to
 * them the way they said it. Midnight is `12:00 am` and noon `12:00 pm`, which
 * is the one pair people actually check.
 */
export function clockLabel(value: string): string {
  const parsed = parseClock(value);

  if (parsed === null) {
    return value.trim();
  }

  const suffix = parsed.hours < 12 ? 'am' : 'pm';
  const hour = parsed.hours % 12 === 0 ? 12 : parsed.hours % 12;

  return `${String(hour)}:${String(parsed.minutes).padStart(2, '0')} ${suffix}`;
}

/** Today, or any moment, as the `YYYY-MM-DD` a dose is keyed by — local time. */
export function doseDateOf(moment: Date): string {
  const year = moment.getFullYear();
  const month = String(moment.getMonth() + 1).padStart(2, '0');
  const day = String(moment.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Is this medicine being taken on `date`?
 *
 * An archived medicine is not, whatever its dates say. A start or end date the
 * family left blank means "no boundary" rather than "unknown": a family who
 * types a name and a time and nothing else has a medicine they take today.
 *
 * ISO dates compare correctly as strings, so this needs no parsing and no
 * timezone — which is exactly the class of bug that makes a dose disappear for
 * somebody in another country.
 */
export function isActiveOn(medication: Medication, date: string): boolean {
  if (medication.archivedAt !== null) {
    return false;
  }

  if (medication.startsOn !== null && medication.startsOn > date) {
    return false;
  }

  if (medication.endsOn !== null && medication.endsOn < date) {
    return false;
  }

  return true;
}

/** `medicationId|YYYY-MM-DD|HH:MM` — the same key the database's unique row uses. */
export function slotKey(medicationId: string, date: string, time: string): string {
  return `${medicationId}|${date}|${normalizeClock(time)}`;
}

/** A tick, found by the slot it belongs to. */
function checkOffIndex(checkOffs: readonly CheckOff[]): ReadonlyMap<string, CheckOff> {
  const index = new Map<string, CheckOff>();

  for (const checkOff of checkOffs) {
    index.set(slotKey(checkOff.medicationId, checkOff.doseDate, checkOff.doseTime), checkOff);
  }

  return index;
}

/**
 * Every dose scheduled on `date`, in clock order, each with its tick or `null`.
 *
 * Medicines with no times produce no slots — a medicine the family has not
 * scheduled yet is a real state (it shows in the list below today's doses), and
 * inventing a slot for it would be inventing a time.
 */
export function buildDoseSlots(
  medications: readonly Medication[],
  checkOffs: readonly CheckOff[],
  date: string,
): readonly DoseSlot[] {
  const index = checkOffIndex(checkOffs);
  const slots: DoseSlot[] = [];

  for (const medication of medications) {
    if (!isActiveOn(medication, date)) {
      continue;
    }

    for (const time of medication.times) {
      const doseTime = normalizeClock(time.timeOfDay);

      if (parseClock(doseTime) === null) {
        continue;
      }

      slots.push({
        key: slotKey(medication.id, date, doseTime),
        medicationId: medication.id,
        medicationName: medication.name,
        strength: medication.strength,
        form: medication.form,
        instructions: medication.instructions,
        doseDate: date,
        doseTime,
        clock: clockLabel(doseTime),
        timeLabel: time.label,
        checkOff: index.get(slotKey(medication.id, date, doseTime)) ?? null,
      });
    }
  }

  return slots.sort(compareSlots);
}

/** Clock order first; a tie falls back to the medicine's name, so it never jitters. */
function compareSlots(a: DoseSlot, b: DoseSlot): number {
  if (a.doseTime !== b.doseTime) {
    return a.doseTime < b.doseTime ? -1 : 1;
  }

  return a.medicationName.localeCompare(b.medicationName);
}

/**
 * The slots gathered under the clock time the family typed — "8:00 am", then
 * "1:00 pm" — which is how a day is actually read: what is due now, what is next.
 */
export function groupSlotsByClock(slots: readonly DoseSlot[]): readonly ClockGroup[] {
  const groups: ClockGroup[] = [];

  for (const slot of slots) {
    const last = groups[groups.length - 1];

    if (last !== undefined && last.doseTime === slot.doseTime) {
      groups[groups.length - 1] = { ...last, slots: [...last.slots, slot] };
      continue;
    }

    groups.push({ doseTime: slot.doseTime, clock: slot.clock, slots: [slot] });
  }

  return groups;
}

/** How many of the day's doses are still open, for the line at the top. */
export function openDoseCount(slots: readonly DoseSlot[]): number {
  return slots.filter((slot) => slot.checkOff === null).length;
}

/**
 * The few doses the Today card shows: what is still to do first, then what has
 * already been done today.
 *
 * The card is a glance, not the list, so it has room for three. An open dose is
 * the thing a family can act on, so open ones come first in clock order; the
 * ticked ones follow, because "Sara did the 8 am one" is the answer to the
 * question that made them open the app.
 */
export function nextDoses(slots: readonly DoseSlot[], limit = 3): readonly DoseSlot[] {
  const open = slots.filter((slot) => slot.checkOff === null);
  const done = slots.filter((slot) => slot.checkOff !== null);

  return [...open, ...done].slice(0, Math.max(0, limit));
}

/**
 * The medicines in the list below today: everything not archived, by name.
 *
 * Archived medicines are left out of this list on purpose — they are still
 * there, still readable, and still in the change history; the sheet that
 * archived one is where they come back from. A list that keeps dead entries at
 * full strength is how a family ends up ticking a medicine that stopped in
 * March.
 */
export function listMedications(medications: readonly Medication[]): readonly Medication[] {
  return medications
    .filter((medication) => medication.archivedAt === null)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "500 mg tablet" — the two things a family writes after the name, or nothing. */
export function strengthAndForm(medication: {
  readonly strength: string | null;
  readonly form: string | null;
}): string {
  const parts = [medication.strength, medication.form].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  );

  return parts.join(' · ');
}

/** The times of one medicine as one line: "8:00 am, 1:00 pm, 8:00 pm". */
export function timesLine(times: readonly MedTime[]): string {
  if (times.length === 0) {
    return 'No times set yet';
  }

  return times
    .map((time) => normalizeClock(time.timeOfDay))
    .slice()
    .sort()
    .map(clockLabel)
    .join(', ');
}
