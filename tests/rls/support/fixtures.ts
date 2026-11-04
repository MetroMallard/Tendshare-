/**
 * Fixtures for the hosted RLS suite.
 *
 * Everything the suite creates carries `TEST_PREFIX`, and everything it creates
 * is deleted again in `afterAll`. Nothing here reads, writes or deletes a row
 * the suite did not create.
 *
 * The two clients have deliberately different jobs:
 *   * the admin client (service role) creates and deletes auth users — setup and
 *     teardown only, because it bypasses RLS and would prove nothing;
 *   * every user client is the anon key plus a real JWT from
 *     `signInWithPassword`, so every assertion travels the same path a phone
 *     would: anon key, real session, RLS applied.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RlsEnv } from './env';

export const TEST_PREFIX = `rls-test-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

export interface CircleFixture {
  circleId: string;
  owner: TestUser;
  familyMember: TestUser;
  viewer: TestUser;
  helper: TestUser;
  outsider: TestUser;
  recipientId: string;
  auditEntryId: number;
}

export function createAdminClient(env: RlsEnv): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function createUser(
  admin: SupabaseClient,
  env: RlsEnv,
  label: string,
): Promise<TestUser> {
  const email = `${TEST_PREFIX}-${label}@tendshare.test`;
  const password = `${TEST_PREFIX}-${label}-password`;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label}` },
  });

  if (created.error || !created.data.user) {
    throw new Error(
      `could not create the ${label} test user: ${created.error?.message ?? 'no user'}`,
    );
  }

  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    throw new Error(`could not sign the ${label} test user in: ${signedIn.error.message}`);
  }

  return { id: created.data.user.id, email, client };
}

/**
 * Builds one circle with all four roles plus a person outside it, through the
 * API and as the owner — which is itself the first thing worth proving: a new
 * user can create a circle and staff it.
 */
export async function createCircleFixture(env: RlsEnv): Promise<CircleFixture> {
  const admin = createAdminClient(env);

  const owner = await createUser(admin, env, 'owner');
  const familyMember = await createUser(admin, env, 'family');
  const viewer = await createUser(admin, env, 'viewer');
  const helper = await createUser(admin, env, 'helper');
  const outsider = await createUser(admin, env, 'outsider');

  const circle = await owner.client
    .from('circles')
    .insert({
      name: `${TEST_PREFIX} circle`,
      owner_id: owner.id,
      plan_tier: 'family_plus',
    })
    .select('id')
    .single();

  if (circle.error || !circle.data) {
    throw new Error(`the owner could not create a circle: ${circle.error?.message ?? 'no row'}`);
  }

  const circleId = String(circle.data.id);

  const members = await owner.client.from('circle_members').insert([
    { circle_id: circleId, profile_id: familyMember.id, role: 'family_member' },
    { circle_id: circleId, profile_id: viewer.id, role: 'view_only' },
    { circle_id: circleId, profile_id: helper.id, role: 'visiting_helper' },
  ]);

  if (members.error) {
    throw new Error(`the owner could not add members: ${members.error.message}`);
  }

  const recipient = await owner.client
    .from('care_recipients')
    .insert({ circle_id: circleId, full_name: 'Margaret', relationship: 'Mom' })
    .select('id')
    .single();

  if (recipient.error || !recipient.data) {
    throw new Error(
      `the owner could not add a person cared for: ${recipient.error?.message ?? 'no row'}`,
    );
  }

  const audit = await owner.client.rpc('log_audit_event', {
    p_circle_id: circleId,
    p_table_name: 'care_recipients',
    p_row_id: String(recipient.data.id),
    p_action: 'create',
    p_summary: { fields: ['full_name'] },
  });

  if (audit.error) {
    throw new Error(`the owner could not write an audit entry: ${audit.error.message}`);
  }

  return {
    circleId,
    owner,
    familyMember,
    viewer,
    helper,
    outsider,
    recipientId: String(recipient.data.id),
    auditEntryId: Number(audit.data),
  };
}

/** Deleting an auth user cascades: profiles, memberships, circles, audit rows. */
export async function deleteTestUsers(env: RlsEnv, users: TestUser[]): Promise<void> {
  const admin = createAdminClient(env);
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

export function allUsers(fixture: CircleFixture): TestUser[] {
  return [fixture.owner, fixture.familyMember, fixture.viewer, fixture.helper, fixture.outsider];
}
