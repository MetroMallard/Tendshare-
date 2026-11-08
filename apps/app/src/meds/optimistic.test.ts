import { describe, expect, it } from 'vitest';

import type { CheckOff, Medication } from './doseSlots';
import type { MedsSnapshot } from './medData';
import {
  medicationFromValues,
  pendingId,
  withCheckOff,
  withMedication,
  withReplacedCheckOff,
  withoutCheckOff,
  withoutMedication,
} from './optimistic';
import { EMPTY_MED_VALUES } from './medValidation';

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
    refillDueOn: null,
    refillReminderDays: 7,
    archivedAt: null,
    times: [],
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

const SNAPSHOT: MedsSnapshot = {
  careRecipientId: 'r1',
  medications: [medication()],
  checkOffs: [],
};

describe('pendingId', () => {
  it('is recognisable, so a row that never saved is obvious', () => {
    expect(pendingId('tick')).toMatch(/^pending-tick-/);
  });
});

describe('withCheckOff / withoutCheckOff', () => {
  it('paints a tick and takes it back — the rollback is the exact inverse', () => {
    const painted = withCheckOff(SNAPSHOT, checkOff());

    expect(painted.checkOffs).toHaveLength(1);
    expect(withoutCheckOff(painted, 'k1')).toEqual(SNAPSHOT);
  });

  it('leaves other ticks alone when one is removed', () => {
    const two = withCheckOff(withCheckOff(SNAPSHOT, checkOff()), checkOff({ id: 'k2' }));

    expect(withoutCheckOff(two, 'k1').checkOffs.map((row) => row.id)).toEqual(['k2']);
  });

  it('never mutates the snapshot it was given', () => {
    withCheckOff(SNAPSHOT, checkOff());

    expect(SNAPSHOT.checkOffs).toHaveLength(0);
  });
});

describe('withReplacedCheckOff', () => {
  it('swaps the temporary row for the one the database created', () => {
    const painted = withCheckOff(SNAPSHOT, checkOff({ id: 'pending-k' }));
    const settled = withReplacedCheckOff(painted, 'pending-k', checkOff({ id: 'real' }));

    expect(settled.checkOffs.map((row) => row.id)).toEqual(['real']);
  });
});

describe('withMedication / withoutMedication', () => {
  it('adds a medicine, then removes it — the rollback of a failed add', () => {
    const added = withMedication(SNAPSHOT, medication({ id: 'm2', name: 'Warfarin' }));

    expect(added.medications).toHaveLength(2);
    expect(withoutMedication(added, 'm2')).toEqual(SNAPSHOT);
  });

  it('replaces a medicine in place rather than appending a second copy', () => {
    const changed = withMedication(SNAPSHOT, medication({ name: 'Metformin SR' }));

    expect(changed.medications).toHaveLength(1);
    expect(changed.medications[0]?.name).toBe('Metformin SR');
  });
});

describe('medicationFromValues', () => {
  it('builds the row the sheet describes, with a time per typed clock time', () => {
    const built = medicationFromValues(
      {
        ...EMPTY_MED_VALUES,
        name: '  Metformin ',
        strength: '500 mg',
        form: '',
        instructions: ' ',
        times: ['8:00', '20:00'],
        refillReminderDays: '14',
      },
      { id: 'm3', circleId: 'c1', careRecipientId: 'r1' },
    );

    expect(built.name).toBe('Metformin');
    expect(built.form).toBeNull();
    expect(built.instructions).toBeNull();
    expect(built.refillReminderDays).toBe(14);
    expect(built.times.map((time) => time.timeOfDay)).toEqual(['08:00:00', '20:00:00']);
    expect(built.times.every((time) => time.id.startsWith('pending-'))).toBe(true);
  });

  it('keeps the archive state of the row it replaces', () => {
    const built = medicationFromValues(
      { ...EMPTY_MED_VALUES, name: 'Metformin', times: ['8:00'] },
      {
        id: 'm1',
        circleId: 'c1',
        careRecipientId: 'r1',
        previous: medication({ archivedAt: '2026-10-01T00:00:00Z' }),
      },
    );

    expect(built.archivedAt).toBe('2026-10-01T00:00:00Z');
  });
});
