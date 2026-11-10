import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/lib/test-setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // Run tests sequentially to avoid database isolation issues
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'prisma/**', '**/*.test.ts', '**/*.config.ts'],
      // Enforced in CI via `pnpm --filter api test:coverage` (vitest exits non-zero when
      // a metric falls below its floor). Statements/functions/lines are gated at the
      // project's 80% target (currently ~87%). Branch coverage sits at ~75%, so it is
      // held at a 70% regression floor for now — raise to 80 once branch coverage is
      // backfilled alongside the Phase 7 API-key scope-enforcement work.
      thresholds: {
        statements: 80,
        functions: 80,
        lines: 80,
        branches: 70,
      },
    },
  },
})
