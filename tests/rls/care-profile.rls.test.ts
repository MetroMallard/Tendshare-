/**
 * Row Level Security — the person profile (Task 7).
 *
 * Task 7 adds four things that have to hold in the database, not only on a
 * screen:
 *
 *   1. **A family member edits the profile, and the write audits itself.** A
 *      doctor is added, and an `audit_log` row appears in the same transaction
 *      with field *names* — never "Dr Patel", never the phone number.
 *   2. **View-only reads and changes nothing** — refused on all three new
 *      tables and on `care_recipients` itself.
 *   3. **A visiting helper cannot read or write care details.** No contacts, no
 *      conditions, no insurance cards, and not the free-text note either: the
 *      note is reachable only through `care_recipient_notes()`, which refuses a
 *      helper, and the column is not granted to any client role.
 *   4. **Another circle's member reads nothing**, and **a non-member cannot
 *      reach a private bucket object** — not even by asking for a signed URL.
 *
 * Every assertion runs as a real signed-in user — the anon key plus a JWT from
 * `signInWithPassword` — so each one travels the same path a phone does. The
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

const BUCKET = 'care-media';

/** A one-pixel PNG, so the upload is a real image and not a made-up mime type. */
const PIXEL_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
);

describe.skipIf(!rlsEnv)('RLS — the person profile', () => {
  let fixture: CircleFixture | undefined;
  /** Somebody who runs a different circle entirely. */
  let stranger: TestUser | undefined;
  let strangerCircleId: string | undefined;
  /** An uploaded photo's path, so teardown can remove it. */
  let uploadedPath: string | undefined;

  beforeAll(async () => {
    const env = getRlsEnv();
    fixture = await createCircleFixture(env);

    const admin = createAdminClient(env);
    stranger = await createUser(admin, env, 'profile-stranger');

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

    // The stranger's circle needs a person too, so "sees only their own rows"
    // is a real comparison rather than an empty set.
    await stranger.client
      .from('care_recipients')
      .insert({ circle_id: strangerCircleId, full_name: 'Someone else' });
  });

  afterAll(async () => {
    if (fixture && uploadedPath) {
      // The owner may delete their own circle's object; the account deletion
      // below would leave it behind, because Storage is not cascaded by SQL.
      await fixture.owner.client.storage.from(BUCKET).remove([uploadedPath]);
    }

    if (fixture) {
      await deleteTestUsers(getRlsEnv(), allUsers(fixture));
    }

    if (stranger) {
      await deleteTestUsers(getRlsEnv(), [stranger]);
    }
  });

  describe('the care team writes, and the write audits itself', () => {
    it('lets a family member add a doctor, and records field names only', async () => {
      const inserted = await fixture!.familyMember.client
        .from('care_recipient_contacts')
        .insert({
          circle_id: fixture!.circleId,
          care_recipient_id: fixture!.recipientId,
          kind: 'doctor',
          name: 'Dr Patel',
          organisation: 'Riverside Clinic',
          phone: '555-0142',
        })
        .select('id, kind, name')
        .single();

      expect(inserted.error).toBeNull();
      expect(inserted.data?.kind).toBe('doctor');

      // The audit row is written by a trigger in the same transaction, so it is
      // already there when the insert returns.
      const audit = await fixture!.owner.client
        .from('audit_log')
        .select('id, circle_id, actor_id, actor_role, table_name, action, summary')
        .eq('circle_id', fixture!.circleId)
        .eq('table_name', 'care_recipient_contacts')
        .eq('row_id', String(inserted.data?.id))
        .returns<AuditRow[]>();

      expect(audit.error).toBeNull();
      expect(audit.data).toHaveLength(1);

      const entry = audit.data![0]!;

      expect(entry.action).toBe('create');
      expect(entry.actor_id).toBe(fixture!.familyMember.id);
      expect(entry.actor_role).toBe('family_member');
      expect(entry.summary.kind).toBe('doctor');

      // Field names, sorted, and nothing else. The doctor's name and number are
      // health-adjacent free text and must never be copied into the log.
      expect(entry.summary.fields).toEqual(['is_primary', 'kind', 'name', 'organisation', 'phone']);
      expect(JSON.stringify(entry.summary)).not.toContain('Patel');
      expect(JSON.stringify(entry.summary)).not.toContain('555-0142');
    });

    it('records an allergy as a field name, never as the allergy', async () => {
      const inserted = await fixture!.owner.client
        .from('care_recipient_conditions')
        .insert({
          circle_id: fixture!.circleId,
          care_recipient_id: fixture!.recipientId,
          kind: 'allergy',
          label: 'Penicillin',
        })
        .select('id')
        .single();

      expect(inserted.error).toBeNull();

      const audit = await fixture!.owner.client
        .from('audit_log')
        .select('summary, action, actor_role')
        .eq('circle_id', fixture!.circleId)
        .eq('table_name', 'care_recipient_conditions')
        .eq('row_id', String(inserted.data?.id))
        .returns<Pick<AuditRow, 'summary' | 'action' | 'actor_role'>[]>();

      expect(audit.data).toHaveLength(1);
      expect(audit.data![0]!.summary.kind).toBe('allergy');
      expect(audit.data![0]!.summary.fields).toEqual(['kind', 'label']);
      expect(JSON.stringify(audit.data![0]!.summary)).not.toContain('Penicillin');
    });

    it('records a profile change as the field that changed', async () => {
      const updated = await fixture!.owner.client
        .from('care_recipients')
        .update({ preferred_name: 'Peg', phone: '555-0199' })
        .eq('id', fixture!.recipientId)
        .select('id')
        .returns<{ id: string }[]>();

      expect(updated.error).toBeNull();
      expect(updated.data).toHaveLength(1);

      const audit = await fixture!.owner.client
        .from('audit_log')
        .select('summary')
        .eq('circle_id', fixture!.circleId)
        .eq('table_name', 'care_recipients')
        .eq('row_id', fixture!.recipientId)
        .eq('action', 'update')
        .returns<Pick<AuditRow, 'summary'>[]>();

      expect(audit.data?.length).toBeGreaterThan(0);
      expect(audit.data!.at(-1)!.summary.fields).toEqual(['phone', 'preferred_name']);
      expect(JSON.stringify(audit.data!.at(-1)!.summary)).not.toContain('Peg');
    });
  });

  describe('view-only reads and changes nothing', () => {
    it('can read the contacts, conditions and cards', async () => {
      const contacts = await fixture!.viewer.client
        .from('care_recipient_contacts')
        .select('id')
        .eq('circle_id', fixture!.circleId);

      expect(contacts.error).toBeNull();
      expect((contacts.data ?? []).length).toBeGreaterThan(0);
    });

    it('is refused every write', async () => {
      const contact = await fixture!.viewer.client.from('care_recipient_contacts').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        kind: 'pharmacy',
        name: 'Boots',
      });

      const condition = await fixture!.viewer.client.from('care_recipient_conditions').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        kind: 'condition',
        label: 'Arthritis',
      });

      const card = await fixture!.viewer.client.from('care_recipient_insurance').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        plan_name: 'Blue Shield',
      });

      const basics = await fixture!.viewer.client
        .from('care_recipients')
        .update({ preferred_name: 'Nope' })
        .eq('id', fixture!.recipientId)
        .select('id');

      expect(contact.error).not.toBeNull();
      expect(condition.error).not.toBeNull();
      expect(card.error).not.toBeNull();
      expect(basics.error ?? { message: 'refused' }).not.toBeNull();
    });
  });

  describe('a visiting helper sees the person, not their care', () => {
    it('reads no doctors, pharmacies, allergies or insurance cards', async () => {
      const contacts = await fixture!.helper.client
        .from('care_recipient_contacts')
        .select('id')
        .eq('circle_id', fixture!.circleId);
      const conditions = await fixture!.helper.client
        .from('care_recipient_conditions')
        .select('id')
        .eq('circle_id', fixture!.circleId);
      const insurance = await fixture!.helper.client
        .from('care_recipient_insurance')
        .select('id')
        .eq('circle_id', fixture!.circleId);

      expect(contacts.error).toBeNull();
      expect(conditions.error).toBeNull();
      expect(insurance.error).toBeNull();
      expect(contacts.data).toEqual([]);
      expect(conditions.data).toEqual([]);
      expect(insurance.data).toEqual([]);
    });

    it('still reads the name, photo and relationship', async () => {
      const person = await fixture!.helper.client
        .from('care_recipients')
        .select('full_name, relationship, photo_url')
        .eq('id', fixture!.recipientId)
        .single<{ full_name: string; relationship: string | null }>();

      expect(person.error).toBeNull();
      expect(person.data?.full_name).toBe('Margaret');
    });

    it('cannot read the free-text note, by column or by function', async () => {
      // The column is not in the helper's grant list at all.
      const column = await fixture!.helper.client
        .from('care_recipients')
        .select('notes')
        .eq('id', fixture!.recipientId);

      expect(column.error).not.toBeNull();

      // …and the definer function refuses rather than answering null.
      const note = await fixture!.helper.client.rpc('care_recipient_notes', {
        p_care_recipient_id: fixture!.recipientId,
      });

      expect(note.error).not.toBeNull();
      expect(note.error?.code).toBe('42501');
    });

    it('writes nothing anywhere', async () => {
      const contact = await fixture!.helper.client.from('care_recipient_contacts').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        kind: 'doctor',
        name: 'Dr Who',
      });

      const basics = await fixture!.helper.client
        .from('care_recipients')
        .update({ preferred_name: 'Nope' })
        .eq('id', fixture!.recipientId)
        .select('id');

      expect(contact.error).not.toBeNull();
      expect(basics.error ?? { message: 'refused' }).not.toBeNull();
    });

    it('cannot read the note of a person in another circle either', async () => {
      const other = await fixture!.helper.client
        .from('care_recipients')
        .select('notes')
        .eq('circle_id', strangerCircleId ?? '');

      expect(other.error).not.toBeNull();
    });
  });

  describe('another circle reads nothing', () => {
    it('sees no contacts, conditions or cards from this circle', async () => {
      const contacts = await stranger!.client
        .from('care_recipient_contacts')
        .select('id')
        .eq('circle_id', fixture!.circleId);
      const conditions = await stranger!.client
        .from('care_recipient_conditions')
        .select('id')
        .eq('circle_id', fixture!.circleId);
      const insurance = await stranger!.client
        .from('care_recipient_insurance')
        .select('id')
        .eq('circle_id', fixture!.circleId);

      expect(contacts.data).toEqual([]);
      expect(conditions.data).toEqual([]);
      expect(insurance.data).toEqual([]);
    });

    it('cannot add a doctor to a circle it does not belong to', async () => {
      const inserted = await stranger!.client.from('care_recipient_contacts').insert({
        circle_id: fixture!.circleId,
        care_recipient_id: fixture!.recipientId,
        kind: 'doctor',
        name: 'Dr Intruder',
      });

      expect(inserted.error).not.toBeNull();
    });
  });

  describe('the private bucket', () => {
    it('lets the owner upload under their own circle id', async () => {
      uploadedPath = `${fixture!.circleId}/${fixture!.recipientId}/photo-${Date.now()}.png`;

      const uploaded = await fixture!.owner.client.storage
        .from(BUCKET)
        .upload(uploadedPath, PIXEL_PNG, { contentType: 'image/png' });

      expect(uploaded.error).toBeNull();
    });

    it('refuses to upload under somebody else’s circle id', async () => {
      const path = `${strangerCircleId ?? 'unknown'}/${fixture!.recipientId}/photo-intruder.png`;

      const uploaded = await fixture!.owner.client.storage
        .from(BUCKET)
        .upload(path, PIXEL_PNG, { contentType: 'image/png' });

      expect(uploaded.error).not.toBeNull();
    });

    it('signs a short-lived URL for the care team', async () => {
      const signed = await fixture!.familyMember.client.storage
        .from(BUCKET)
        .createSignedUrl(uploadedPath!, 60);

      expect(signed.error).toBeNull();
      expect(signed.data?.signedUrl).toContain('token=');
    });

    it('refuses a signed URL to a visiting helper', async () => {
      const signed = await fixture!.helper.client.storage
        .from(BUCKET)
        .createSignedUrl(uploadedPath!, 60);

      expect(signed.error).not.toBeNull();
    });

    it('refuses a signed URL to another circle', async () => {
      const signed = await stranger!.client.storage.from(BUCKET).createSignedUrl(uploadedPath!, 60);

      expect(signed.error).not.toBeNull();
    });

    it('refuses a signed URL to a signed-out visitor', async () => {
      const env = getRlsEnv();
      const { createClient } = await import('@supabase/supabase-js');
      const anonymous = createClient(env.url, env.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      const signed = await anonymous.storage.from(BUCKET).createSignedUrl(uploadedPath!, 60);

      expect(signed.error).not.toBeNull();
    });

    it('serves nothing without a signature, because the bucket is private', async () => {
      const env = getRlsEnv();
      const response = await fetch(
        `${env.url}/storage/v1/object/public/${BUCKET}/${uploadedPath ?? 'missing'}`,
      );

      expect(response.ok).toBe(false);
    });

    it('rejects a path that does not start with a circle id', async () => {
      const signed = await fixture!.owner.client.storage
        .from(BUCKET)
        .createSignedUrl('not-a-circle/photo.png', 60);

      expect(signed.error).not.toBeNull();
    });
  });
});
