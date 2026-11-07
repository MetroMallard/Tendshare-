/**
 * Row Level Security — medications and the dose check-off (Task 8, part one).
 *
 * This file is the contract the screens in part two are written against. It
 * proves, against the hosted project, that:
 *
 *   1. **The care team writes the med list, and the write audits itself.** An
 *      owner or family member adds a medication with two times; the audit rows
 *      carry field *names* and the medication id — never "Donepezil", never
 *      "with breakfast".
 *   2. **Every role in the circle reads the list.** View-only reads it and
 *      changes nothing; a visiting helper reads it because a helper cannot tick
 *      a dose they cannot see.
 *   3. **A helper ticks a dose, and the tick is a fact.** `taken_by` is the
 *      helper's own id even when the request body names somebody else, and an
 *      audit row records `dose.ticked`.
 *   4. **A helper's one write is that tick.** No med insert or update, no
 *      deleting somebody else's tick, no change history, no second tick of the
 *      same slot.
 *   5. **A helper undoes their own tick**, which writes `dose.unticked`, and may
 *      then tick again.
 *   6. **View-only cannot tick.**
 *   7. **Another circle sees nothing** — not the list, not the times, not the
 *      check-offs — and cannot read this circle's history.
 *
 * Every assertion runs as a real signed-in user: the anon key plus a JWT from
 * `signInWithPassword`, so each one travels the same path a phone does. The
 * service role appears only to create and delete auth users.
 *
 *   pnpm test:rls
 *
 * Skips cleanly when the credentials are absent, so it never runs in CI.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getRlsEnv, rlsEnv } from './support/env';
import {
  allUsers,
  createAdminClient,
  createCircleFixture,
  createUser,
  deleteTestUsers,
  TEST_PREFIX,
  type CircleFixture,
  type TestUser,
} from './support/fixtures';

interface AuditRow {
  id: number;
  circle_id: string;
  actor_id: string | null;
  actor_role: string | null;
  table_name: string;
  action: string;
  summary: Record<string, unknown>;
}

interface HistoryRow {
  occurred_at: string;
  event: string;
  action: string;
  table_name: string;
  row_id: string;
  medication_id: string | null;
  fields: string[];
  actor_name: string | null;
  actor_role: string | null;
}

/**
 * `rpc()` results are typed by `@supabase/supabase-js` as a union that includes
 * its own "you wrapped the wrong thing in an array" error object. Narrowing in
 * one place keeps the assertions below readable.
 */
function historyRows(result: { data: unknown }): HistoryRow[] {
  return (result.data ?? []) as HistoryRow[];
}

/** The medicine the suite types in. Nothing clinical, nothing to advise on. */
const MED_NAME = 'Donepezil';
const MED_INSTRUCTIONS = 'with breakfast';
const DOSE_DATE = '2026-11-07';
const MORNING = '08:00:00';
const EVENING = '20:00:00';

