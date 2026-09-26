/**
 * @file Decides whether database integration tests run, skip, or fail, and names the per-run database.
 * @module scripts/lib/integration-database
 * @see docs/standards/07-testing.md
 */

/** File pattern that marks a test as a database integration test. */
export const INTEGRATION_TEST_PATTERN = '**/*.integration.test.{ts,mjs}';

/** Prefix of every throwaway database created for a test run. */
export const TEST_DATABASE_PREFIX = 'caa_test_';

/**
 * Resolves how integration tests behave in the current environment.
 * CI must never skip them silently, so a missing URL there is a failure.
 *
 * @param {Record<string, string | undefined>} env - Process environment.
 * @returns {{ mode: 'run', databaseUrl: string } | { mode: 'skip' | 'fail', reason: string }}
 *   The mode, with the server URL when tests run or the reason when they don't.
 */
export function resolveIntegrationMode(env) {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return { mode: 'run', databaseUrl };
  }
  if (env.CI === 'true' || env.CI === '1') {
    return {
      mode: 'fail',
      reason: 'DATABASE_URL is not set in CI; database integration tests must run there.',
    };
  }
  return {
    mode: 'skip',
    reason: 'DATABASE_URL is not set; database integration tests are skipped.',
  };
}

/**
 * Builds a unique, SQL-safe database name for one test run.
 *
 * @param {number} timestamp - Milliseconds since the epoch when the run started.
 * @param {number} processId - Process ID of the test runner.
 * @returns {string} A lower-case identifier such as `caa_test_1700000000000_42`.
 */
export function buildTestDatabaseName(timestamp, processId) {
  return `${TEST_DATABASE_PREFIX}${Math.trunc(timestamp)}_${Math.trunc(processId)}`;
}

/**
 * Points a PostgreSQL connection URL at another database on the same server.
 *
 * @param {string} databaseUrl - Connection URL of the server's existing database.
 * @param {string} databaseName - Database to connect to instead.
 * @returns {string} The rewritten URL; credentials, host, and query are unchanged.
 */
export function withDatabaseName(databaseUrl, databaseName) {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/**
 * Quotes a generated database name for use in DDL, rejecting anything unexpected.
 *
 * @param {string} databaseName - Name produced by `buildTestDatabaseName`.
 * @returns {string} The double-quoted identifier.
 */
export function quoteTestDatabaseName(databaseName) {
  if (!new RegExp(`^${TEST_DATABASE_PREFIX}[0-9_]+$`).test(databaseName)) {
    throw new Error(`Refusing to use unexpected test database name: ${databaseName}`);
  }
  return `"${databaseName}"`;
}
