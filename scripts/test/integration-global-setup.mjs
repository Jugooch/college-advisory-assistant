/**
 * @file Vitest global setup for database integration tests: creates a fresh database for the run,
 * applies the Drizzle migrations to it, and drops it afterwards. Without DATABASE_URL it reports
 * the skip locally and fails in CI.
 * @module scripts/test/integration-global-setup
 * @see docs/standards/07-testing.md
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import pg from 'pg';

import {
  buildTestDatabaseName,
  quoteTestDatabaseName,
  resolveIntegrationMode,
  withDatabaseName,
} from '../lib/integration-database.mjs';

/** The Drizzle journal that exists once the db package has generated a migration. */
const MIGRATION_JOURNAL = 'packages/db/migrations/meta/_journal.json';

/**
 * Runs one statement against the server's existing database.
 *
 * @param {string} serverUrl - Connection URL from DATABASE_URL.
 * @param {string} sql - Statement to run.
 * @returns {Promise<void>} Resolves when the statement completes.
 */
async function runAdminStatement(serverUrl, sql) {
  const client = new pg.Client({ connectionString: serverUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Applies the db package's migrations to the test database with its own `db:migrate` script.
 *
 * @param {string} testDatabaseUrl - Connection URL of the fresh database.
 */
function applyMigrations(testDatabaseUrl) {
  if (!existsSync(MIGRATION_JOURNAL)) {
    console.log('[integration] No Drizzle migrations generated yet; the test database is empty.');
    return;
  }
  const result = spawnSync('pnpm', ['--filter', '@caa/db', 'run', 'db:migrate'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`Applying Drizzle migrations failed (exit code ${String(result.status)}).`);
  }
}

/**
 * Creates and migrates the per-run database, and points DATABASE_URL at it for the test workers.
 * Reports the skip instead when there is no database outside CI.
 *
 * @param {{ provide: (key: string, value: unknown) => void }} project - The Vitest test project.
 * @returns {Promise<(() => Promise<void>) | undefined>} Teardown that drops the per-run database,
 *   or nothing when the tests are skipped.
 */
export async function setup(project) {
  const resolved = resolveIntegrationMode(process.env);
  if (resolved.mode === 'skip') {
    console.warn(`[integration] ${resolved.reason} Set it to run them (see infra/env.example).`);
    return undefined;
  }
  if (resolved.mode === 'fail') {
    throw new Error(resolved.reason);
  }
  const serverUrl = resolved.databaseUrl;
  const databaseName = buildTestDatabaseName(Date.now(), process.pid);
  const quotedName = quoteTestDatabaseName(databaseName);
  const testDatabaseUrl = withDatabaseName(serverUrl, databaseName);

  await runAdminStatement(serverUrl, `CREATE DATABASE ${quotedName}`);
  console.log(`[integration] Created test database ${databaseName}.`);
  try {
    applyMigrations(testDatabaseUrl);
  } catch (error) {
    await runAdminStatement(serverUrl, `DROP DATABASE IF EXISTS ${quotedName} WITH (FORCE)`);
    throw error;
  }

  // NOTE: workers start after global setup, so they inherit the per-run URL, never the server's.
  process.env.DATABASE_URL = testDatabaseUrl;
  project.provide('integrationDatabaseUrl', testDatabaseUrl);

  return async () => {
    await runAdminStatement(serverUrl, `DROP DATABASE IF EXISTS ${quotedName} WITH (FORCE)`);
    process.env.DATABASE_URL = serverUrl;
    console.log(`[integration] Dropped test database ${databaseName}.`);
  };
}