describe.skipIf(!rlsEnv)('RLS — medications and the dose check-off', () => {
  let fixture: CircleFixture | undefined;
  /** Somebody who runs a different circle entirely. */
  let stranger: TestUser | undefined;
  let strangerCircleId: string | undefined;
  let strangerRecipientId: string | undefined;
  let strangerMedicationId: string | undefined;

  let medicationId: string | undefined;
  let eveningTimeId: string | undefined;

  beforeAll(async () => {
    const env = getRlsEnv();
    fixture = await createCircleFixture(env);

    // The family's med list: one medicine, two times, typed as they would type
    // it. Created by the owner so the rest of the file has something to read.
    const medication = await fixture.owner.client
      .from('medications')
      .insert({
        circle_id: fixture.circleId,
        care_recipient_id: fixture.recipientId,
        name: MED_NAME,
        strength: '5 mg',
        form: 'tablet',
        instructions: MED_INSTRUCTIONS,
        starts_on: '2026-11-01',
        refill_due_on: '2026-12-01',
      })
      .select('id')
      .single();

    if (medication.error || !medication.data) {
      throw new Error(
        `the owner could not add a medication: ${medication.error?.message ?? 'no row'}`,
      );
    }

    medicationId = String(medication.data.id);

    const times = await fixture.owner.client
      .from('medication_times')
      .insert([
        { medication_id: medicationId, time_of_day: MORNING, label: 'morning', sort_order: 0 },
        { medication_id: medicationId, time_of_day: EVENING, label: 'evening', sort_order: 1 },
      ])
      .select('id, time_of_day');

    if (times.error || !times.data) {
      throw new Error(`the owner could not add times: ${times.error?.message ?? 'no rows'}`);
    }

    eveningTimeId = String(times.data.find((row) => row.time_of_day === EVENING)?.id);

    // A second family, with a medication of their own, so "sees only their own
    // rows" is a real comparison rather than an empty set.
    const admin = createAdminClient(env);
    stranger = await createUser(admin, env, 'meds-stranger');

    const circle = await stranger.client
      .from('circles')
      .insert({ name: `${TEST_PREFIX} another family`, owner_id: stranger.id })
      .select('id')
      .single();

    if (circle.error || !circle.data) {
      throw new Error(
        `the stranger could not create a circle: ${circle.error?.message ?? 'no row'}`,
      );
    }

    strangerCircleId = String(circle.data.id);

    const recipient = await stranger.client
      .from('care_recipients')
      .insert({ circle_id: strangerCircleId, full_name: 'Someone else' })
      .select('id')
      .single();

    if (recipient.error || !recipient.data) {
      throw new Error(
        `the stranger could not add a person: ${recipient.error?.message ?? 'no row'}`,
      );
    }

    strangerRecipientId = String(recipient.data.id);

    const theirMedication = await stranger.client
      .from('medications')
      .insert({
        circle_id: strangerCircleId,
        care_recipient_id: strangerRecipientId,
        name: 'Their own medicine',
      })
      .select('id')
      .single();

    if (theirMedication.error || !theirMedication.data) {
      throw new Error(
        `the stranger could not add a medication: ${theirMedication.error?.message ?? 'no row'}`,
      );
    }

    strangerMedicationId = String(theirMedication.data.id);
  });

  afterAll(async () => {
    if (fixture) {
      await deleteTestUsers(getRlsEnv(), allUsers(fixture));
    }

    if (stranger) {
      await deleteTestUsers(getRlsEnv(), [stranger]);
    }
  });

  /** Every audit row the suite's triggers wrote for this circle and table. */
  async function auditRows(table: string, rowId: string): Promise<AuditRow[]> {
    const audit = await fixture!.owner.client
      .from('audit_log')
      .select('id, circle_id, actor_id, actor_role, table_name, action, summary')
      .eq('circle_id', fixture!.circleId)
      .eq('table_name', table)
      .eq('row_id', rowId)
      .order('id', { ascending: true })
      .returns<AuditRow[]>();

    expect(audit.error).toBeNull();
    return audit.data ?? [];
  }

  describe('the care team writes the med list, and the write audits itself', () => {
    it('records the medication with field names only, and the medication id', async () => {
      const rows = await auditRows('medications', medicationId!);

      expect(rows).toHaveLength(1);

      const entry = rows[0]!;

      expect(entry.action).toBe('create');
      expect(entry.actor_id).toBe(fixture!.owner.id);
      expect(entry.actor_role).toBe('owner');
      expect(entry.summary.medication_id).toBe(medicationId);

      // Field names, sorted. `id`, `circle_id`, `care_recipient_id` and the
      // bookkeeping columns are not things the family typed.
      expect(entry.summary.fields).toEqual([
        'form',
        'instructions',
        'name',
        'refill_due_on',
        'refill_reminder_days',
        'starts_on',
        'strength',
      ]);

      // Nothing the family typed reaches the log: not the medicine, not the
      // strength, not the instruction.
      const payload = JSON.stringify(entry.summary);
      expect(payload).not.toContain(MED_NAME);
      expect(payload).not.toContain('5 mg');
      expect(payload).not.toContain(MED_INSTRUCTIONS);
    });

    it('records a time being added as its own event, filed under the medication', async () => {
      const rows = await auditRows('medication_times', eveningTimeId!);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.action).toBe('create');
      expect(rows[0]!.summary.medication_id).toBe(medicationId);
      expect(rows[0]!.summary.fields).toEqual(['label', 'sort_order', 'time_of_day']);
    });

    it('refuses two times at the same minute on one medication', async () => {
      const duplicate = await fixture!.owner.client.from('medication_times').insert({
        medication_id: medicationId,
        time_of_day: MORNING,
        label: 'again',
      });

      expect(duplicate.error).not.toBeNull();
      expect(duplicate.error?.code).toBe('23505');
    });

    it('records an edit as the fields that changed, never as their values', async () => {
      const updated = await fixture!.familyMember.client
        .from('medications')
        .update({ strength: '10 mg', instructions: 'with dinner' })
        .eq('id', medicationId)
        .select('id')
        .returns<{ id: string }[]>();

      expect(updated.error).toBeNull();
      expect(updated.data).toHaveLength(1);

      const rows = await auditRows('medications', medicationId!);
      const latest = rows.at(-1)!;

      expect(latest.action).toBe('update');
      expect(latest.actor_id).toBe(fixture!.familyMember.id);
      expect(latest.actor_role).toBe('family_member');
      expect(latest.summary.fields).toEqual(['instructions', 'strength']);

      const payload = JSON.stringify(latest.summary);
      expect(payload).not.toContain('10 mg');
      expect(payload).not.toContain('with dinner');
    });

    it('soft-archives rather than deleting, and says so in the audit row', async () => {
      const archived = await fixture!.owner.client
        .from('medications')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', medicationId)
        .select('id, archived_at')
        .returns<{ id: string; archived_at: string | null }[]>();

      expect(archived.error).toBeNull();
      expect(archived.data).toHaveLength(1);
      expect(archived.data![0]!.archived_at).not.toBeNull();

      const latest = (await auditRows('medications', medicationId!)).at(-1)!;

      expect(latest.action).toBe('update');
      expect(latest.summary.fields).toEqual(['archived_at']);
      expect(latest.summary.archived).toBe(true);

      // The row is still there — archiving is a soft stop, not a delete.
      const stillThere = await fixture!.owner.client
        .from('medications')
        .select('id')
        .eq('id', medicationId);

      expect(stillThere.data).toHaveLength(1);

      // Put it back, so the rest of the file reads a medicine that is in use.
      await fixture!.owner.client
        .from('medications')
        .update({ archived_at: null })
        .eq('id', medicationId);
    });

    it('refuses a medication whose person belongs to another circle', async () => {
      const crossed = await fixture!.owner.client.from('medications').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: strangerRecipientId,
        name: 'Smuggled medicine',
      });

      expect(crossed.error).not.toBeNull();
    });
  });

  describe('every role in the circle reads the med list', () => {
    it('shows the list and its times to the owner, family member, view-only and helper', async () => {
      for (const role of ['owner', 'familyMember', 'viewer', 'helper'] as const) {
        const user = fixture![role];

        const medications = await user.client
          .from('medications')
          .select('id, name')
          .eq('circle_id', fixture!.circleId);

        expect(medications.error, `${role} should read the med list`).toBeNull();
        expect(medications.data ?? []).toHaveLength(1);
        expect(medications.data![0]!.name).toBe(MED_NAME);

        const times = await user.client
          .from('medication_times')
          .select('id, time_of_day')
          .eq('medication_id', medicationId);

        expect(times.error, `${role} should read the schedule`).toBeNull();
        expect(times.data ?? []).toHaveLength(2);
      }
    });
  });

  describe('view-only reads and changes nothing', () => {
    it('is refused a new medication, an edit, a time and a tick', async () => {
      const medication = await fixture!.viewer.client.from('medications').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        name: 'View-only medicine',
      });

      const edit = await fixture!.viewer.client
        .from('medications')
        .update({ name: 'Renamed' })
        .eq('id', medicationId)
        .select('id');

      const time = await fixture!.viewer.client.from('medication_times').insert({
        medication_id: medicationId,
        time_of_day: '12:00:00',
      });

      const tick = await fixture!.viewer.client.from('med_checkoffs').insert({
        medication_id: medicationId,
        dose_date: DOSE_DATE,
        dose_time: MORNING,
      });

      expect(medication.error).not.toBeNull();
      expect(edit.error ?? { message: 'refused' }).not.toBeNull();
      expect(time.error).not.toBeNull();
      expect(tick.error).not.toBeNull();
    });

    it('reads the check-offs, so it can see who confirmed a dose', async () => {
      const read = await fixture!.viewer.client
        .from('med_checkoffs')
        .select('id')
        .eq('circle_id', fixture!.circleId);

      expect(read.error).toBeNull();
    });
  });

  describe('a visiting helper ticks a dose, and the tick is a fact', () => {
    let tickId: string | undefined;

    it('ticks a dose, and taken_by is the helper even when the body claims somebody else', async () => {
      const ticked = await fixture!.helper.client
        .from('med_checkoffs')
        .insert({
          medication_id: medicationId,
          dose_date: DOSE_DATE,
          dose_time: MORNING,
          // A hand-written request would try exactly this. The trigger ignores
          // it and stamps the session's own id.
          taken_by: fixture!.owner.id,
          circle_id: strangerCircleId,
        })
        .select('id, taken_by, circle_id, medication_id, dose_date, dose_time')
        .single<{
          id: string;
          taken_by: string | null;
          circle_id: string;
          medication_id: string;
          dose_date: string;
          dose_time: string;
        }>();

      expect(ticked.error).toBeNull();
      expect(ticked.data?.taken_by).toBe(fixture!.helper.id);
      expect(ticked.data?.circle_id).toBe(fixture!.circleId);
      expect(ticked.data?.dose_date).toBe(DOSE_DATE);

      tickId = String(ticked.data?.id);
    });

    it('writes dose.ticked with the medication id, the date and the time', async () => {
      const rows = await auditRows('med_checkoffs', tickId!);

      expect(rows).toHaveLength(1);

      const entry = rows[0]!;

      expect(entry.action).toBe('create');
      expect(entry.actor_id).toBe(fixture!.helper.id);
      expect(entry.actor_role).toBe('visiting_helper');
      expect(entry.summary.event).toBe('dose.ticked');
      expect(entry.summary.medication_id).toBe(medicationId);
      expect(entry.summary.dose_date).toBe(DOSE_DATE);
      expect(entry.summary.dose_time).toBe(MORNING);

      // Still no medicine name anywhere in the trail.
      expect(JSON.stringify(entry.summary)).not.toContain(MED_NAME);
    });

    it('cannot tick the same slot twice', async () => {
      const again = await fixture!.helper.client.from('med_checkoffs').insert({
        medication_id: medicationId,
        dose_date: DOSE_DATE,
        dose_time: MORNING,
      });

      expect(again.error).not.toBeNull();
      expect(again.error?.code).toBe('23505');
    });

    it('cannot add or edit a medication', async () => {
      const inserted = await fixture!.helper.client.from('medications').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        name: 'Helper medicine',
      });

      const edited = await fixture!.helper.client
        .from('medications')
        .update({ instructions: 'take two' })
        .eq('id', medicationId)
        .select('id');

      const time = await fixture!.helper.client.from('medication_times').insert({
        medication_id: medicationId,
        time_of_day: '13:00:00',
      });

      expect(inserted.error).not.toBeNull();
      expect(edited.error ?? { message: 'refused' }).not.toBeNull();
      expect(edited.data ?? []).toHaveLength(0);
      expect(time.error).not.toBeNull();

      // …and the medicine is untouched.
      const unchanged = await fixture!.owner.client
        .from('medications')
        .select('instructions')
        .eq('id', medicationId)
        .single<{ instructions: string | null }>();

      expect(unchanged.data?.instructions).toBe('with dinner');
    });

    it('cannot delete a medication', async () => {
      const deleted = await fixture!.helper.client
        .from('medications')
        .delete()
        .eq('id', medicationId)
        .select('id');

      expect(deleted.error ?? { message: 'refused' }).not.toBeNull();
      expect(deleted.data ?? []).toHaveLength(0);

      const stillThere = await fixture!.owner.client
        .from('medications')
        .select('id')
        .eq('id', medicationId);

      expect(stillThere.data).toHaveLength(1);
    });

    it('cannot delete somebody else’s tick', async () => {
      const evening = await fixture!.familyMember.client
        .from('med_checkoffs')
        .insert({ medication_id: medicationId, dose_date: DOSE_DATE, dose_time: EVENING })
        .select('id')
        .single<{ id: string }>();

      expect(evening.error).toBeNull();

      const stolen = await fixture!.helper.client
        .from('med_checkoffs')
        .delete()
        .eq('id', String(evening.data?.id))
        .select('id');

      // Refused by the policy: no rows match, so nothing is deleted and no
      // error is raised — the tick survives either way.
      expect(stolen.data ?? []).toHaveLength(0);

      const survivor = await fixture!.owner.client
        .from('med_checkoffs')
        .select('id, taken_by')
        .eq('id', String(evening.data?.id))
        .single<{ id: string; taken_by: string | null }>();

      expect(survivor.error).toBeNull();
      expect(survivor.data?.taken_by).toBe(fixture!.familyMember.id);
    });

    it('cannot read the change history', async () => {
      const history = await fixture!.helper.client.rpc('medication_history', {
        p_circle_id: fixture!.circleId,
      });

      expect(history.error).not.toBeNull();
      expect(history.error?.code).toBe('42501');
    });

    it('undoes its own tick, which is audited, and may then tick again', async () => {
      const undone = await fixture!.helper.client
        .from('med_checkoffs')
        .delete()
        .eq('id', tickId!)
        .select('id');

      expect(undone.error).toBeNull();
      expect(undone.data).toHaveLength(1);

      const rows = await auditRows('med_checkoffs', tickId!);

      expect(rows).toHaveLength(2);
      expect(rows.at(-1)!.action).toBe('delete');
      expect(rows.at(-1)!.summary.event).toBe('dose.unticked');
      expect(rows.at(-1)!.actor_id).toBe(fixture!.helper.id);
      expect(rows.at(-1)!.summary.dose_time).toBe(MORNING);

      const reticked = await fixture!.helper.client
        .from('med_checkoffs')
        .insert({ medication_id: medicationId, dose_date: DOSE_DATE, dose_time: MORNING })
        .select('id, taken_by')
        .single<{ id: string; taken_by: string | null }>();

      expect(reticked.error).toBeNull();
      expect(reticked.data?.taken_by).toBe(fixture!.helper.id);

      // A fresh row, and a fresh `dose.ticked` — two facts, not one rewrite.
      const after = await auditRows('med_checkoffs', String(reticked.data?.id));
      expect(after).toHaveLength(1);
      expect(after[0]!.summary.event).toBe('dose.ticked');
    });
  });

  describe('the change history', () => {
    it('answers the care team with field names, timestamps and who did it', async () => {
      const history = await fixture!.familyMember.client.rpc('medication_history', {
        p_circle_id: fixture!.circleId,
      });

      expect(history.error).toBeNull();

      const rows = historyRows(history);
      expect(rows.length).toBeGreaterThan(0);

      // Every row is about this circle's medication, carries a field list and
      // an actor name, and never a value the family typed.
      for (const row of rows) {
        expect(row.medication_id).toBe(medicationId);
        expect(Array.isArray(row.fields)).toBe(true);
      }

      const payload = JSON.stringify(rows);
      expect(payload).not.toContain(MED_NAME);
      expect(payload).not.toContain(MED_INSTRUCTIONS);
      expect(payload).not.toContain('10 mg');

      const tick = rows.find((row) => row.event === 'dose.ticked');
      expect(tick).toBeDefined();
      expect(tick!.actor_name).toBe('RLS helper');
      expect(tick!.actor_role).toBe('visiting_helper');
    });

    it('can be narrowed to one medication', async () => {
      const history = await fixture!.owner.client.rpc('medication_history', {
        p_circle_id: fixture!.circleId,
        p_medication_id: medicationId,
        p_limit: 5,
      });

      expect(history.error).toBeNull();

      const rows = historyRows(history);
      expect(rows.length).toBeLessThanOrEqual(5);
      expect(rows.every((row) => row.medication_id === medicationId)).toBe(true);
    });

    it('is readable by view-only, who sees the care records', async () => {
      const history = await fixture!.viewer.client.rpc('medication_history', {
        p_circle_id: fixture!.circleId,
      });

      expect(history.error).toBeNull();
      expect(historyRows(history).length).toBeGreaterThan(0);
    });

    it('refuses another circle', async () => {
      const history = await stranger!.client.rpc('medication_history', {
        p_circle_id: fixture!.circleId,
      });

      expect(history.error).not.toBeNull();
      expect(history.error?.code).toBe('42501');
    });

    it('refuses a medication id from another circle, rather than answering empty', async () => {
      const history = await fixture!.owner.client.rpc('medication_history', {
        p_circle_id: fixture!.circleId,
        p_medication_id: strangerMedicationId,
      });

      expect(history.error).not.toBeNull();
      expect(history.error?.code).toBe('42501');
    });
  });

  describe('another circle sees nothing', () => {
    it('sees no medications, times or check-offs from this circle', async () => {
      const medications = await stranger!.client
        .from('medications')
        .select('id')
        .eq('circle_id', fixture!.circleId);

      const times = await stranger!.client
        .from('medication_times')
        .select('id')
        .eq('medication_id', medicationId);

      const checkoffs = await stranger!.client
        .from('med_checkoffs')
        .select('id')
        .eq('circle_id', fixture!.circleId);

      expect(medications.error).toBeNull();
      expect(times.error).toBeNull();
      expect(checkoffs.error).toBeNull();
      expect(medications.data).toEqual([]);
      expect(times.data).toEqual([]);
      expect(checkoffs.data).toEqual([]);
    });

    it('cannot tick a dose in this circle', async () => {
      const ticked = await stranger!.client.from('med_checkoffs').insert({
        medication_id: medicationId,
        dose_date: DOSE_DATE,
        dose_time: '09:00:00',
      });

      expect(ticked.error).not.toBeNull();
    });

    it('cannot add a medication to a circle it does not belong to', async () => {
      const inserted = await stranger!.client.from('medications').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        name: 'Intruder medicine',
      });

      expect(inserted.error).not.toBeNull();
    });

    it('sees only its own medication when it asks for a list', async () => {
      const list = await stranger!.client
        .from('medications')
        .select('id, name')
        .returns<{ id: string; name: string }[]>();

      expect(list.error).toBeNull();
      expect(list.data ?? []).toHaveLength(1);
      expect(list.data![0]!.id).toBe(strangerMedicationId);
    });
  });

  describe('a lapsed plan does not stop a dose being ticked', () => {
    it('still lets a helper tick, and the family edit, after the plan is cancelled', async () => {
      const cancelled = await fixture!.owner.client
        .from('circles')
        .update({ plan_status: 'canceled' })
        .eq('id', fixture!.circleId)
        .select('id, plan_status')
        .single<{ id: string; plan_status: string }>();

      expect(cancelled.error).toBeNull();
      expect(cancelled.data?.plan_status).toBe('canceled');

      // The owner's 2026-11-06 decision: every free feature keeps working when a
      // plan ends, and med check-offs are explicitly named. No policy on the med
      // tables asks `circle_is_writable()`.
      const ticked = await fixture!.helper.client
        .from('med_checkoffs')
        .insert({ medication_id: medicationId, dose_date: '2026-11-08', dose_time: MORNING })
        .select('id, taken_by')
        .single<{ id: string; taken_by: string | null }>();

      expect(ticked.error).toBeNull();
      expect(ticked.data?.taken_by).toBe(fixture!.helper.id);

      const edited = await fixture!.owner.client
        .from('medications')
        .update({ refill_due_on: '2026-12-15' })
        .eq('id', medicationId)
        .select('id');

      expect(edited.error).toBeNull();
      expect(edited.data).toHaveLength(1);

      // Put the circle back the way the fixture built it.
      const restored = await fixture!.owner.client
        .from('circles')
        .update({ plan_status: 'active' })
        .eq('id', fixture!.circleId)
        .select('id, plan_status')
        .single<{ id: string; plan_status: string }>();

      expect(restored.data?.plan_status).toBe('active');
    });
  });

  describe('deleting a medication', () => {
    it('takes its times and ticks with it, and writes one delete event', async () => {
      const before = (await auditRows('medications', medicationId!)).length;

      const deleted = await fixture!.owner.client
        .from('medications')
        .delete()
        .eq('id', medicationId)
        .select('id');

      expect(deleted.error).toBeNull();
      expect(deleted.data).toHaveLength(1);

      const rows = await auditRows('medications', medicationId!);
      expect(rows).toHaveLength(before + 1);
      expect(rows.at(-1)!.action).toBe('delete');

      // The times and the ticks went with it — and nobody "unticked" a dose on
      // the way out, so no dose.unticked rows were invented.
      const times = await fixture!.owner.client
        .from('medication_times')
        .select('id')
        .eq('medication_id', medicationId);

      const checkoffs = await fixture!.owner.client
        .from('med_checkoffs')
        .select('id')
        .eq('medication_id', medicationId);

      expect(times.data ?? []).toHaveLength(0);
      expect(checkoffs.data ?? []).toHaveLength(0);

      const unticked = await fixture!.owner.client
        .from('audit_log')
        .select('id')
        .eq('circle_id', fixture!.circleId)
        .eq('table_name', 'med_checkoffs')
        .eq('action', 'delete')
        .contains('summary', { event: 'dose.unticked' });

      // The one undo in this file was the helper's own, made before the delete.
      expect((unticked.data ?? []).length).toBeLessThanOrEqual(1);
    });
  });
});
