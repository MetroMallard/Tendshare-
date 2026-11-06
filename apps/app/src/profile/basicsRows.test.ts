import { describe, expect, it } from 'vitest';

import { basicsCaption, basicsRowKeys, basicsRows, basicsTitle } from './basicsRows';
import type { CareBasics } from './profileData';

const BASICS: CareBasics = {
  id: '11111111-1111-1111-1111-111111111111',
  circleId: '22222222-2222-2222-2222-222222222222',
  fullName: 'Margaret Ellis',
  preferredName: 'Peggy',
  relationship: 'Mother',
  dateOfBirth: '1943-04-12',
  phone: '+1 555 0100',
  photoPath: '22222222-2222-2222-2222-222222222222/photo.jpg',
  notes: 'Prefers the radio on in the morning.',
};

const HELPER = false;
const FAMILY = true;

describe('a visiting helper’s basics rows', () => {
  it('are exactly the photo, the full name and the relationship — and nothing else', () => {
    // The photo is not a row: it sits above these two. So the whole of what a
    // helper sees is photo + this list. The owner's boundary, written down so a
    // later refactor of ProfileView cannot quietly widen it: if a row is ever
    // added for a helper, this assertion fails.
    expect(basicsRowKeys(HELPER)).toEqual(['full-name', 'relationship']);
  });

  it('never include the preferred name, the date of birth or the phone', () => {
    const keys = basicsRowKeys(HELPER);

    expect(keys).not.toContain('preferred-name');
    expect(keys).not.toContain('date-of-birth');
    expect(keys).not.toContain('phone');
  });

  it('carry the full name and the relationship, with the values the family typed', () => {
    const rows = basicsRows(BASICS, HELPER);

    expect(rows.map((row) => row.label)).toEqual(['Full name', 'Relationship']);
    expect(rows.map((row) => row.value)).toEqual(['Margaret Ellis', 'Mother']);
    expect(rows.map((row) => row.testID)).toEqual(['profile-row-name', 'profile-row-relationship']);
  });

  it('keep the relationship row’s "not added yet" wording when it is blank', () => {
    const rows = basicsRows({ ...BASICS, relationship: null }, HELPER);

    expect(rows.map((row) => row.value)).toEqual(['Margaret Ellis', null]);
  });

  it('title the screen with the full name, never the family’s shorthand', () => {
    expect(basicsTitle(BASICS, HELPER)).toBe('Margaret Ellis');
    expect(basicsTitle(BASICS, FAMILY)).toBe('Peggy');
  });

  it('caption the name with the relationship alone, with no "Goes by"', () => {
    expect(basicsCaption(BASICS, HELPER)).toBe('Mother');
    expect(basicsCaption(BASICS, FAMILY)).toBe('Goes by Peggy · Mother');
  });

  it('say so plainly when there is no relationship to caption', () => {
    expect(basicsCaption({ ...BASICS, relationship: null }, HELPER)).toBe(
      'No relationship added yet',
    );
  });
});

describe('a family member’s basics rows', () => {
  it('are all five, in the order the family fills them in', () => {
    expect(basicsRowKeys(FAMILY)).toEqual([
      'full-name',
      'preferred-name',
      'relationship',
      'date-of-birth',
      'phone',
    ]);
  });

  it('carry the typed values, with the date of birth written out', () => {
    const rows = basicsRows(BASICS, FAMILY);

    expect(rows.map((row) => row.value)).toEqual([
      'Margaret Ellis',
      'Peggy',
      'Mother',
      '12 April 1943',
      '+1 555 0100',
    ]);
  });
});

describe('the helper’s list is a strict subset', () => {
  it('so the same profile never shows a helper more than a family member', () => {
    const family = new Set(basicsRowKeys(FAMILY));

    for (const key of basicsRowKeys(HELPER)) {
      expect(family.has(key), `${key} should also be visible to a family member`).toBe(true);
    }

    expect(basicsRowKeys(HELPER).length).toBeLessThan(basicsRowKeys(FAMILY).length);
  });
});
