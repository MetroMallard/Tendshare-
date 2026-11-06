import { describe, expect, it } from 'vitest';

import {
  emptyToNull,
  hasErrors,
  isPhoneLike,
  parseDateOfBirth,
  validateBasics,
  validateCondition,
  validateContact,
  validateInsurance,
} from './validation';

const GOOD_CONTACT = {
  name: 'Dr Patel',
  organisation: 'Riverside Clinic',
  phone: '555 0142',
  address: '',
  notes: '',
};

const GOOD_BASICS = {
  fullName: 'Margaret Jones',
  preferredName: 'Peg',
  relationship: 'Mom',
  dateOfBirth: '1942-03-12',
  phone: '(555) 0142',
  notes: '',
};

describe('a doctor or a pharmacy', () => {
  it('needs a name and nothing else', () => {
    expect(validateContact(GOOD_CONTACT)).toEqual({});
    expect(validateContact({ ...GOOD_CONTACT, name: '   ' }).name).toBeDefined();
  });

  it('accepts the punctuation a phone number actually has', () => {
    for (const phone of ['555 0142', '+44 20 7946 0958', '(555) 014-2000', '']) {
      expect(validateContact({ ...GOOD_CONTACT, phone }).phone).toBeUndefined();
    }
  });

  it('refuses letters in a phone number', () => {
    expect(validateContact({ ...GOOD_CONTACT, phone: 'call the surgery' }).phone).toBeDefined();
  });

  it('refuses a note that is a paragraph', () => {
    expect(validateContact({ ...GOOD_CONTACT, notes: 'x'.repeat(1001) }).notes).toBeDefined();
  });
});

describe('an allergy or a condition', () => {
  it('takes whatever the family typed', () => {
    // No picklist, no severity, no clinical vocabulary: any non-empty label is
    // a valid answer, which is the whole point of the table.
    for (const label of ['Penicillin', 'nuts (mild)', 'arthritis', 'AFib']) {
      expect(validateCondition({ label, notes: '' })).toEqual({});
    }
  });

  it('needs a label', () => {
    expect(validateCondition({ label: ' ', notes: '' }).label).toBeDefined();
  });
});

describe('an insurance card', () => {
  it('needs the plan name', () => {
    expect(
      validateInsurance({ planName: '', memberId: '', groupNumber: '' }).planName,
    ).toBeDefined();
    expect(
      validateInsurance({ planName: 'Blue Shield', memberId: 'X12', groupNumber: 'G9' }),
    ).toEqual({});
  });
});

describe('the basics', () => {
  it('accepts a complete answer', () => {
    expect(validateBasics(GOOD_BASICS)).toEqual({});
  });

  it('needs a name and tolerates everything else being blank', () => {
    const blank = {
      fullName: 'Margaret',
      preferredName: '',
      relationship: '',
      dateOfBirth: '',
      phone: '',
      notes: '',
    };

    expect(validateBasics(blank)).toEqual({});
    expect(validateBasics({ ...blank, fullName: ' ' }).fullName).toBeDefined();
  });

  it('reports the birthday, not the phone, when the birthday is wrong', () => {
    const errors = validateBasics({ ...GOOD_BASICS, dateOfBirth: '1942-13-01' });

    expect(errors.dateOfBirth).toBeDefined();
    expect(errors.phone).toBeUndefined();
  });
});

describe('a date of birth', () => {
  it('is optional', () => {
    expect(parseDateOfBirth('')).toEqual({ ok: true, value: null });
    expect(parseDateOfBirth('   ')).toEqual({ ok: true, value: null });
  });

  it('takes a real date', () => {
    expect(parseDateOfBirth('1942-03-12')).toEqual({ ok: true, value: '1942-03-12' });
  });

  it('refuses a day that does not exist', () => {
    const result = parseDateOfBirth('1942-02-31');

    expect(result.ok).toBe(false);
  });

  it('refuses the wrong shape, so the column never receives one', () => {
    for (const value of ['12/03/1942', '1942-3-12', 'March 1942', 'yesterday']) {
      expect(parseDateOfBirth(value).ok).toBe(false);
    }
  });

  it('refuses a date in the future and a year before 1900', () => {
    const nextYear = new Date().getUTCFullYear() + 1;

    expect(parseDateOfBirth(`${String(nextYear)}-01-01`).ok).toBe(false);
    expect(parseDateOfBirth('1899-12-31').ok).toBe(false);
  });
});

describe('the small helpers', () => {
  it('knows an empty field from a filled one', () => {
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull('  Peg ')).toBe('Peg');
  });

  it('treats an empty phone as fine and a wordy one as not', () => {
    expect(isPhoneLike('')).toBe(true);
    expect(isPhoneLike('555 0142')).toBe(true);
    expect(isPhoneLike('ask for Sandra')).toBe(false);
  });

  it('summarises whether a form can be saved', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ name: undefined })).toBe(false);
    expect(hasErrors({ name: 'Add a name.' })).toBe(true);
  });
});
