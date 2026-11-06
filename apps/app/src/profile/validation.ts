/**
 * What the profile screen accepts, as pure functions.
 *
 * Every rule here is about the *shape* of an answer — is there a name, is this a
 * phone number and not a paragraph — and none of it is about medicine. There is
 * no severity scale, no list of "real" conditions, no dosage and no advice: the
 * family types what the family knows, and the app writes it down.
 *
 * Kept out of the components so the rules can be tested without a renderer, and
 * so the same sentence appears wherever the same rule is broken.
 */

/** Longest name we store. Matches the check constraint on the table. */
export const NAME_MAX_LENGTH = 120;
export const PHONE_MAX_LENGTH = 40;
export const NOTES_MAX_LENGTH = 1000;
export const BASICS_NOTES_MAX_LENGTH = 2000;
export const ADDRESS_MAX_LENGTH = 300;
export const PLAN_MAX_LENGTH = 120;
export const MEMBER_ID_MAX_LENGTH = 80;

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export interface ContactValues {
  readonly name: string;
  readonly organisation: string;
  readonly phone: string;
  readonly address: string;
  readonly notes: string;
}

export type ContactField = keyof ContactValues;

export function validateContact(values: ContactValues): FieldErrors<ContactField> {
  const errors: FieldErrors<ContactField> = {};

  if (values.name.trim().length === 0) {
    errors.name = 'Add a name — even “Dr Patel” is enough.';
  } else if (values.name.trim().length > NAME_MAX_LENGTH) {
    errors.name = `Keep the name under ${String(NAME_MAX_LENGTH)} characters.`;
  }

  if (values.phone.trim().length > PHONE_MAX_LENGTH) {
    errors.phone = `Keep the phone number under ${String(PHONE_MAX_LENGTH)} characters.`;
  } else if (!isPhoneLike(values.phone)) {
    errors.phone = 'Use digits, spaces and + ( ) - only.';
  }

  if (values.organisation.trim().length > NAME_MAX_LENGTH) {
    errors.organisation = `Keep this under ${String(NAME_MAX_LENGTH)} characters.`;
  }

  if (values.address.trim().length > ADDRESS_MAX_LENGTH) {
    errors.address = `Keep the address under ${String(ADDRESS_MAX_LENGTH)} characters.`;
  }

  if (values.notes.trim().length > NOTES_MAX_LENGTH) {
    errors.notes = `Keep the note under ${String(NOTES_MAX_LENGTH)} characters.`;
  }

  return errors;
}

export interface ConditionValues {
  readonly label: string;
  readonly notes: string;
}

export type ConditionField = keyof ConditionValues;

export function validateCondition(values: ConditionValues): FieldErrors<ConditionField> {
  const errors: FieldErrors<ConditionField> = {};

  if (values.label.trim().length === 0) {
    errors.label = 'Type it the way your family says it.';
  } else if (values.label.trim().length > NAME_MAX_LENGTH) {
    errors.label = `Keep it under ${String(NAME_MAX_LENGTH)} characters.`;
  }

  if (values.notes.trim().length > NOTES_MAX_LENGTH) {
    errors.notes = `Keep the note under ${String(NOTES_MAX_LENGTH)} characters.`;
  }

  return errors;
}

export interface InsuranceValues {
  readonly planName: string;
  readonly memberId: string;
  readonly groupNumber: string;
}

export type InsuranceField = keyof InsuranceValues;

export function validateInsurance(values: InsuranceValues): FieldErrors<InsuranceField> {
  const errors: FieldErrors<InsuranceField> = {};

  if (values.planName.trim().length === 0) {
    errors.planName = 'Add the plan name as it appears on the card.';
  } else if (values.planName.trim().length > PLAN_MAX_LENGTH) {
    errors.planName = `Keep the plan name under ${String(PLAN_MAX_LENGTH)} characters.`;
  }

  if (values.memberId.trim().length > MEMBER_ID_MAX_LENGTH) {
    errors.memberId = `Keep the member ID under ${String(MEMBER_ID_MAX_LENGTH)} characters.`;
  }

  if (values.groupNumber.trim().length > MEMBER_ID_MAX_LENGTH) {
    errors.groupNumber = `Keep the group number under ${String(MEMBER_ID_MAX_LENGTH)} characters.`;
  }

  return errors;
}

export interface BasicsValues {
  readonly fullName: string;
  readonly preferredName: string;
  readonly relationship: string;
  readonly dateOfBirth: string;
  readonly phone: string;
  readonly notes: string;
}

export type BasicsField = keyof BasicsValues;

export function validateBasics(values: BasicsValues): FieldErrors<BasicsField> {
  const errors: FieldErrors<BasicsField> = {};

  if (values.fullName.trim().length === 0) {
    errors.fullName = 'A name is the one thing we need.';
  } else if (values.fullName.trim().length > NAME_MAX_LENGTH) {
    errors.fullName = `Keep the name under ${String(NAME_MAX_LENGTH)} characters.`;
  }

  if (values.preferredName.trim().length > 80) {
    errors.preferredName = 'Keep this under 80 characters.';
  }

  if (values.relationship.trim().length > 60) {
    errors.relationship = 'Keep this under 60 characters.';
  }

  if (values.phone.trim().length > PHONE_MAX_LENGTH) {
    errors.phone = `Keep the phone number under ${String(PHONE_MAX_LENGTH)} characters.`;
  } else if (!isPhoneLike(values.phone)) {
    errors.phone = 'Use digits, spaces and + ( ) - only.';
  }

  const birthday = parseDateOfBirth(values.dateOfBirth);

  if (!birthday.ok) {
    errors.dateOfBirth = birthday.error;
  }

  if (values.notes.trim().length > BASICS_NOTES_MAX_LENGTH) {
    errors.notes = `Keep the note under ${String(BASICS_NOTES_MAX_LENGTH)} characters.`;
  }

  return errors;
}

export function hasErrors<Field extends string>(errors: FieldErrors<Field>): boolean {
  return Object.values(errors).some((message) => typeof message === 'string' && message.length > 0);
}

/**
 * Digits, spaces and the punctuation a phone number actually uses.
 *
 * Deliberately loose: families type numbers from three countries and every one
 * of them is right. This rejects letters, which is the only thing that is
 * certainly a mistake.
 */
export function isPhoneLike(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return true;
  }

  return /^[0-9+()\-.\s]+$/.test(trimmed);
}

export type DateOfBirthResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: string };

/**
 * `YYYY-MM-DD` in, `YYYY-MM-DD` or `null` out.
 *
 * A date is optional — plenty of families do not know a birthday, and asking
 * twice is worse than leaving it blank. An empty answer is `null`, not an error.
 */
export function parseDateOfBirth(value: string): DateOfBirthResult {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: 'Use the year, month and day — 1942-03-12.' };
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

  if (year < 1900) {
    return { ok: false, error: 'That is before 1900. Check the year.' };
  }

  const today = new Date();

  if (date.getTime() > Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) {
    return { ok: false, error: 'A birthday cannot be in the future.' };
  }

  return { ok: true, value: trimmed };
}

/** Trim every value in a form and turn "" into `null` for the database. */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
