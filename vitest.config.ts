/**
 * @file Root test configuration. Every workspace with tests is a project.
 * @see docs/standards/07-testing.md
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/api', 'apps/worker', 'tests', 'scripts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/api/src/**', 'apps/worker/src/**'],
      exclude: ['**/index.ts', '**/*.test.ts', 'apps/*/src/server.ts', 'apps/*/src/main.ts'],
      thresholds: {
        'packages/engine/src/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
        'packages/domain/src/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
