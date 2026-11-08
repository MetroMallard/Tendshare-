import { describe, expect, it } from 'vitest';

import type { Medication } from './doseSlots';
import { daysUntil, refillCount, refillCountLine, refillLine, shortDate } from './refill';

function medication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'm1',
    circleId: 'c1',
    careRecipientId: 'r1',
    name: 'Metformin',
    strength: '500 mg',
    form: 'tablet',
    instructions: null,
    startsOn: null,
    endsOn: null,
    refillDueOn: '2026-11-12',
    refillReminderDays: 7,
    archivedAt: null,
    times: [],
    ...overrides,
  };
}

const TODAY = '2026-11-07';

describe('daysUntil', () => {
  it('counts whole days, across a month boundary and a year boundary', () => {
    expect(daysUntil('2026-11-12', TODAY)).toBe(5);
    expect(daysUntil('2026-11-07', TODAY)).toBe(0);
    expect(daysUntil('2026-11-01', TODAY)).toBe(-6);
    expect(daysUntil('2027-01-01', '2026-12-30')).toBe(2);
  });

  it('is not fooled by a daylight-saving change', () => {
    // 25 October 2026 is when the UK moves its clocks; the arithmetic is on
    // calendar days, so it is still exactly three.
    expect(daysUntil('2026-10-26', '2026-10-23')).toBe(3);
  });

  it('answers null for something that is not a date', () => {
    expect(daysUntil('12/11/2026', TODAY)).toBeNull();
    expect(daysUntil('2026-11-12', 'today')).toBeNull();
  });
});

describe('shortDate', () => {
  it('is the short form the refill line and the history use', () => {
    expect(shortDate('2026-11-12')).toBe('12 Nov');
    expect(shortDate('2026-01-01')).toBe('1 Jan');
    expect(shortDate('2026-12-31')).toBe('31 Dec');
  });

  it('leaves a value it cannot read alone', () => {
    expect(shortDate('sometime')).toBe('sometime');
    expect(shortDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('refillLine', () => {
  it('says nothing until the window the family chose opens', () => {
    expect(refillLine(medication({ refillReminderDays: 3 }), TODAY)).toBeNull();
    expect(refillLine(medication({ refillDueOn: '2026-11-20' }), TODAY)).toBeNull();
  });

  it('opens exactly on the reminder day', () => {
    expect(refillLine(medication({ refillDueOn: '2026-11-14' }), TODAY)).toBe('Refill due 14 Nov');
    expect(refillLine(medication({ refillDueOn: '2026-11-15' }), TODAY)).toBeNull();
  });

  it('uses today and tomorrow rather than a date nobody has to decode', () => {
    expect(refillLine(medication({ refillDueOn: TODAY }), TODAY)).toBe('Refill due today');
    expect(refillLine(medication({ refillDueOn: '2026-11-08' }), TODAY)).toBe(
      'Refill due tomorrow',
    );
  });

  it('stays, in the past tense, once the date has gone by', () => {
    expect(refillLine(medication({ refillDueOn: '2026-11-01' }), TODAY)).toBe(
      'Refill was due 1 Nov',
    );
  });

  it('says nothing for a medicine with no refill date, or an archived one', () => {
    expect(refillLine(medication({ refillDueOn: null }), TODAY)).toBeNull();
    expect(refillLine(medication({ archivedAt: '2026-10-01T00:00:00Z' }), TODAY)).toBeNull();
  });

  it('honours a zero-day reminder: the day itself, and no earlier', () => {
    const med = medication({ refillDueOn: TODAY, refillReminderDays: 0 });
    expect(refillLine(med, TODAY)).toBe('Refill due today');
    expect(refillLine(medication({ refillDueOn: '2026-11-08', refillReminderDays: 0 }), TODAY)).toBeNull();
  });
});

describe('refillCount and refillCountLine', () => {
  it('counts the medicines showing a line', () => {
    const count = refillCount(
      [
        medication({ id: 'a', refillDueOn: TODAY }),
        medication({ id: 'b', refillDueOn: '2026-11-10' }),
        medication({ id: 'c', refillDueOn: '2026-12-30' }),
      ],
      TODAY,
    );

    expect(count).toBe(2);
  });

  it('is a soft count, and silent when there is nothing to say', () => {
    expect(refillCountLine(0)).toBeNull();
    expect(refillCountLine(1)).toBe('1 refill coming up');
    expect(refillCountLine(3)).toBe('3 refills coming up');
  });
});
