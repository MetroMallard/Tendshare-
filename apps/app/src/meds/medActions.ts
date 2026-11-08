/**
 * The writes: adding and changing a medicine, archiving one, and the tick.
 *
 * ## The audit trail is not written here
 *
 * Every write below lands on a table with a trigger that appends the audit row
 * in the same transaction, with the actor taken from the session and field names
 * only. This file does not write a log line and must not: a client that can write
 * the log can write the wrong thing into it.
 *
 * ## A tick is a fact, not a claim
 *
 * `taken_by` and `taken_at` are stamped by the database from `auth.uid()` and
 * `now()`. The insert below sends neither, so a visiting helper cannot attribute
 * a dose to somebody else and nobody can backdate one. There is no update path on
 * a check-off at all — a mistake is undone by deleting the row and ticking again,
 * which puts both facts in the change history instead of one silently rewriting
 * the other.
 *
 * ## Archive, never delete
 *
 * A medicine that stops is archived (`archived_at`), so the row, its times and
 * its history stay exactly where the family left them. Nothing in this file
 * deletes a medication, and nothing should.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeClock } from './doseSlots';
import { medRecordOf, timesOf, type MedValues } from './medValidation';
import type { MedicationHistoryEntry } from './historySentence';

/**
 * Why a write did not land, in the four cases the family can tell apart.
 *
 * `already_ticked` is not a failure to apologise for: two people ticking the same
 * dose within a second is a family working, not an error, and the second tap is
 * told the dose is already ticked rather than shown a constraint violation.
 */
export type MedProblem = 'not_allowed' | 'already_ticked' | 'offline' | 'unknown';

interface PostgrestLikeError {
  readonly code?: string;
  readonly message?: string;
}

/**
 * Classify a refusal.
 *
 * Order matters: a unique violation is checked first because the check-off's
 * slot key is the only unique constraint a family can hit on this screen.
 */
export function medProblemOf(error: PostgrestLikeError | null): MedProblem {
  if (error === null) {
    return 'unknown';
  }

  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();

  if (code === '23505' || /duplicate key|already exists/.test(message)) {
    return 'already_ticked';
  }

  if (code === '42501' || /row-level security|permission denied|not shared with/.test(message)) {
    return 'not_allowed';
  }

  return 'unknown';
}

export interface MedProblemCopy {
  readonly title: string;
  readonly message: string;
}

/**
 * One calm sentence per refusal, never blaming the person and never losing their
 * work: the sheet keeps its text and the row goes back where it was.
 */
export function medProblemCopy(problem: MedProblem): MedProblemCopy {
  switch (problem) {
    case 'not_allowed':
      return {
        title: 'That didn’t save',
        message:
          'Your role in this circle can’t change the medicine list. Nothing was changed — ask the circle’s owner if you think that’s wrong.',
      };
    case 'already_ticked':
      return {
        title: 'Somebody got there first',
        message:
          'This dose was already ticked by someone else. Nothing is wrong — the list is up to date.',
      };
    case 'offline':
      return {
        title: 'You’re offline',
        message:
          'This needs a connection. Nothing was saved, and what you typed is still here — try again when you’re back online.',
      };
    case 'unknown':
      return {
        title: 'That didn’t save',
        message:
          'Something went wrong on the way. Nothing was changed, and what you typed is still here — try again in a moment.',
      };
  }
}

export type SaveMedicationResult =
  | { readonly ok: true; readonly medicationId: string }
  | { readonly ok: false; readonly problem: MedProblem };

export interface SaveMedicationInput {
  readonly circleId: string;
  readonly careRecipientId: string;
  /** `null` adds a medicine; an id changes one. */
  readonly medicationId: string | null;
  readonly values: MedValues;
}

/**
 * Save a medicine and its clock times.
 *
 * The times are reconciled rather than replaced wholesale: a row that stays is
 * left alone, so its id — and the audit trail hanging off it — survives an edit
 * that only changed the medicine's name. Rows the family removed are deleted,
 * which the trigger records as a removed time.
 */
export async function saveMedication(
  client: SupabaseClient,
  input: SaveMedicationInput,
): Promise<SaveMedicationResult> {
  const record = medRecordOf(input.values);
  const wanted = timesOf(input.values);

  if (input.medicationId === null) {
    const inserted = await client
      .from('medications')
      .insert({
        circle_id: input.circleId,
        care_recipient_id: input.careRecipientId,
        ...record,
      })
      .select('id')
      .single<{ id: string }>();

    if (inserted.error !== null || inserted.data === null) {
      return { ok: false, problem: medProblemOf(inserted.error) };
    }

    const times = await insertTimes(client, inserted.data.id, wanted);

    if (!times.ok) {
      // The medicine exists without its times. Say so rather than pretending:
      // the screen re-reads and shows a medicine with no times, which is a real
      // state a family can fix, not a silent half-save.
      return { ok: false, problem: times.problem };
    }

    return { ok: true, medicationId: inserted.data.id };
  }

  const updated = await client
    .from('medications')
    .update(record)
    .eq('id', input.medicationId)
    .select('id')
    .single<{ id: string }>();

  if (updated.error !== null) {
    return { ok: false, problem: medProblemOf(updated.error) };
  }

  const reconciled = await reconcileTimes(client, input.medicationId, wanted);

  if (!reconciled.ok) {
    return { ok: false, problem: reconciled.problem };
  }

  return { ok: true, medicationId: input.medicationId };
}

