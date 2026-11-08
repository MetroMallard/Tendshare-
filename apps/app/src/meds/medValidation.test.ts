import { describe, expect, it } from 'vitest';

import {
  EMPTY_MED_VALUES,
  hasErrors,
  medRecordOf,
  parseOptionalDate,
  parseTimeOfDay,
  timesOf,
  validateMedication,
  valuesOf,
  type MedValues,
} from './medValidation';

function values(overrides: Partial<MedValues> = {}): MedValues {
  return { ...EMPTY_MED_VALUES, name: 'Metformin', times: ['8:00'], ...overrides };
}

describe('parseTimeOfDay', () => {
  it('reads the shapes a person actually types', () => {
    expect(parseTimeOfDay('8:00')).toBe('08:00');
    expect(parseTimeOfDay('08:00')).toBe('08:00');
    expect(parseTimeOfDay('13:05')).toBe('13:05');
    expect(parseTimeOfDay('8.30')).toBe('08:30');
    expect(parseTimeOfDay('800')).toBe('08:00');
    expect(parseTimeOfDay('0830')).toBe('08:30');
  });

  it('understands am and pm', () => {
    expect(parseTimeOfDay('8 am')).toBe('08:00');
    expect(parseTimeOfDay('8:15pm')).toBe('20:15');
    expect(parseTimeOfDay('12:00 am')).toBe('00:00');
    expect(parseTimeOfDay('12:00 pm')).toBe('12:00');
  });

  it('refuses what is not a time', () => {
    expect(parseTimeOfDay('')).toBeNull();
    expect(parseTimeOfDay('morning')).toBeNull();
    expect(parseTimeOfDay('25:00')).toBeNull();
    expect(parseTimeOfDay('13:00 pm')).toBeNull();
  });
});

describe('parseOptionalDate', () => {
  it('takes a real date and an empty answer', () => {
    expect(parseOptionalDate('2026-11-12', '2026-11-12')).toEqual({
      ok: true,
      value: '2026-11-12',
    });
    expect(parseOptionalDate('  ', '2026-11-12')).toEqual({ ok: true, value: null });
  });

  it('catches a date that does not exist', () => {
    const result = parseOptionalDate('2026-02-31', '2026-03-12');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/does not exist/i);
  });

  it('asks for the year, month and day in that order', () => {
    const result = parseOptionalDate('12/11/2026', '2026-11-12');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/year, month and day/i);
  });
});

describe('validateMedication', () => {
  it('accepts a name and one time — the least a family has to type', () => {
    expect(validateMedication(values())).toEqual({});
  });

  it('asks for a name under the name field', () => {
    const errors = validateMedication(values({ name: '   ' }));

    expect(errors.name).toMatch(/name of the medicine/i);
  });

  it('asks for at least one time, and says why', () => {
    const errors = validateMedication(values({ times: ['', ''] }));

    expect(errors.times).toMatch(/at least one time/i);
  });

  it('puts the error on the times group when one row is not a time', () => {
    const errors = validateMedication(values({ times: ['8:00', 'later'] }));

    expect(errors.times).toMatch(/8:00/);
  });

  it('refuses the same time twice — a dose happens once at a time', () => {
    const errors = validateMedication(values({ times: ['8:00', '08:00'] }));

    expect(errors.times).toMatch(/same/i);
  });

  it('refuses an end date before the start date', () => {
    const errors = validateMedication(
      values({ startsOn: '2026-06-01', endsOn: '2026-05-01' }),
    );

    expect(errors.endsOn).toMatch(/before the start date/i);
  });

  it('puts each bad date under its own field', () => {
    const errors = validateMedication(
      values({ startsOn: 'nope', endsOn: '2026-02-31', refillDueOn: '12/11/2026' }),
    );

    expect(errors.startsOn).toBeDefined();
    expect(errors.endsOn).toBeDefined();
    expect(errors.refillDueOn).toBeDefined();
  });

  it('checks the reminder days are a whole number in range', () => {
    expect(validateMedication(values({ refillReminderDays: '7' }))).toEqual({});
    expect(validateMedication(values({ refillReminderDays: '0' }))).toEqual({});
    expect(validateMedication(values({ refillReminderDays: '' })).refillReminderDays).toBeDefined();
    expect(
      validateMedication(values({ refillReminderDays: '1.5' })).refillReminderDays,
    ).toBeDefined();
    expect(
      validateMedication(values({ refillReminderDays: '91' })).refillReminderDays,
    ).toBeDefined();
  });

  it('checks the length limits the table enforces, before the write', () => {
    expect(validateMedication(values({ name: 'x'.repeat(121) })).name).toBeDefined();
    expect(validateMedication(values({ strength: 'x'.repeat(61) })).strength).toBeDefined();
    expect(validateMedication(values({ form: 'x'.repeat(61) })).form).toBeDefined();
    expect(validateMedication(values({ instructions: 'x'.repeat(1001) })).instructions).toBeDefined();
  });

  it('never comments on what was typed — only on its shape', () => {
    // "500 mg" is the family's own words, and the app has no opinion on it.
    expect(validateMedication(values({ strength: '500 mg' }))).toEqual({});
    expect(validateMedication(values({ instructions: 'Take with food' }))).toEqual({});
  });
});

describe('hasErrors', () => {
  it('is true only when a sentence is there', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ name: undefined })).toBe(false);
    expect(hasErrors({ name: 'Say something' })).toBe(true);
  });
});

describe('medRecordOf', () => {
  it('trims, and turns an empty answer into null', () => {
    expect(
      medRecordOf(
        values({
          name: '  Metformin  ',
          strength: ' 500 mg ',
          form: '',
          instructions: ' ',
          startsOn: '',
          refillDueOn: '2026-11-12',
          refillReminderDays: '14',
        }),
      ),
    ).toEqual({
      name: 'Metformin',
      strength: '500 mg',
      form: null,
      instructions: null,
      starts_on: null,
      ends_on: null,
      refill_due_on: '2026-11-12',
      refill_reminder_days: 14,
    });
  });

  it('defaults the reminder window rather than sending NaN', () => {
    expect(medRecordOf(values({ refillReminderDays: ' ' })).refill_reminder_days).toBe(7);
  });
});

describe('timesOf', () => {
  it('normalises, de-duplicates and sorts the clock times', () => {
    expect(timesOf(values({ times: ['20:00', '8:00', '0800', '  '] }))).toEqual(['08:00', '20:00']);
  });
});

describe('valuesOf', () => {
  it('fills the sheet from a medicine that already exists', () => {
    const result = valuesOf({
      name: 'Metformin',
      strength: '500 mg',
      form: null,
      instructions: null,
      startsOn: null,
      endsOn: null,
      refillDueOn: null,
      refillReminderDays: 7,
      times: [{ timeOfDay: '20:00:00' }, { timeOfDay: '08:00:00' }],
    });

    expect(result.times).toEqual(['08:00', '20:00']);
    expect(result.strength).toBe('500 mg');
    expect(result.form).toBe('');
    expect(result.refillReminderDays).toBe('7');
  });

  it('leaves one empty time row for a medicine that has none', () => {
    const result = valuesOf({
      name: 'Metformin',
      strength: null,
      form: null,
      instructions: null,
      startsOn: null,
      endsOn: null,
      refillDueOn: null,
      refillReminderDays: 7,
      times: [],
    });

    expect(result.times).toEqual(['']);
  });
});
