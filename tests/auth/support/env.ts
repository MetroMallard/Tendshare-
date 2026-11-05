/**
 * Credentials for the live email-code suite.
 *
 * The same three values the RLS suite uses, read the same way, for the same
 * reason: the suite refuses to guess a project, and skips when it has none.
 *   SUPABASE_URL               the project URL
 *   SUPABASE_ANON_KEY          the public key — the code is verified through it
 *   SUPABASE_SERVICE_ROLE_KEY  minting the code and deleting the test user only
 */

export interface AuthEnv {
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

export const authEnv: AuthEnv | null =
  url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null;

export const MISSING_ENV_MESSAGE = [
  'The live auth suite needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
  'Set them, apply the migrations (pnpm db:migrate), then run pnpm test:auth:live.',
].join('\n');

/** For use inside hooks and tests, which do not run when the suite is skipped. */
export function getAuthEnv(): AuthEnv {
  if (!authEnv) {
    throw new Error(MISSING_ENV_MESSAGE);
  }
  return authEnv;
}
