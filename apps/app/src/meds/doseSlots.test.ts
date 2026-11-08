import { describe, expect, it } from 'vitest';

import {
  buildDoseSlots,
  clockLabel,
  doseDateOf,
  groupSlotsByClock,
  isActiveOn,
  listMedications,
  normalizeClock,
  nextDoses,
  openDoseCount,
  parseClock,
  slotKey,
  strengthAndForm,
  timesLine,
  type CheckOff,
  type Medication,
} from './doseSlots';

function medication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'm1',
    circleId: 'c1',
    careRecipientId: 'r1',
    name: 'Metformin',
    strength: '500 mg',
    form: 'tablet',
    instructions: 'With breakfast',
    startsOn: null,
    endsOn: null,
    refillDueOn: null,
    refillReminderDays: 7,
    archivedAt: null,
    times: [
      { id: 't1', timeOfDay: '08:00:00', label: null, sortOrder: 0 },
      { id: 't2', timeOfDay: '13:00:00', label: null, sortOrder: 1 },
    ],
    ...overrides,
  };
}

function checkOff(overrides: Partial<CheckOff> = {}): CheckOff {
  return {
    id: 'k1',
    medicationId: 'm1',
    doseDate: '2026-11-07',
    doseTime: '08:00:00',
    takenByName: 'Sara',
    takenAt: '2026-11-07T08:12:00',
    ...overrides,
  };
}

