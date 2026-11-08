/**
 * What the medicine sheet accepts, as pure functions.
 *
 * Every rule here is about the *shape* of an answer — is there a name, is this a
 * date, is this a time of day — and none of it is about medicine. There is no
 * interaction check, no "usual" strength, no suggestion, no warning about what a
 * family typed. If a family writes "500 mg" in the strength field, the app writes
 * "500 mg" in the strength field; it never reads it, compares it or comments on
 * it.
 *
 * The length limits match the check constraints on `medications`, so a value the
 * sheet accepts is a value the database accepts, and a refusal arrives as a
 * sentence under the field rather than as a Postgres error on the way home.
 *
 * Kept out of the components so the rules can be tested without a renderer, and
 * so the same sentence appears wherever the same rule is broken.
 */
import { normalizeClock, parseClock } from './doseSlots';
import { emptyToNull } from '../profile/validation';

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

/** Longest name we store. Matches `medications_name_check`. */
export const MED_NAME_MAX_LENGTH = 120;
export const STRENGTH_MAX_LENGTH = 60;
export const FORM_MAX_LENGTH = 60;
export const INSTRUCTIONS_MAX_LENGTH = 1000;
/** Matches `refill_reminder_days between 0 and 90`. */
export const REMINDER_DAYS_MAX = 90;
/** How many clock times one medicine may have. Generous, and finite. */
export const MAX_TIMES = 12;

export interface MedValues {
  readonly name: string;
  readonly strength: string;
  readonly form: string;
  readonly instructions: string;
  /** One entry per row of the times editor, as typed: "8:00", "13:00", "8:00 am". */
  readonly times: readonly string[];
  /** `YYYY-MM-DD` or empty. */
  readonly startsOn: string;
  readonly endsOn: string;
  readonly refillDueOn: string;
  /** A string, because it comes from a text field. Validated as an integer. */
  readonly refillReminderDays: string;
}

export type MedField = keyof MedValues;

export const EMPTY_MED_VALUES: MedValues = {
  name: '',
  strength: '',
  form: '',
  instructions: '',
  times: [''],
  startsOn: '',
  endsOn: '',
  refillDueOn: '',
  refillReminderDays: '7',
};

/**
 * A clock time as the family typed it, read leniently.
 *
 * "8:00", "08:00", "8.00", "800" and "8:00 am" all mean eight in the morning,
 * because that is what a person types into a small box. The result is `HH:MM`,
 * which is what `medication_times.time_of_day` stores, or `null` when the answer
 * is not a time at all.
 */
export function parseTimeOfDay(value: string): string | null {
  const trimmed = value.trim().toLowerCase();

  if (trimmed.length === 0) {
    return null;
  }

  // "8 am" and "8pm" are times; the hour alone is enough when the suffix is there.
  const suffixed = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(trimmed);

  if (suffixed !== null) {
    const hour = Number(suffixed[1]);
    const minutes = Number(suffixed[2] ?? '0');
    const meridiem = suffixed[3];

    if (hour < 1 || hour > 12 || minutes > 59) {
      return null;
    }

    const hours = meridiem === 'pm' ? (hour % 12) + 12 : hour % 12;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // "800" and "0830" — a person who did not bother with the colon.
  const digits = /^(\d{3,4})$/.exec(trimmed);

  if (digits !== null) {
    const padded = (digits[1] as string).padStart(4, '0');
    const candidate = `${padded.slice(0, 2)}:${padded.slice(2)}`;

    return parseClock(candidate) === null ? null : candidate;
  }

  const separated = trimmed.replace('.', ':');
  const parsed = parseClock(separated);

  if (parsed === null) {
    return null;
  }

  return normalizeClock(separated);
}

export type DateResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: string };

/**
 * `YYYY-MM-DD` in, `YYYY-MM-DD` or `null` out.
 *
 * A date is optional on every field of this sheet: a family may not know when a
 * medicine started, and an end date is often "until the review". An empty answer
 * is `null`, not an error.
 */
export function parseOptionalDate(value: string, what: string): DateResult {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: `Use the year, month and day — ${what}.` };
  }

  const [year, month, day] = trimmed.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));

  // A day that does not exist rolls over (31 February becomes 3 March), which is
  // exactly the typo this catches.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, error: 'That date does not exist. Check the day and month.' };
  }

  return { ok: true, value: trimmed };
}

/**
 * The whole form, checked once, on save.
 *
 * Errors land under the field they belong to, in the family's words. The times
 * editor gets one error for the group rather than one per row: a row that is
 * wrong is obvious once the group says so, and six identical sentences stacked
 * down a sheet is not a calmer screen.
 */
