import { defineConfig } from 'vitest/config';

/**
 * The Row Level Security suite.
 *
 * Separate from `vitest.config.ts` on purpose: these tests talk to a real
 * Supabase project, need real credentials, and create and delete real auth
 * users. CI has no secrets, so `pnpm test` must never pick them up.
 *
 *   pnpm test:rls        # needs SUPABASE_URL, SUPABASE_ANON_KEY,
 *                        # SUPABASE_SERVICE_ROLE_KEY and applied migrations
 *
 * Without those variables the suite skips cleanly and exits 0.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    // A real project over the network: give setup room, and never run two
    // files at once — each one builds and tears down its own fixtures.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    reporters: ['default'],
  },
});
