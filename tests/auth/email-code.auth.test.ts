/**
 * The email-code flow, end to end, against the real hosted project.
 *
 * This is the proof that Task 4 actually works rather than merely typechecks.
 * It drives the same sequence a phone does, through the same clients the app
 * builds: the anon key plus a real session, never the service role for an
 * assertion.
 *
 *   1. the admin client asks the Auth server to mint a one-time code for a
 *      brand-new address (`generateLink`), which is exactly what the mailer
 *      would have put in the email;
 *   2. an anon client verifies that code (`verifyOtp`) and must get a session;
 *   3. the `profiles` row for that user must exist — written by the signup
 *      trigger in `20261104120100_identity_tables.sql`, because this file never
 *      inserts one and RLS grants no INSERT on `profiles` anyway;
 *   4. `refreshSession()` must work, because the app keeps a session alive for
 *      days across restarts;
 *   5. `signOut()` must leave no session and no data access behind.
 *
 *   pnpm test:auth:live
 *
 * **What this does not prove: that the code email is delivered.** Nothing here
 * reads a mailbox. Delivery needs a real SMTP sender configured on the project;
 * until then the app's "check your email" screen has been proven to work up to
 * the point the mail leaves the server, and no further.
 *
 * Skips cleanly when the credentials are absent, so it never runs in CI.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { digitsOnly, isCompleteCode } from '../../apps/app/src/auth/code';
import { authEnv, getAuthEnv } from './support/env';

/** Everything the tests share: one real sign-in, then assertions on it. */
interface FlowState {
  email: string;
  /** The address's local part — the trigger's fallback display name. */
  expectedDisplayName: string;
  /** The one-time code the Auth server minted, held for the verify test. */
  otp: string;
  userId: string;
  /** The anon-key client, signed in by `verifyOtp`. */
  client: SupabaseClient | null;
  session: Session | null;
}

describe.skipIf(!authEnv)('live auth — email one-time code', () => {
  const state: FlowState = {
    email: '',
    expectedDisplayName: '',
    otp: '',
    userId: '',
    client: null,
    session: null,
  };

  beforeAll(async () => {
    const env = getAuthEnv();

    // A fresh address every run, so the user is genuinely new and the signup
    // trigger has to fire. `example.com` is reserved for exactly this.
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const local = `tendshare-auth-test-${stamp}`;
    state.email = `${local}@example.com`;
    state.expectedDisplayName = local;

    const admin = createClient(env.url, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: state.email });

    if (link.error) {
      throw new Error(`could not mint a one-time code: ${link.error.message}`);
    }

    state.userId = link.data.user.id;

    const otp = link.data.properties?.email_otp;
    if (typeof otp !== 'string' || otp.length === 0) {
      throw new Error('the Auth server returned no email_otp to verify');
    }

    state.otp = otp;

    state.client = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  afterAll(async () => {
    // Deleting the auth user cascades to profiles. Nothing the suite created is
    // left behind, and the run can be repeated as often as needed.
    if (state.userId) {
      const admin = createClient(getAuthEnv().url, getAuthEnv().serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const removed = await admin.auth.admin.deleteUser(state.userId);
      if (removed.error) {
        throw new Error(`could not delete the test user: ${removed.error.message}`);
      }
    }
  });

  it('mints a code the verify screen accepts without cutting it short', () => {
    // The screen's own rules, not a copy of them: a code the input would trim
    // or refuse is a sign-in nobody can complete, and this is how that was
    // found. The project mints eight digits; six would have been truncated.
    expect(state.otp).toMatch(/^\d+$/);
    expect(digitsOnly(state.otp)).toBe(state.otp);
    expect(isCompleteCode(state.otp)).toBe(true);
  });

  it('verifies the code and returns a real session', async () => {
    const client = state.client!;

    const verified = await client.auth.verifyOtp({
      email: state.email,
      token: state.otp,
      type: 'email',
    });

    expect(verified.error).toBeNull();
    expect(verified.data.session).not.toBeNull();

    const session = verified.data.session!;
    expect(session.access_token.length).toBeGreaterThan(20);
    expect(session.refresh_token.length).toBeGreaterThan(5);
    expect(session.user.id).toBe(state.userId);
    expect(session.user.email).toBe(state.email);

    // The same session the app reads on the next screen, and after a restart.
    const stored = await client.auth.getSession();
    expect(stored.error).toBeNull();
    expect(stored.data.session?.user.id).toBe(state.userId);

    state.session = session;
  });

  it('has a profiles row, written by the signup trigger and not by this test', async () => {
    const client = state.client!;

    // No INSERT exists in this file, and RLS grants none on profiles — so a row
    // here can only come from `handle_new_user()` firing on the new auth user.
    const { data, error } = await client
      .from('profiles')
      .select('id, display_name')
      .eq('id', state.userId);

    expect(error).toBeNull();

    const rows = (data ?? []) as { id: string; display_name: string | null }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(state.userId);
    expect(rows[0]?.display_name).toBe(state.expectedDisplayName);
  });

  it('refreshes the session, as the app does when it comes back days later', async () => {
    const client = state.client!;
    const before = state.session!;

    const refreshed = await client.auth.refreshSession({ refresh_token: before.refresh_token });

    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session).not.toBeNull();
    expect(refreshed.data.session?.user.id).toBe(state.userId);
    expect(refreshed.data.session?.refresh_token.length).toBeGreaterThan(5);

    const stored = await client.auth.getSession();
    expect(stored.data.session?.user.id).toBe(state.userId);

    state.session = refreshed.data.session ?? before;
  });

  it('signs out and leaves no session and no access behind', async () => {
    const client = state.client!;

    const signedOut = await client.auth.signOut();
    expect(signedOut.error).toBeNull();

    const after = await client.auth.getSession();
    expect(after.error).toBeNull();
    expect(after.data.session).toBeNull();

    // The client is back to the bare anon key: profiles is revoked from anon,
    // so the row that was readable a moment ago is not readable now.
    const { data, error } = await client.from('profiles').select('id');
    expect(error === null ? (data ?? []) : []).toHaveLength(0);
  });
});