describe('parseClock', () => {
  it('reads the shapes a database and a person both produce', () => {
    expect(parseClock('08:00:00')).toEqual({ hours: 8, minutes: 0 });
    expect(parseClock('8:00')).toEqual({ hours: 8, minutes: 0 });
    expect(parseClock(' 23:59 ')).toEqual({ hours: 23, minutes: 59 });
    expect(parseClock('00:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it('refuses anything that is not a time of day', () => {
    expect(parseClock('')).toBeNull();
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('12:60')).toBeNull();
    expect(parseClock('noon')).toBeNull();
    expect(parseClock('8')).toBeNull();
  });
});

describe('normalizeClock', () => {
  it('drops the seconds Postgres adds', () => {
    expect(normalizeClock('08:00:00')).toBe('08:00');
    expect(normalizeClock('8:05')).toBe('08:05');
  });

  it('leaves a value it cannot read alone rather than inventing a time', () => {
    expect(normalizeClock('morning')).toBe('morning');
  });
});

describe('clockLabel', () => {
  it('says a time the way the family typed it', () => {
    expect(clockLabel('08:00')).toBe('8:00 am');
    expect(clockLabel('13:00')).toBe('1:00 pm');
    expect(clockLabel('08:12')).toBe('8:12 am');
    expect(clockLabel('20:30')).toBe('8:30 pm');
  });

  it('gets midnight and noon right, the pair everyone checks', () => {
    expect(clockLabel('00:00')).toBe('12:00 am');
    expect(clockLabel('12:00')).toBe('12:00 pm');
    expect(clockLabel('00:30')).toBe('12:30 am');
  });
});

describe('doseDateOf', () => {
  it('uses the device’s own day, not UTC', () => {
    // 23:30 local on the 7th is the 8th in UTC for most of the world; the dose
    // belongs to the day the person is living in.
    expect(doseDateOf(new Date(2026, 10, 7, 23, 30))).toBe('2026-11-07');
    expect(doseDateOf(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02');
  });
});

describe('isActiveOn', () => {
  const date = '2026-11-07';

  it('treats a blank start or end date as no boundary', () => {
    expect(isActiveOn(medication(), date)).toBe(true);
  });

  it('respects the dates the family typed, on the boundary days too', () => {
    expect(isActiveOn(medication({ startsOn: '2026-11-07' }), date)).toBe(true);
    expect(isActiveOn(medication({ startsOn: '2026-11-08' }), date)).toBe(false);
    expect(isActiveOn(medication({ endsOn: '2026-11-07' }), date)).toBe(true);
    expect(isActiveOn(medication({ endsOn: '2026-11-06' }), date)).toBe(false);
  });

  it('never schedules an archived medicine, whatever its dates say', () => {
    expect(isActiveOn(medication({ archivedAt: '2026-11-01T10:00:00Z' }), date)).toBe(false);
  });
});

describe('buildDoseSlots', () => {
  it('derives one slot per clock time, in clock order', () => {
    const slots = buildDoseSlots([medication()], [], '2026-11-07');

    expect(slots.map((slot) => slot.clock)).toEqual(['8:00 am', '1:00 pm']);
    expect(slots.map((slot) => slot.key)).toEqual([
      'm1|2026-11-07|08:00',
      'm1|2026-11-07|13:00',
    ]);
  });

  it('attaches the tick to the slot it belongs to and leaves the others open', () => {
    const slots = buildDoseSlots([medication()], [checkOff()], '2026-11-07');

    expect(slots[0]?.checkOff?.takenByName).toBe('Sara');
    expect(slots[1]?.checkOff).toBeNull();
  });

  it('never matches a tick from another day or another medicine', () => {
    const slots = buildDoseSlots(
      [medication()],
      [checkOff({ doseDate: '2026-11-06' }), checkOff({ id: 'k2', medicationId: 'm9' })],
      '2026-11-07',
    );

    expect(slots.every((slot) => slot.checkOff === null)).toBe(true);
  });

  it('matches a tick stored as HH:MM:SS against a slot keyed HH:MM', () => {
    const slots = buildDoseSlots(
      [medication()],
      [checkOff({ doseTime: '08:00:00' })],
      '2026-11-07',
    );

    expect(slots[0]?.checkOff).not.toBeNull();
  });

  it('gives a medicine with no times no slots — it is not a dose at midnight', () => {
    expect(buildDoseSlots([medication({ times: [] })], [], '2026-11-07')).toEqual([]);
  });

  it('leaves out an archived medicine and one that has ended', () => {
    const slots = buildDoseSlots(
      [
        medication({ archivedAt: '2026-11-01T00:00:00Z' }),
        medication({ id: 'm2', endsOn: '2026-10-01' }),
        medication({ id: 'm3', startsOn: '2026-12-01' }),
      ],
      [],
      '2026-11-07',
    );

    expect(slots).toEqual([]);
  });

  it('orders two medicines at the same time by name, so the list never jitters', () => {
    const slots = buildDoseSlots(
      [
        medication({ id: 'm1', name: 'Warfarin', times: [{ id: 'a', timeOfDay: '08:00', label: null, sortOrder: 0 }] }),
        medication({ id: 'm2', name: 'Amlodipine', times: [{ id: 'b', timeOfDay: '08:00', label: null, sortOrder: 0 }] }),
      ],
      [],
      '2026-11-07',
    );

    expect(slots.map((slot) => slot.medicationName)).toEqual(['Amlodipine', 'Warfarin']);
  });

  it('carries the family’s words through untouched', () => {
    const slots = buildDoseSlots([medication()], [], '2026-11-07');

    expect(slots[0]).toMatchObject({
      medicationName: 'Metformin',
      strength: '500 mg',
      form: 'tablet',
      instructions: 'With breakfast',
    });
  });
});

describe('groupSlotsByClock', () => {
  it('gathers the day under the clock times the family typed', () => {
    const slots = buildDoseSlots(
      [
        medication(),
        medication({ id: 'm2', name: 'Amlodipine', times: [{ id: 'b', timeOfDay: '08:00', label: null, sortOrder: 0 }] }),
      ],
      [],
      '2026-11-07',
    );

    const groups = groupSlotsByClock(slots);

    expect(groups.map((group) => group.clock)).toEqual(['8:00 am', '1:00 pm']);
    expect(groups[0]?.slots.map((slot) => slot.medicationName)).toEqual([
      'Amlodipine',
      'Metformin',
    ]);
    expect(groups[1]?.slots).toHaveLength(1);
  });

  it('returns nothing for a day with nothing scheduled', () => {
    expect(groupSlotsByClock([])).toEqual([]);
  });
});

describe('openDoseCount', () => {
  it('counts only the doses still waiting', () => {
    const slots = buildDoseSlots([medication()], [checkOff()], '2026-11-07');

    expect(openDoseCount(slots)).toBe(1);
    expect(openDoseCount([])).toBe(0);
  });
});

describe('nextDoses', () => {
  it('puts what is still to do first, then what is done', () => {
    const slots = buildDoseSlots([medication()], [checkOff()], '2026-11-07');

    expect(nextDoses(slots).map((slot) => slot.clock)).toEqual(['1:00 pm', '8:00 am']);
  });

  it('shows at most the number of rows the card has room for', () => {
    const slots = buildDoseSlots([medication()], [], '2026-11-07');

    expect(nextDoses(slots, 1)).toHaveLength(1);
    expect(nextDoses(slots, 0)).toHaveLength(0);
    expect(nextDoses([])).toEqual([]);
  });
});

describe('listMedications', () => {
  it('drops the archived and sorts by name', () => {
    const list = listMedications([
      medication({ id: 'm1', name: 'Warfarin' }),
      medication({ id: 'm2', name: 'Amlodipine' }),
      medication({ id: 'm3', name: 'Old one', archivedAt: '2026-10-01T00:00:00Z' }),
    ]);

    expect(list.map((item) => item.name)).toEqual(['Amlodipine', 'Warfarin']);
  });
});

describe('strengthAndForm', () => {
  it('joins the two things a family writes after the name', () => {
    expect(strengthAndForm({ strength: '500 mg', form: 'tablet' })).toBe('500 mg · tablet');
    expect(strengthAndForm({ strength: '500 mg', form: null })).toBe('500 mg');
    expect(strengthAndForm({ strength: null, form: 'tablet' })).toBe('tablet');
  });

  it('says nothing at all when the family said nothing', () => {
    expect(strengthAndForm({ strength: null, form: null })).toBe('');
    expect(strengthAndForm({ strength: '  ', form: '' })).toBe('');
  });
});

describe('timesLine', () => {
  it('lists the times in clock order', () => {
    expect(
      timesLine([
        { id: 'b', timeOfDay: '20:00:00', label: null, sortOrder: 1 },
        { id: 'a', timeOfDay: '08:00:00', label: null, sortOrder: 0 },
      ]),
    ).toBe('8:00 am, 8:00 pm');
  });

  it('says so plainly when there are none', () => {
    expect(timesLine([])).toBe('No times set yet');
  });
});

describe('slotKey', () => {
  it('is the same key the database’s unique row uses', () => {
    expect(slotKey('m1', '2026-11-07', '8:00')).toBe('m1|2026-11-07|08:00');
  });
});
