/**
 * Credentials for the hosted RLS suite.
 *
 * The suite needs three values and refuses to guess any of them:
 *   SUPABASE_URL               the project URL
 *   SUPABASE_ANON_KEY          the public key — every assertion runs through it
 *   SUPABASE_SERVICE_ROLE_KEY  setup and teardown only, never an assertion
 *
 * When any of them is missing the suite skips. That is what keeps `pnpm test`
 * and CI honest: they have no secrets, so they never touch the database.
 */

export interface RlsEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

function read(name: string): string | null {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

const url = read('SUPABASE_URL');
const anonKey = read('SUPABASE_ANON_KEY');
const serviceRoleKey = read('SUPABASE_SERVICE_ROLE_KEY');

export const rlsEnv: RlsEnv | null =
  url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null;

export const MISSING_ENV_MESSAGE = [
  'The RLS suite needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
  'Set them, apply the migrations (pnpm db:migrate), then run pnpm test:rls.',
].join('\n');

/** For use inside hooks and tests, which do not run when the suite is skipped. */
export function getRlsEnv(): RlsEnv {
  if (!rlsEnv) {
    throw new Error(MISSING_ENV_MESSAGE);
  }
  return rlsEnv;
}
