/**
 * @file Playwright configuration for the browser end-to-end tests (ADR-0016): Chromium only, one
 *   worker, no retries, a trace and a screenshot kept on failure, and a web server that starts the
 *   API and the web app in development mode with dev auth and the demo model. The database named
 *   by `DATABASE_URL` must already be migrated and seeded with `db:seed`.
 * @module @caa/tests/e2e/playwright-config
 * @requirement T08
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/** The repository root, where `pnpm --filter` finds the workspaces. */
const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const API_URL = 'http://localhost:4000';
const WEB_URL = 'http://localhost:3000';

/** The database used when `DATABASE_URL` isn't set; matches `infra/docker-compose.yml`. */
const DEFAULT_DATABASE_URL = 'postgres://caa:caa@localhost:5432/caa';

/**
 * The synthetic dev identities, copied from `DEV_AUTH_TOKENS` in `infra/env.example`. Tokens are
 * opaque and carry no secret; the API only honors them when `AUTH_MODE=dev`.
 */
const DEV_AUTH_TOKENS = JSON.stringify({
  'dev-token-admin': { issuer: 'https://idp.synthetic.example', subject: 'synthetic-admin-001' },
  'dev-token-advisor': {
    issuer: 'https://idp.synthetic.example',
    subject: 'synthetic-advisor-001',
  },
  'dev-token-advisor-2': {
    issuer: 'https://idp.synthetic.example',
    subject: 'synthetic-advisor-002',
  },
  'dev-token-student': {
    issuer: 'https://idp.synthetic.example',
    subject: 'synthetic-student-001',
  },
});

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'corepack pnpm --filter @caa/api dev',
      cwd: REPOSITORY_ROOT,
      url: `${API_URL}/v1/health`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
        API_PORT: '4000',
        AUTH_MODE: 'dev',
        CONVERSATION_MODEL: 'demo',
        DEV_AUTH_TOKENS,
      },
    },
    {
      command: 'corepack pnpm --filter @caa/web dev',
      cwd: REPOSITORY_ROOT,
      url: `${WEB_URL}/dev/sign-in`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 180_000,
      env: { NODE_ENV: 'development', API_BASE_URL: API_URL },
    },
  ],
});