export function validateMedication(values: MedValues): FieldErrors<MedField> {
  const errors: FieldErrors<MedField> = {};

  if (values.name.trim().length === 0) {
    errors.name = 'Add the name of the medicine, exactly as it is on the box.';
  } else if (values.name.trim().length > MED_NAME_MAX_LENGTH) {
    errors.name = `Keep the name under ${String(MED_NAME_MAX_LENGTH)} characters.`;
  }

  if (values.strength.trim().length > STRENGTH_MAX_LENGTH) {
    errors.strength = `Keep the strength under ${String(STRENGTH_MAX_LENGTH)} characters.`;
  }

  if (values.form.trim().length > FORM_MAX_LENGTH) {
    errors.form = `Keep the form under ${String(FORM_MAX_LENGTH)} characters.`;
  }

  if (values.instructions.trim().length > INSTRUCTIONS_MAX_LENGTH) {
    errors.instructions = `Keep the instructions under ${String(INSTRUCTIONS_MAX_LENGTH)} characters.`;
  }

  const filled = values.times.filter((time) => time.trim().length > 0);

  if (filled.length === 0) {
    errors.times = 'Add at least one time of day, so the dose can be ticked.';
  } else if (filled.length > MAX_TIMES) {
    errors.times = `That is more than ${String(MAX_TIMES)} times. Check the list.`;
  } else {
    const parsed = filled.map(parseTimeOfDay);

    if (parsed.some((time) => time === null)) {
      errors.times = 'Use a time of day — 8:00 or 8:00 am.';
    } else {
      const unique = new Set(parsed as string[]);

      if (unique.size !== parsed.length) {
        errors.times = 'Two of those times are the same. A dose happens once at a time.';
      }
    }
  }

  const startsOn = parseOptionalDate(values.startsOn, '2026-03-12');
  const endsOn = parseOptionalDate(values.endsOn, '2026-06-12');
  const refillDueOn = parseOptionalDate(values.refillDueOn, '2026-04-02');

  if (!startsOn.ok) {
    errors.startsOn = startsOn.error;
  }

  if (!endsOn.ok) {
    errors.endsOn = endsOn.error;
  }

  if (!refillDueOn.ok) {
    errors.refillDueOn = refillDueOn.error;
  }

  if (startsOn.ok && endsOn.ok && startsOn.value !== null && endsOn.value !== null) {
    if (endsOn.value < startsOn.value) {
      errors.endsOn = 'The end date is before the start date.';
    }
  }

  const reminder = values.refillReminderDays.trim();

  if (reminder.length === 0) {
    errors.refillReminderDays = 'Say how many days before, or type 0 for no reminder.';
  } else if (!/^\d+$/.test(reminder)) {
    errors.refillReminderDays = 'Use a whole number of days.';
  } else if (Number(reminder) > REMINDER_DAYS_MAX) {
    errors.refillReminderDays = `Keep it under ${String(REMINDER_DAYS_MAX)} days.`;
  }

  return errors;
}

export function hasErrors<Field extends string>(errors: FieldErrors<Field>): boolean {
  return Object.values(errors).some((message) => typeof message === 'string' && message.length > 0);
}

/** The values as the database stores them: trimmed, empty as `null`. */
export interface MedRecord {
  readonly name: string;
  readonly strength: string | null;
  readonly form: string | null;
  readonly instructions: string | null;
  readonly starts_on: string | null;
  readonly ends_on: string | null;
  readonly refill_due_on: string | null;
  readonly refill_reminder_days: number;
}

export function medRecordOf(values: MedValues): MedRecord {
  return {
    name: values.name.trim(),
    strength: emptyToNull(values.strength),
    form: emptyToNull(values.form),
    instructions: emptyToNull(values.instructions),
    starts_on: emptyToNull(values.startsOn),
    ends_on: emptyToNull(values.endsOn),
    refill_due_on: emptyToNull(values.refillDueOn),
    refill_reminder_days: Number(values.refillReminderDays.trim() || '7'),
  };
}

/**
 * The clock times, normalised, de-duplicated and sorted — the exact set that
 * should exist in `medication_times` after a save.
 */
export function timesOf(values: MedValues): readonly string[] {
  const parsed = values.times
    .map((time) => parseTimeOfDay(time))
    .filter((time): time is string => time !== null);

  return [...new Set(parsed)].sort();
}

/** The form values for a medicine that already exists. */
export function valuesOf(medication: {
  readonly name: string;
  readonly strength: string | null;
  readonly form: string | null;
  readonly instructions: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly refillDueOn: string | null;
  readonly refillReminderDays: number;
  readonly times: readonly { readonly timeOfDay: string }[];
}): MedValues {
  const times = medication.times
    .map((time) => normalizeClock(time.timeOfDay))
    .sort()
    .map(clockToTwentyFourHour);

  return {
    name: medication.name,
    strength: medication.strength ?? '',
    form: medication.form ?? '',
    instructions: medication.instructions ?? '',
    times: times.length > 0 ? times : [''],
    startsOn: medication.startsOn ?? '',
    endsOn: medication.endsOn ?? '',
    refillDueOn: medication.refillDueOn ?? '',
    refillReminderDays: String(medication.refillReminderDays),
  };
}

/**
 * `HH:MM` as a value the times editor shows: 24-hour, because the field's hint
 * says so and a family who typed "20:00" should not open the sheet to find
 * "8:00 pm" and wonder whether it changed.
 */
function clockToTwentyFourHour(value: string): string {
  return normalizeClock(value);
}
