/**
 * @file Entry point for `pnpm --filter @caa/db db:reset`. Wipes and migrates the local database.
 * @module @caa/db/seed/run-reset
 * @requirement NFR-05
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import pino from 'pino';

import * as schema from '../schema';
import { ResetRefusedError, runDevReset } from './reset-command';

const logger = pino({ name: 'db-reset' });

try {
  await runDevReset({
    env: process.env,
    openDatabase: (connectionString) => {
      const pool = new pg.Pool({ connectionString });
      return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
    },
    logger,
  });
} catch (error) {
  // SECURITY: only the error name (and our own refusal reason) is logged; driver messages can
  // echo connection details.
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  logger.error(
    { errorName, reason: error instanceof ResetRefusedError ? error.message : undefined },
    'database reset failed',
  );
  process.exitCode = 1;
}