type WriteResult = { readonly ok: true } | { readonly ok: false; readonly problem: MedProblem };

async function insertTimes(
  client: SupabaseClient,
  medicationId: string,
  times: readonly string[],
): Promise<WriteResult> {
  if (times.length === 0) {
    return { ok: true };
  }

  const result = await client.from('medication_times').insert(
    times.map((time, index) => ({
      medication_id: medicationId,
      time_of_day: `${time}:00`,
      sort_order: index,
    })),
  );

  if (result.error !== null) {
    return { ok: false, problem: medProblemOf(result.error) };
  }

  return { ok: true };
}

async function reconcileTimes(
  client: SupabaseClient,
  medicationId: string,
  wanted: readonly string[],
): Promise<WriteResult> {
  const existing = await client
    .from('medication_times')
    .select('id, time_of_day')
    .eq('medication_id', medicationId)
    .returns<{ id: string; time_of_day: string }[]>();

  if (existing.error !== null) {
    return { ok: false, problem: medProblemOf(existing.error) };
  }

  const rows = existing.data ?? [];
  const wantedSet = new Set(wanted);

  const toRemove = rows.filter((row) => !wantedSet.has(normalizeClock(row.time_of_day)));
  const kept = new Set(rows.map((row) => normalizeClock(row.time_of_day)));
  const toAdd = wanted.filter((time) => !kept.has(time));

  if (toRemove.length > 0) {
    const removed = await client
      .from('medication_times')
      .delete()
      .in(
        'id',
        toRemove.map((row) => row.id),
      );

    if (removed.error !== null) {
      return { ok: false, problem: medProblemOf(removed.error) };
    }
  }

  return insertTimes(client, medicationId, toAdd);
}

/**
 * Archive a medicine. It stops appearing in the list and keeps everything.
 *
 * Never a delete: the check-offs behind it are the record of doses that were
 * actually given, and the change history is what a family uses to settle "when
 * did she stop taking that?".
 */
export async function archiveMedication(
  client: SupabaseClient,
  medicationId: string,
): Promise<WriteResult> {
  const result = await client
    .from('medications')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', medicationId);

  if (result.error !== null) {
    return { ok: false, problem: medProblemOf(result.error) };
  }

  return { ok: true };
}

export type TickResult =
  | {
      readonly ok: true;
      readonly checkOffId: string;
      readonly takenAt: string;
    }
  | { readonly ok: false; readonly problem: MedProblem };

/**
 * Tick a dose.
 *
 * The request carries the slot and nothing about who or when: `taken_by` and
 * `taken_at` are the database's, from the session and its own clock. A visiting
 * helper's tick is exactly this call, which is the one write their role has.
 */
export async function tickDose(
  client: SupabaseClient,
  input: {
    readonly circleId: string;
    readonly medicationId: string;
    readonly doseDate: string;
    readonly doseTime: string;
  },
): Promise<TickResult> {
  const result = await client
    .from('med_checkoffs')
    .insert({
      circle_id: input.circleId,
      medication_id: input.medicationId,
      dose_date: input.doseDate,
      dose_time: `${normalizeClock(input.doseTime)}:00`,
    })
    .select('id, taken_at')
    .single<{ id: string; taken_at: string }>();

  if (result.error !== null || result.data === null) {
    return { ok: false, problem: medProblemOf(result.error) };
  }

  return { ok: true, checkOffId: result.data.id, takenAt: result.data.taken_at };
}

/**
 * Undo a tick — a delete, because a check-off has no update path.
 *
 * The database allows this only for the tick's own author (or a role that may
 * manage the circle), so the delete is the permission check as well as the undo.
 */
export async function untickDose(
  client: SupabaseClient,
  checkOffId: string,
): Promise<WriteResult> {
  const result = await client.from('med_checkoffs').delete().eq('id', checkOffId);

  if (result.error !== null) {
    return { ok: false, problem: medProblemOf(result.error) };
  }

  return { ok: true };
}

interface HistoryRow {
  readonly occurred_at: string;
  readonly event: string | null;
  readonly action: string;
  readonly table_name: string;
  readonly medication_id: string | null;
  readonly fields: readonly string[] | null;
  readonly actor_name: string | null;
  readonly dose_time: string | null;
}

/**
 * The change history, from the one function that serves it.
 *
 * A visiting helper is refused by `medication_history()` itself, so this returns
 * `null` for them — the same answer as a failed read, which the sheet shows as
 * "we couldn't read this" rather than an empty list. The screen does not offer
 * the sheet to a helper at all; the database is the boundary, this is the polite
 * version of it.
 */
export async function loadMedicationHistory(
  client: SupabaseClient,
  circleId: string,
  medicationId: string | null,
): Promise<readonly MedicationHistoryEntry[] | null> {
  const result = await client.rpc('medication_history', {
    p_circle_id: circleId,
    p_medication_id: medicationId,
    p_limit: 50,
  });

  if (result.error !== null) {
    return null;
  }

  const rows = (result.data ?? []) as HistoryRow[];

  return rows.map((row) => ({
    occurredAt: row.occurred_at,
    event: row.event ?? row.action,
    action: row.action as MedicationHistoryEntry['action'],
    tableName: row.table_name,
    medicationId: row.medication_id,
    fields: row.fields ?? [],
    actorName: row.actor_name,
    doseTime: row.dose_time ?? null,
  }));
}
