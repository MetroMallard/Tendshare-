/**
 * Row Level Security — care circles: members, roles and the audit trail.
 *
 * Task 6 adds three things that must hold under RLS, not just in the UI:
 *
 *   1. the owner runs the circle — they change a role, remove a member and
 *      rename it; nobody else does;
 *   2. `view_only` and `visiting_helper` write nothing at all, and a family
 *      member writes care data but never memberships;
 *   3. every membership change and rename appends its own audit row, and the
 *      audit trail of one circle is unreadable from another.
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

describe.skipIf(!rlsEnv)('RLS — care circles: members, roles and the audit trail', () => {
  let fixture: CircleFixture | undefined;
  /** Somebody who runs a different circle entirely. */
  let stranger: TestUser | undefined;
  let strangerCircleId: string | undefined;
  /** A member added only so the owner has somebody to remove. */
  let removable: TestUser | undefined;

  beforeAll(async () => {
    const env = getRlsEnv();
    fixture = await createCircleFixture(env);

    const admin = createAdminClient(env);
    stranger = await createUser(admin, env, 'stranger');
    removable = await createUser(admin, env, 'removable');

    const circle = await stranger.client
      .from('circles')
      .insert({ name: `${TEST_PREFIX} another family`, owner_id: stranger.id })
      .select('id')
      .single();

    if (circle.error || !circle.data) {
      throw new Error(`the stranger could not create a circle: ${circle.error?.message ?? 'no row'}`);
    }

    strangerCircleId = String(circle.data.id);

    // The stranger's circle needs a person too, so "sees only their own rows"
    // is a real comparison rather than an empty set.
    await stranger.client
      .from('care_recipients')
      .insert({ circle_id: strangerCircleId, full_name: 'Someone else' });
  });

  afterAll(async () => {
    if (fixture) {
      await deleteTestUsers(getRlsEnv(), allUsers(fixture));
    }

    const extras = [stranger, removable].filter((user): user is TestUser => user !== undefined);

    if (extras.length > 0) {
      await deleteTestUsers(getRlsEnv(), extras);
    }
  });

  describe('the owner runs the circle', () => {
    it('can change a member’s role', async () => {
      const { data, error } = await fixture!.owner.client
        .from('circle_members')
        .update({ role: 'family_member' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('role');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.role).toBe('family_member');

      // Put it back: the view-only tests below depend on it.
      await fixture!.owner.client
        .from('circle_members')
        .update({ role: 'view_only' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id);
    });

    it('can remove a member', async () => {
      const added = await fixture!.owner.client.from('circle_members').insert({
        circle_id: fixture!.circleId,
        profile_id: removable!.id,
        role: 'family_member',
      });
      expect(added.error).toBeNull();

      const { data, error } = await fixture!.owner.client
        .from('circle_members')
        .delete()
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', removable!.id)
        .select('id');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      // And the person really is out: their own read returns nothing.
      const after = await removable!.client.from('care_recipients').select('id');
      expect(after.data).toHaveLength(0);
    });

    it('can rename the circle', async () => {
      const { data, error } = await fixture!.owner.client
        .from('circles')
        .update({ name: `${TEST_PREFIX} renamed family` })
        .eq('id', fixture!.circleId)
        .select('name');

      expect(error).toBeNull();
      expect(data?.[0]?.name).toBe(`${TEST_PREFIX} renamed family`);
    });

    it('cannot demote themselves and leave the circle without an owner', async () => {
      const { error } = await fixture!.owner.client
        .from('circle_members')
        .update({ role: 'family_member' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.owner.id)
        .select('id');

      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/owner cannot be given another role/i);

      // The owner membership row survived the attempt.
      const still = await fixture!.owner.client
        .from('circle_members')
        .select('role')
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.owner.id);
      expect(still.data?.[0]?.role).toBe('owner');
    });

    it('cannot delete the owner membership row', async () => {
      const { data } = await fixture!.owner.client
        .from('circle_members')
        .delete()
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.owner.id)
        .select('id');

      expect(data).toHaveLength(0);
    });
  });

  describe('a family member cannot manage members', () => {
    it('cannot change a role', async () => {
      const { data } = await fixture!.familyMember.client
        .from('circle_members')
        .update({ role: 'family_member' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('id');

      expect(data).toHaveLength(0);
    });

    it('cannot remove a member', async () => {
      const { data } = await fixture!.familyMember.client
        .from('circle_members')
        .delete()
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('id');

      expect(data).toHaveLength(0);
    });

    it('cannot rename the circle', async () => {
      const { data } = await fixture!.familyMember.client
        .from('circles')
        .update({ name: 'Renamed by a family member' })
        .eq('id', fixture!.circleId)
        .select('id');

      expect(data).toHaveLength(0);
    });

    it('cannot add a member', async () => {
      const { error } = await fixture!.familyMember.client.from('circle_members').insert({
        circle_id: fixture!.circleId,
        profile_id: stranger!.id,
        role: 'view_only',
      });

      expect(error).not.toBeNull();
    });
  });

  describe('view_only writes nothing', () => {
    it('cannot change a role', async () => {
      const { data } = await fixture!.viewer.client
        .from('circle_members')
        .update({ role: 'family_member' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('id');

      expect(data).toHaveLength(0);
    });

    it('cannot add or remove a member', async () => {
      const insert = await fixture!.viewer.client.from('circle_members').insert({
        circle_id: fixture!.circleId,
        profile_id: stranger!.id,
        role: 'view_only',
      });
      expect(insert.error).not.toBeNull();

      const removed = await fixture!.viewer.client
        .from('circle_members')
        .delete()
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.helper.id)
        .select('id');
      expect(removed.data).toHaveLength(0);
    });

    it('cannot rename the circle', async () => {
      const { data } = await fixture!.viewer.client
        .from('circles')
        .update({ name: 'Renamed by a viewer' })
        .eq('id', fixture!.circleId)
        .select('id');

      expect(data).toHaveLength(0);
    });
  });

  describe('visiting_helper writes nothing', () => {
    it('cannot change a role', async () => {
      const { data } = await fixture!.helper.client
        .from('circle_members')
        .update({ role: 'family_member' })
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.helper.id)
        .select('id');

      expect(data).toHaveLength(0);
    });

    it('cannot add or remove a member', async () => {
      const insert = await fixture!.helper.client.from('circle_members').insert({
        circle_id: fixture!.circleId,
        profile_id: stranger!.id,
        role: 'view_only',
      });
      expect(insert.error).not.toBeNull();

      const removed = await fixture!.helper.client
        .from('circle_members')
        .delete()
        .eq('circle_id', fixture!.circleId)
        .eq('profile_id', fixture!.viewer.id)
        .select('id');
      expect(removed.data).toHaveLength(0);
    });

    it('cannot rename the circle', async () => {
      const { data } = await fixture!.helper.client
        .from('circles')
        .update({ name: 'Renamed by a helper' })
        .eq('id', fixture!.circleId)
        .select('id');

      expect(data).toHaveLength(0);
    });
  });

  describe('a non-member sees nothing', () => {
    it('sees no circles, members or audit rows from this circle', async () => {
      const circles = await stranger!.client.from('circles').select('id');
      expect(circles.data?.map((row) => row.id)).toEqual([strangerCircleId]);

      const members = await stranger!.client
        .from('circle_members')
        .select('circle_id')
        .eq('circle_id', fixture!.circleId);
      expect(members.data).toHaveLength(0);

      const audit = await stranger!.client
        .from('audit_log')
        .select('circle_id')
        .eq('circle_id', fixture!.circleId);
      expect(audit.data).toHaveLength(0);
    });
  });

  describe('the audit trail writes itself', () => {
    async function auditRows(): Promise<AuditRow[]> {
      const { data, error } = await fixture!.owner.client
        .from('audit_log')
        .select('id, circle_id, actor_id, actor_role, table_name, action, summary')
        .eq('circle_id', fixture!.circleId)
        .order('id', { ascending: false })
        .returns<AuditRow[]>();

      expect(error).toBeNull();
      return data ?? [];
    }

    it('recorded the join when the owner added a member', async () => {
      const rows = await auditRows();
      const joins = rows.filter((row) => row.table_name === 'circle_members' && row.action === 'create');

      // The owner's own membership row, plus the three the fixture added.
      expect(joins.length).toBeGreaterThanOrEqual(4);
      expect(joins.some((row) => row.summary.role === 'visiting_helper')).toBe(true);
      expect(joins.every((row) => row.actor_id === fixture!.owner.id)).toBe(true);
    });

    it('recorded the role change, with the actor taken from the session', async () => {
      const rows = await auditRows();
      const change = rows.find(
        (row) =>
          row.table_name === 'circle_members' &&
          row.action === 'update' &&
          row.summary.to === 'family_member' &&
          row.summary.from === 'view_only',
      );

      expect(change).toBeDefined();
      expect(change?.actor_id).toBe(fixture!.owner.id);
      expect(change?.actor_role).toBe('owner');
    });

    it('recorded the removal', async () => {
      const rows = await auditRows();
      const removal = rows.find(
        (row) => row.table_name === 'circle_members' && row.action === 'delete',
      );

      expect(removal).toBeDefined();
      expect(removal?.summary.role).toBe('family_member');
      expect(removal?.actor_id).toBe(fixture!.owner.id);
    });

    it('recorded the rename without copying the name into the payload', async () => {
      const rows = await auditRows();
      const rename = rows.find((row) => row.table_name === 'circles' && row.action === 'update');

      expect(rename).toBeDefined();
      expect(rename?.summary).toEqual({ fields: ['name'] });

      // The audit payload is field names, never free text the family typed.
      expect(JSON.stringify(rename?.summary)).not.toContain('renamed family');
    });

    it('is readable by the family member and not by view_only or a helper', async () => {
      const family = await fixture!.familyMember.client
        .from('audit_log')
        .select('id')
        .eq('circle_id', fixture!.circleId);
      expect((family.data?.length ?? 0) >= 1).toBe(true);

      const viewer = await fixture!.viewer.client
        .from('audit_log')
        .select('id')
        .eq('circle_id', fixture!.circleId);
      expect(viewer.data).toHaveLength(0);

      const helper = await fixture!.helper.client
        .from('audit_log')
        .select('id')
        .eq('circle_id', fixture!.circleId);
      expect(helper.data).toHaveLength(0);
    });

    it('keeps one circle’s trail out of another circle’s owner', async () => {
      const theirs = await stranger!.client.from('audit_log').select('circle_id');

      expect(theirs.error).toBeNull();
      expect(theirs.data?.length ?? 0).toBeGreaterThan(0);
      expect(theirs.data?.every((row) => row.circle_id === strangerCircleId)).toBe(true);
    });

    it('cannot be written directly by the owner', async () => {
      const { error } = await fixture!.owner.client.from('audit_log').insert({
        circle_id: fixture!.circleId,
        actor_id: fixture!.owner.id,
        table_name: 'circle_members',
        row_id: 'forged',
        action: 'delete',
      });

      expect(error).not.toBeNull();
    });
  });

  describe('the free plan’s member limit is enforced from config', () => {
    it('allows three people and refuses a fourth, without removing anyone', async () => {
      const env = getRlsEnv();
      const admin = createAdminClient(env);

      const owner = await createUser(admin, env, 'limit-owner');
      const first = await createUser(admin, env, 'limit-first');
      const second = await createUser(admin, env, 'limit-second');
      const fourth = await createUser(admin, env, 'limit-fourth');
      const users: TestUser[] = [owner, first, second, fourth];

      try {
        const circle = await owner.client
          .from('circles')
          .insert({ name: `${TEST_PREFIX} free family`, owner_id: owner.id })
          .select('id')
          .single();
        expect(circle.error).toBeNull();
        const circleId = String(circle.data?.id);

        // The owner's membership was created by the trigger: one seat used.
        const secondSeat = await owner.client.from('circle_members').insert({
          circle_id: circleId,
          profile_id: first.id,
          role: 'family_member',
        });
        expect(secondSeat.error).toBeNull();

        const thirdSeat = await owner.client.from('circle_members').insert({
          circle_id: circleId,
          profile_id: second.id,
          role: 'view_only',
        });
        expect(thirdSeat.error).toBeNull();

        const overflow = await owner.client.from('circle_members').insert({
          circle_id: circleId,
          profile_id: fourth.id,
          role: 'family_member',
        });
        expect(overflow.error).not.toBeNull();
        expect(overflow.error?.message ?? '').toMatch(/free plan covers up to 3 people/i);

        // Nothing was removed to make room.
        const roster = await owner.client
          .from('circle_members')
          .select('profile_id')
          .eq('circle_id', circleId);
        expect(roster.data).toHaveLength(3);
      } finally {
        await deleteTestUsers(env, users);
      }
    });
  });
});
