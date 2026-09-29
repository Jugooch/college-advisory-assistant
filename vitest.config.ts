/**
 * @file Root test configuration. Every workspace with tests is a unit project; files named
 * `*.integration.test.ts` form a separate `integration` project that runs against PostgreSQL.
 * @see docs/standards/07-testing.md
 */
import { readdirSync } from 'node:fs';

import { configDefaults, defineConfig } from 'vitest/config';

import {
  INTEGRATION_TEST_PATTERN,
  resolveIntegrationMode,
} from './scripts/lib/integration-database.mjs';

/** Workspaces whose unit tests run without a database. */
const UNIT_WORKSPACES = [
  ...readdirSync('packages', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}`),
  'apps/api',
  'apps/worker',
  'tests',
  'scripts',
  'config',
];

/**
 * Workspaces with their own Vitest config, loaded as-is. The web app needs its JSX runtime and
 * `@/` alias, and has no integration tests.
 */
const CONFIGURED_WORKSPACES = ['apps/web/vitest.config.ts'];

/**
 * Per-test timeouts, in ms, for workspaces whose tests scan the repository. The `tests`
 * holdout-isolation check reads every source file and ran past the 5 s default in combined
 * runs. Other workspaces keep the default.
 */
const WORKSPACE_TEST_TIMEOUTS: Partial<Record<string, number>> = { tests: 15_000 };

const integration = resolveIntegrationMode(process.env);
if (integration.mode === 'fail') {
  throw new Error(integration.reason);
}
const isIntegrationSkipped = integration.mode === 'skip';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      ...UNIT_WORKSPACES.map((root) => ({
        test: {
          name: root,
          root,
          exclude: [...configDefaults.exclude, INTEGRATION_TEST_PATTERN],
          ...(root in WORKSPACE_TEST_TIMEOUTS
            ? { testTimeout: WORKSPACE_TEST_TIMEOUTS[root] }
            : {}),
        },
      })),
      ...CONFIGURED_WORKSPACES,
      {
        test: {
          name: isIntegrationSkipped
            ? 'integration (skipped: DATABASE_URL not set)'
            : 'integration',
          include: UNIT_WORKSPACES.map((root) => `${root}/${INTEGRATION_TEST_PATTERN}`),
          // NOTE: all files share the per-run database, so they run one at a time.
          fileParallelism: false,
          // NOTE: a pattern that matches no test name reports every integration test as skipped.
          globalSetup: ['scripts/test/integration-global-setup.mjs'],
          ...(isIntegrationSkipped ? { testNamePattern: /(?!)/ } : {}),
        },
      },
    ],
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
