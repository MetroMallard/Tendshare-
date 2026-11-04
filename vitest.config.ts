import { defineConfig } from 'vitest/config';

/**
 * Tests run from the repo root, over the pure TypeScript in every workspace.
 * Anything that renders React Native components is exercised in the app
 * itself or in the component gallery, not here.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.expo/**', '**/dist/**'],
    reporters: ['default'],
  },
});
