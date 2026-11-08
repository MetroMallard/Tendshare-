/**
 * The optimistic shapes: the snapshot after a change that has not been saved yet.
 *
 * Every write on the meds screens paints first and confirms second, because a
 * form that waits for a round trip on a kitchen wifi feels broken. These are the
 * four functions that paint, kept pure and tested so the rollback is the exact
 * inverse of the paint rather than a guess.
 *
 * A temporary id is prefixed `pending-`, so a row that never made it is obvious
 * in a bug report and can never be mistaken for a real uuid.
 */
import type { CheckOff, Medication, MedTime } from './doseSlots';
import type { MedsSnapshot } from './medData';
import { normalizeClock } from './doseSlots';
import { timesOf, type MedValues } from './medValidation';

/** A row that exists only on this phone, until the database says otherwise. */
export function pendingId(prefix: string): string {
  return `pending-${prefix}-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
}

/** Add a tick. */
export function withCheckOff(snapshot: MedsSnapshot, checkOff: CheckOff): MedsSnapshot {
  return { ...snapshot, checkOffs: [...snapshot.checkOffs, checkOff] };
}

/** Remove a tick — the rollback of `withCheckOff`, and the undo itself. */
export function withoutCheckOff(snapshot: MedsSnapshot, checkOffId: string): MedsSnapshot {
  return {
    ...snapshot,
    checkOffs: snapshot.checkOffs.filter((checkOff) => checkOff.id !== checkOffId),
  };
}

/** Replace a check-off in place, when the server answers with the real row. */
export function withReplacedCheckOff(
  snapshot: MedsSnapshot,
  fromId: string,
  to: CheckOff,
): MedsSnapshot {
  return {
    ...snapshot,
    checkOffs: snapshot.checkOffs.map((checkOff) => (checkOff.id === fromId ? to : checkOff)),
  };
}

/** Add or replace a medicine, keeping the list in the order the server sends it. */
export function withMedication(snapshot: MedsSnapshot, medication: Medication): MedsSnapshot {
  const exists = snapshot.medications.some((current) => current.id === medication.id);

  return {
    ...snapshot,
    medications: exists
      ? snapshot.medications.map((current) =>
          current.id === medication.id ? medication : current,
        )
      : [...snapshot.medications, medication],
  };
}

/** Remove a medicine — the rollback of a failed add, or an archive that landed. */
export function withoutMedication(snapshot: MedsSnapshot, medicationId: string): MedsSnapshot {
  return {
    ...snapshot,
    medications: snapshot.medications.filter((medication) => medication.id !== medicationId),
  };
}

/** A medicine as the sheet's values describe it, for painting before the save. */
export function medicationFromValues(
  values: MedValues,
  input: {
    readonly id: string;
    readonly circleId: string;
    readonly careRecipientId: string;
    /** The row this replaces, when the sheet was editing one. */
    readonly previous?: Medication | null;
  },
): Medication {
  const times: readonly MedTime[] = timesOf(values).map((time, index) => ({
    id: pendingId(`time-${String(index)}`),
    timeOfDay: `${normalizeClock(time)}:00`,
    label: null,
    sortOrder: index,
  }));

  const trim = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  return {
    id: input.id,
    circleId: input.circleId,
    careRecipientId: input.careRecipientId,
    name: values.name.trim(),
    strength: trim(values.strength),
    form: trim(values.form),
    instructions: trim(values.instructions),
    startsOn: trim(values.startsOn),
    endsOn: trim(values.endsOn),
    refillDueOn: trim(values.refillDueOn),
    refillReminderDays: Number(values.refillReminderDays.trim() || '7'),
    archivedAt: input.previous?.archivedAt ?? null,
    times,
  };
}
