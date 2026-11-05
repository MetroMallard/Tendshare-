/**
 * Row Level Security — identity and authorisation core.
 *
 * Every assertion runs as a real signed-in user: the anon key plus a JWT from
 * `signInWithPassword`. The service role appears only in `beforeAll` and
 * `afterAll`, to create and delete auth users. If an assertion ever needed the
 * service role it would prove nothing, because the service role bypasses RLS.
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
  type CircleFixture,
  type TestUser,
} from './support/fixtures';

describe.skipIf(!rlsEnv)('RLS — identity and authorisation core', () => {
  let fixture: CircleFixture | undefined;

  beforeAll(async () => {
    fixture = await createCircleFixture(getRlsEnv());
  });

  afterAll(async () => {
    if (fixture) {
      await deleteTestUsers(getRlsEnv(), allUsers(fixture));
    }
  });

  describe('a member reads their circle', () => {
    it('lets the owner read the circle', async () => {
      const { data, error } = await fixture!.owner.client.from('circles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('lets a family member read the circle', async () => {
      const { data, error } = await fixture!.familyMember.client.from('circles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('lets a view-only member read the circle', async () => {
      const { data, error } = await fixture!.viewer.client.from('circles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('lets every role read the person being cared for', async () => {
      for (const user of [
        fixture!.owner,
        fixture!.familyMember,
        fixture!.viewer,
        fixture!.helper,
      ]) {
        const { data, error } = await user.client.from('care_recipients').select('id');
        expect(error, `${user.email} should read the care recipient`).toBeNull();
        expect(data).toHaveLength(1);
      }
    });

    it('lets the care team read the member roster', async () => {
      const { data, error } = await fixture!.viewer.client.from('circle_members').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(4);
    });
  });

  describe('a non-member sees nothing', () => {
    it('shows no circles', async () => {
      const { data, error } = await fixture!.outsider.client.from('circles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('shows no care recipients', async () => {
      const { data } = await fixture!.outsider.client.from('care_recipients').select('id');
      expect(data).toHaveLength(0);
    });

    it('shows no members', async () => {
      const { data } = await fixture!.outsider.client.from('circle_members').select('id');
      expect(data).toHaveLength(0);
    });

    it('shows no audit rows', async () => {
      const { data } = await fixture!.outsider.client.from('audit_log').select('id');
      expect(data).toHaveLength(0);
    });

    it('shows only their own profile', async () => {
      const { data } = await fixture!.outsider.client.from('profiles').select('id');
      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(fixture!.outsider.id);
    });

    it('cannot insert a care recipient', async () => {
      const { error } = await fixture!.outsider.client
        .from('care_recipients')
        .insert({ circle_id: fixture!.circleId, full_name: 'Trespass' });
      expect(error).not.toBeNull();
    });

    it('cannot add themselves to the circle', async () => {
      const { error } = await fixture!.outsider.client.from('circle_members').insert({
        circle_id: fixture!.circleId,
        profile_id: fixture!.outsider.id,
        role: 'family_member',
      });
      expect(error).not.toBeNull();
    });

    it('cannot update a care recipient', async () => {
      const { data } = await fixture!.outsider.client
        .from('care_recipients')
        .update({ full_name: 'Hijacked' })
        .eq('id', fixture!.recipientId)
        .select('id');
      expect(data).toHaveLength(0);
    });

    it('cannot delete a care recipient', async () => {
      const { data } = await fixture!.outsider.client
        .from('care_recipients')
        .delete()
        .eq('id', fixture!.recipientId)
        .select('id');
      expect(data).toHaveLength(0);
    });
  });

  describe('view_only reads but never writes', () => {
    it('cannot insert a care recipient', async () => {
      const { error } = await fixture!.viewer.client
        .from('care_recipients')
        .insert({ circle_id: fixture!.circleId, full_name: 'Not allowed' });
      expect(error).not.toBeNull();
    });

    it('cannot update a care recipient', async () => {
      const { data } = await fixture!.viewer.client
        .from('care_recipients')
        .update({ full_name: 'Not allowed' })
        .eq('id', fixture!.recipientId)
        .select('id');
      expect(data).toHaveLength(0);
    });

    it('cannot delete a care recipient', async () => {
      const { data } = await fixture!.viewer.client
        .from('care_recipients')
        .delete()
        .eq('id', fixture!.recipientId)
        .select('id');
      expect(data).toHaveLength(0);
    });

    it('cannot change a circle setting', async () => {
      const { data } = await fixture!.viewer.client
        .from('circles')
        .update({ name: 'Renamed by a viewer' })
        .eq('id', fixture!.circleId)
        .select('id');
      expect(data).toHaveLength(0);
    });

    it('cannot read the audit trail', async () => {
      const { data } = await fixture!.viewer.client.from('audit_log').select('id');
      expect(data).toHaveLength(0);
    });
  });

  describe('visiting_helper gets the narrow slice, not general read', () => {
    it('cannot read the circle settings', async () => {
      const { data } = await fixture!.helper.client.from('circles').select('id');
      expect(data).toHaveLength(0);
    });

    it('sees only their own membership row, not the roster', async () => {
      const { data } = await fixture!.helper.client.from('circle_members').select('id');
      expect(data).toHaveLength(1);
    });

    it('cannot read the audit trail', async () => {
      const { data } = await fixture!.helper.client.from('audit_log').select('id');
      expect(data).toHaveLength(0);
    });

    it('cannot edit the person being cared for', async () => {
      const { error } = await fixture!.helper.client
        .from('care_recipients')
        .insert({ circle_id: fixture!.circleId, full_name: 'Not allowed' });
      expect(error).not.toBeNull();
    });

    it('can record that they looked at something', async () => {
      const { error } = await fixture!.helper.client.rpc('log_audit_event', {
        p_circle_id: fixture!.circleId,
        p_table_name: 'care_recipients',
        p_row_id: fixture!.recipientId,
        p_action: 'view',
      });
      expect(error).toBeNull();
    });

    it('cannot record a change', async () => {
      const { error } = await fixture!.helper.client.rpc('log_audit_event', {
        p_circle_id: fixture!.circleId,
        p_table_name: 'care_recipients',
        p_row_id: fixture!.recipientId,
        p_action: 'update',
      });
      expect(error).not.toBeNull();
    });
  });

  describe('a family member writes care data but cannot change memberships', () => {
    it('can update the person being cared for', async () => {
      const { data, error } = await fixture!.familyMember.client
        .from('care_recipients')
        .update({ relationship: 'Mother' })
        .eq('id', fixture!.recipientId)
        .select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('cannot change a role', async () => {
      const { data } = await fixture!.familyMember.client
        .from('circle_members')
        .update({ role: 'view_only' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('id');
      expect(data).toHaveLength(0);
    });

    it('cannot add a member', async () => {
      const { error } = await fixture!.familyMember.client.from('circle_members').insert({
        circle_id: fixture!.circleId,
        profile_id: fixture!.outsider.id,
        role: 'family_member',
      });
      expect(error).not.toBeNull();
    });

    it('cannot remove another member', async () => {
      const { data } = await fixture!.familyMember.client
        .from('circle_members')
        .delete()
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('id');
      expect(data).toHaveLength(0);
    });

    it('cannot change the plan tier', async () => {
      const { data } = await fixture!.familyMember.client
        .from('circles')
        .update({ plan_tier: 'free' })
        .eq('id', fixture!.circleId)
        .select('id');
      expect(data).toHaveLength(0);
    });

    it('can read the audit trail', async () => {
      const { data } = await fixture!.familyMember.client.from('audit_log').select('id');
      expect((data?.length ?? 0) >= 1).toBe(true);
    });
  });

  describe('the owner changes memberships, roles and plan fields', () => {
    it('can change a role', async () => {
      const { data, error } = await fixture!.owner.client
        .from('circle_members')
        .update({ role: 'family_member' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      await fixture!.owner.client
        .from('circle_members')
        .update({ role: 'view_only' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id);
    });

    it('cannot grant someone else the owner role', async () => {
      const { error } = await fixture!.owner.client
        .from('circle_members')
        .update({ role: 'owner' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.familyMember.id)
        .select('id');
      expect(error).not.toBeNull();
    });

    it('can change plan fields', async () => {
      const { data, error } = await fixture!.owner.client
        .from('circles')
        .update({ plan_status: 'active' })
        .eq('id', fixture!.circleId)
        .select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('cannot hand the circle to a different owner', async () => {
      const { error } = await fixture!.owner.client
        .from('circles')
        .update({ owner_id: fixture!.familyMember.id })
        .eq('id', fixture!.circleId);
      expect(error).not.toBeNull();
    });
  });

  describe('the audit log is append-only', () => {
    it('cannot be updated by the owner', async () => {
      const { data, error } = await fixture!.owner.client
        .from('audit_log')
        .update({ action: 'delete' })
        .eq('id', fixture!.auditEntryId)
        .select('id');
      expect(error ?? data).toBeTruthy();
      if (!error) {
        expect(data).toHaveLength(0);
      }
    });

    it('cannot be deleted by the owner', async () => {
      const { data, error } = await fixture!.owner.client
        .from('audit_log')
        .delete()
        .eq('id', fixture!.auditEntryId)
        .select('id');
      expect(error ?? data).toBeTruthy();
      if (!error) {
        expect(data).toHaveLength(0);
      }
    });

    it('cannot be written directly by any client', async () => {
      const { error } = await fixture!.owner.client.from('audit_log').insert({
        circle_id: fixture!.circleId,
        actor_id: fixture!.owner.id,
        table_name: 'profiles',
        row_id: 'forged',
        action: 'delete',
      });
      expect(error).not.toBeNull();
    });

    it('still holds the entries that were written properly', async () => {
      const { data } = await fixture!.owner.client.from('audit_log').select('id');
      expect((data?.length ?? 0) >= 1).toBe(true);
    });
  });

  describe('the plan limit is enforced from config', () => {
    it('refuses a second person cared for on a free circle', async () => {
      const env = getRlsEnv();
      const owner = await createUser(createAdminClient(env), env, 'free-owner');
      try {
        const circle = await owner.client
          .from('circles')
          .insert({ name: `${owner.email} free circle`, owner_id: owner.id })
          .select('id')
          .single();

        expect(circle.error).toBeNull();
        const circleId = String(circle.data?.id);

        const first = await owner.client
          .from('care_recipients')
          .insert({ circle_id: circleId, full_name: 'First' });
        expect(first.error).toBeNull();

        const second = await owner.client
          .from('care_recipients')
          .insert({ circle_id: circleId, full_name: 'Second' });
        expect(second.error).not.toBeNull();
        expect(second.error?.message ?? '').toMatch(/plan cares for 1 person/i);
      } finally {
        await deleteTestUsers(env, [owner]);
      }
    });
  });

  describe('deleting an account cascades as designed', () => {
    it('removes the circle and its data when the owner is deleted', async () => {
      const env = getRlsEnv();
      const admin = createAdminClient(env);

      const owner = await createUser(admin, env, 'cascade-owner');
      const member = await createUser(admin, env, 'cascade-member');
      const users: TestUser[] = [owner, member];

      try {
        const circle = await owner.client
          .from('circles')
          .insert({ name: `${owner.email} cascade circle`, owner_id: owner.id })
          .select('id')
          .single();
        expect(circle.error).toBeNull();
        const circleId = String(circle.data?.id);

        const added = await owner.client.from('circle_members').insert({
          circle_id: circleId,
          profile_id: member.id,
          role: 'family_member',
        });
        expect(added.error).toBeNull();

        const recipient = await owner.client
          .from('care_recipients')
          .insert({ circle_id: circleId, full_name: 'Cascade person' });
        expect(recipient.error).toBeNull();

        // The member can see the circle before the owner is deleted.
        const before = await member.client.from('circles').select('id');
        expect(before.data).toHaveLength(1);

        await admin.auth.admin.deleteUser(owner.id);

        // The circle went with the owner; the member's session still works, and
        // now sees nothing.
        const after = await member.client.from('circles').select('id');
        expect(after.error).toBeNull();
        expect(after.data).toHaveLength(0);

        const recipients = await member.client.from('care_recipients').select('id');
        expect(recipients.data).toHaveLength(0);

        const memberships = await member.client.from('circle_members').select('id');
        expect(memberships.data).toHaveLength(0);
      } finally {
        await deleteTestUsers(
          env,
          users.filter((user) => user.id !== owner.id),
        );
      }
    });
  });
});
