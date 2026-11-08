/**
 * The med list, as the app reads it.
 *
 * Three reads under the caller's own Row Level Security, plus one for the names
 * of the people who ticked:
 *
 *   1. `care_recipients` — which person this circle is caring for;
 *   2. `medications` with their `medication_times` — the schedule the family typed;
 *   3. `med_checkoffs` for **one day** — the ticks, and only the ticks.
 *
 * ## Why the check-offs are fetched a day at a time
 *
 * The screen shows today. Asking for the whole history of ticks would be a
 * growing query for a question nobody asked, and it would put a year of a
 * parent's medication into memory to draw six rows. One day, keyed on the same
 * `dose_date` index the table carries.
 *
 * ## The visiting helper
 *
 * A helper can read `medications`, `medication_times` and `med_checkoffs` (they
 * cannot tick a dose they cannot see) and cannot write the schedule at all. That
 * is enforced in the database; nothing here filters by role, because a screen
 * that filters by role is a screen whose rules can drift from the database's.
 *
 * Every loader answers `null` when the read failed. `null` is "we do not know",
 * which the screen renders as an error with a retry — never as an empty list,
 * because "nothing has been added yet" and "we could not ask" must not look the
 * same.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { CheckOff, Medication, MedTime } from './doseSlots';

export interface MedsSnapshot {
  /** The person being cared for, or null when the circle has nobody in it. */
  readonly careRecipientId: string | null;
  readonly medications: readonly Medication[];
  /** The ticks for the requested day. */
  readonly checkOffs: readonly CheckOff[];
}

interface MedicationRow {
  readonly id: string;
  readonly circle_id: string;
  readonly care_recipient_id: string;
  readonly name: string;
  readonly strength: string | null;
  readonly form: string | null;
  readonly instructions: string | null;
  readonly starts_on: string | null;
  readonly ends_on: string | null;
  readonly refill_due_on: string | null;
  readonly refill_reminder_days: number;
  readonly archived_at: string | null;
}

interface TimeRow {
  readonly id: string;
  readonly medication_id: string;
  readonly time_of_day: string;
  readonly label: string | null;
  readonly sort_order: number;
}

interface CheckOffRow {
  readonly id: string;
  readonly medication_id: string;
  readonly dose_date: string;
  readonly dose_time: string;
  readonly taken_by: string | null;
  readonly taken_at: string;
}

interface ProfileRow {
  readonly id: string;
  readonly display_name: string | null;
}

/** Everything the med screens need, in one call. */
export async function loadMeds(
  client: SupabaseClient,
  circleId: string,
  date: string,
): Promise<MedsSnapshot | null> {
  const recipientResult = await client
    .from('care_recipients')
    .select('id')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (recipientResult.error !== null) {
    return null;
  }

  const careRecipientId = recipientResult.data?.id ?? null;

  const [medicationsResult, checkOffsResult] = await Promise.all([
    client
      .from('medications')
      .select(
        'id, circle_id, care_recipient_id, name, strength, form, instructions, starts_on, ends_on, refill_due_on, refill_reminder_days, archived_at',
      )
      .eq('circle_id', circleId)
      .order('name', { ascending: true })
      .returns<MedicationRow[]>(),
    client
      .from('med_checkoffs')
      .select('id, medication_id, dose_date, dose_time, taken_by, taken_at')
      .eq('circle_id', circleId)
      .eq('dose_date', date)
      .returns<CheckOffRow[]>(),
  ]);

  if (medicationsResult.error !== null || checkOffsResult.error !== null) {
    return null;
  }

  const rows = medicationsResult.data ?? [];
  const times = await loadTimes(client, rows.map((row) => row.id));

  if (times === null) {
    return null;
  }

  const checkOffRows = checkOffsResult.data ?? [];
  const names = await loadNames(client, checkOffRows.map((row) => row.taken_by));

  if (names === null) {
    return null;
  }

  return {
    careRecipientId,
    medications: rows.map((row) => toMedication(row, times.filter((t) => t.medicationId === row.id))),
    checkOffs: checkOffRows.map((row) => ({
      id: row.id,
      medicationId: row.medication_id,
      doseDate: row.dose_date,
      doseTime: row.dose_time,
      takenByName: row.taken_by === null ? null : (names.get(row.taken_by) ?? null),
      takenAt: row.taken_at,
    })),
  };
}

async function loadTimes(
  client: SupabaseClient,
  medicationIds: readonly string[],
): Promise<readonly (MedTime & { readonly medicationId: string })[] | null> {
  if (medicationIds.length === 0) {
    return [];
  }

  const result = await client
    .from('medication_times')
    .select('id, medication_id, time_of_day, label, sort_order')
    .in('medication_id', medicationIds)
    .order('time_of_day', { ascending: true })
    .returns<TimeRow[]>();

  if (result.error !== null) {
    return null;
  }

  return (result.data ?? []).map((row) => ({
    id: row.id,
    medicationId: row.medication_id,
    timeOfDay: row.time_of_day,
    label: row.label,
    sortOrder: row.sort_order,
  }));
}

/**
 * The display names of the people who ticked.
 *
 * `profiles` is readable to anyone in the same circle, so this works for every
 * role that can see a tick — including a visiting helper, who must be able to
 * read "Sara, 8:12 am" or the tick they see is a checkmark with no owner.
 */
async function loadNames(
  client: SupabaseClient,
  profileIds: readonly (string | null)[],
): Promise<ReadonlyMap<string, string | null> | null> {
  const ids = [...new Set(profileIds.filter((id): id is string => id !== null))];

  if (ids.length === 0) {
    return new Map();
  }

  const result = await client
    .from('profiles')
    .select('id, display_name')
    .in('id', ids)
    .returns<ProfileRow[]>();

  if (result.error !== null) {
    return null;
  }

  return new Map((result.data ?? []).map((row) => [row.id, row.display_name]));
}

function toMedication(row: MedicationRow, times: readonly MedTime[]): Medication {
  return {
    id: row.id,
    circleId: row.circle_id,
    careRecipientId: row.care_recipient_id,
    name: row.name,
    strength: row.strength,
    form: row.form,
    instructions: row.instructions,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    refillDueOn: row.refill_due_on,
    refillReminderDays: row.refill_reminder_days,
    archivedAt: row.archived_at,
    times: times
      .slice()
      .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay))
      .map((time) => ({
        id: time.id,
        timeOfDay: time.timeOfDay,
        label: time.label,
        sortOrder: time.sortOrder,
      })),
  };
}

/** One medicine, on its own — used after a save to put the real row in place. */
export async function loadMedication(
  client: SupabaseClient,
  medicationId: string,
): Promise<Medication | null> {
  const result = await client
    .from('medications')
    .select(
      'id, circle_id, care_recipient_id, name, strength, form, instructions, starts_on, ends_on, refill_due_on, refill_reminder_days, archived_at',
    )
    .eq('id', medicationId)
    .maybeSingle<MedicationRow>();

  if (result.error !== null || result.data === null) {
    return null;
  }

  const times = await loadTimes(client, [medicationId]);

  if (times === null) {
    return null;
  }

  return toMedication(
    result.data,
    times.filter((time) => time.medicationId === medicationId),
  );
}
