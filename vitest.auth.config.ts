import { defineConfig } from 'vitest/config';

/**
 * The live email-code suite.
 *
 * Separate from `vitest.config.ts` and from the RLS suite on purpose: it talks
 * to the real hosted Supabase project, creates and deletes a real auth user, and
 * asks the Auth server to mint a real one-time code. CI has no secrets, so
 * `pnpm test` must never pick it up.
 *
 *   pnpm test:auth:live    # needs SUPABASE_URL, SUPABASE_ANON_KEY,
 *                          # SUPABASE_SERVICE_ROLE_KEY and applied migrations
 *
 * Without those variables the suite skips cleanly and exits 0.
 *
 * What this proves: everything the app does after the code arrives — verify,
 * session, profile, refresh, sign out. What it does not prove: that the code
 * email is actually delivered. Delivery depends on SMTP being configured on the
 * project and can only be shown by receiving the mail.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/auth/**/*.test.ts'],
    // Real Auth server round trips over the network.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    reporters: ['default'],
  },
});
