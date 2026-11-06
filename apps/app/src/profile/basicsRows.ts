/**
 * The basics rows, and who may see which one.
 *
 * The owner's boundary for a visiting helper is exactly: **the photo, the full
 * name and the relationship, and nothing else.** An aide needs to know who they
 * are with — not their date of birth, not their phone number, not what the
 * family calls them at home.
 *
 * That boundary lives here, in one pure function, so it can be tested without a
 * screen and so a later refactor of `ProfileView` cannot quietly widen it. The
 * screen asks the capability (`canSeeCareDetails`), never the role name; the
 * database enforces the same line independently.
 */
import { dateOfBirthLabel, type CareBasics } from './profileData';

export type BasicsRowKey =
  'full-name' | 'preferred-name' | 'relationship' | 'date-of-birth' | 'phone';

export interface BasicsRow {
  readonly key: BasicsRowKey;
  readonly label: string;
  readonly testID: string;
  /** What the family typed, or null when they have not filled it in yet. */
  readonly value: string | null;
}

/** Everything a family member who may see care details gets, in screen order. */
const FULL_ROW_KEYS: readonly BasicsRowKey[] = [
  'full-name',
  'preferred-name',
  'relationship',
  'date-of-birth',
  'phone',
];

/**
 * The visiting helper's list. The photo is not a row — it sits above these — so
 * photo + these two rows is the whole of what a helper sees.
 */
const HELPER_ROW_KEYS: readonly BasicsRowKey[] = ['full-name', 'relationship'];

/** Which basics rows this person may see, in screen order. */
export function basicsRowKeys(canSeeDetails: boolean): readonly BasicsRowKey[] {
  return canSeeDetails ? FULL_ROW_KEYS : HELPER_ROW_KEYS;
}

/** The basics rows for this person, values and all. */
export function basicsRows(basics: CareBasics, canSeeDetails: boolean): readonly BasicsRow[] {
  return basicsRowKeys(canSeeDetails).map((key) => {
    switch (key) {
      case 'full-name':
        return { key, label: 'Full name', testID: 'profile-row-name', value: basics.fullName };
      case 'preferred-name':
        return {
          key,
          label: 'Preferred name',
          testID: 'profile-row-preferred-name',
          value: basics.preferredName,
        };
      case 'relationship':
        return {
          key,
          label: 'Relationship',
          testID: 'profile-row-relationship',
          value: basics.relationship,
        };
      case 'date-of-birth':
        return {
          key,
          label: 'Date of birth',
          testID: 'profile-row-dob',
          value: basics.dateOfBirth === null ? null : dateOfBirthLabel(basics.dateOfBirth),
        };
      case 'phone':
        return { key, label: 'Phone', testID: 'profile-row-phone', value: basics.phone };
    }
  });
}

/**
 * The heading. A helper sees the full name, because "Goes by Mom" is a family
 * shorthand they were not given.
 */
export function basicsTitle(basics: CareBasics | null, canSeeDetails: boolean): string {
  if (basics === null) {
    return 'Their profile';
  }

  return canSeeDetails ? (basics.preferredName ?? basics.fullName) : basics.fullName;
}

/**
 * The quiet line under the name: "Goes by Mom · Mother". A helper gets the
 * relationship alone, and the "not added yet" wording when it is blank.
 */
export function basicsCaption(basics: CareBasics, canSeeDetails: boolean): string {
  const relationship = basics.relationship === null ? '' : basics.relationship.trim();
  const preferredName =
    canSeeDetails && basics.preferredName !== null ? basics.preferredName.trim() : '';

  const parts = [
    preferredName.length === 0 ? null : `Goes by ${preferredName}`,
    relationship.length === 0 ? null : relationship,
  ].filter((part): part is string => part !== null);

  return parts.join(' · ') || 'No relationship added yet';
}
