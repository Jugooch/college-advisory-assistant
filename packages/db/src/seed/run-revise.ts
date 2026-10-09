/**
 * @file Entry point for `pnpm --filter @caa/db db:seed:revise`. Publishes a newer synthetic
 *   source revision for a seeded student (the slice student unless one is named) so a saved draft
 *   becomes stale.
 * @module @caa/db/seed/run-revise
 * @requirement FR-11
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import pino from 'pino';

import * as schema from '../schema';
import { runDevRevise } from './revise-command';

const logger = pino({ name: 'db-seed-revise' });

try {
  await runDevRevise({
    env: process.env,
    argv: process.argv.slice(2),
    // NOTE: the one clock reading of the run; a later run is always a newer revision.
    now: new Date(),
    openDatabase: (connectionString) => {
      const pool = new pg.Pool({ connectionString });
      return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
    },
    logger,
  });
} catch (error) {
  // SECURITY: only the error name is logged; driver messages can echo connection details.
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  logger.error({ errorName }, 'dev source revision failed');
  process.exitCode = 1;
}
