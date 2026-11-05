/**
 * Row Level Security — creating a circle.
 *
 * Regression test for a defect the hosted project caught:
 * `.insert(...).select()` — `INSERT ... RETURNING`, the call the app makes on
 * its very first write, because it needs the new circle's id — was refused with
 * `42501 new row violates row-level security policy for table "circles"`, even
 * though the insert itself was legal.
 *
 * The cause was in the SELECT policy, not the INSERT policy: INSERT ...
 * RETURNING has to satisfy the table's SELECT policy for every returned row,
 * and `circles_select_care_team` recognised the owner only through their
 * `circle_members` row — which an AFTER INSERT trigger writes during that same
 * statement, after the snapshot the policy is evaluated against. At RETURNING
 * time the membership was invisible and the row was rejected.
 *
 * Migration `20261104120400_circles_select_owner.sql` reads `owner_id` from the
 * row instead, which is knowable without the trigger. This file holds that fix
 * in place: it fails if the owner-only branch of the policy is ever removed.
 *
 * Kept separate from `identity.rls.test.ts` so it owns its fixture — one user,
 * and nothing that could disturb the row counts that suite asserts.
 *
 *   pnpm test:rls
 *
 * Skips cleanly when the credentials are absent, so it never runs in CI.
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRlsEnv, rlsEnv } from './support/env';
import {
  createAdminClient,
  createUser,
  deleteTestUsers,
  TEST_PREFIX,
  type TestUser,
} from './support/fixtures';

describe.skipIf(!rlsEnv)('RLS — creating a circle', () => {
  let owner: TestUser | undefined;

  beforeAll(async () => {
    const env = getRlsEnv();
    owner = await createUser(createAdminClient(env), env, 'creator');
  });

  afterAll(async () => {
    if (owner) {
      await deleteTestUsers(getRlsEnv(), [owner]);
    }
  });

  it('lets the owner create a circle and read it back in one statement', async () => {
    const { data, error } = await owner!.client
      .from('circles')
      .insert({
        name: `${TEST_PREFIX} first circle`,
        owner_id: owner!.id,
        plan_tier: 'free',
      })
      .select('id, name, owner_id')
      .single();

    expect(error, 'insert().select() must not be refused by the SELECT policy').toBeNull();
    expect(data?.owner_id).toBe(owner!.id);
    expect(data?.name).toBe(`${TEST_PREFIX} first circle`);
  });

  it('has an owner membership for the circle it just created', async () => {
    const { data, error } = await owner!.client
      .from('circle_members')
      .select('role, profile_id')
      .eq('profile_id', owner!.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.role).toBe('owner');
  });

  it('still refuses an insert with RETURNING when nobody is signed in', async () => {
    const env = getRlsEnv();
    const anon = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { error } = await anon
      .from('circles')
      .insert({ name: `${TEST_PREFIX} anonymous`, owner_id: owner!.id })
      .select('id')
      .single();

    expect(error, 'a signed-out client holds no privileges on circles').not.toBeNull();
  });
});
