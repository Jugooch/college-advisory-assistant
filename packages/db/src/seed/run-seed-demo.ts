/**
 * @file Entry point for `pnpm --filter @caa/db db:seed:demo`. Seeds the dev data plus the demo
 *   personas.
 * @module @caa/db/seed/run-seed-demo
 * @requirement FR-01
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import pino from 'pino';

import * as schema from '../schema';
import { runDevSeed } from './dev-seed-command';
import { buildDemoSeedPlan } from './dev-seed-demo-plan';

const logger = pino({ name: 'db-seed-demo' });

try {
  await runDevSeed({
    env: process.env,
    // NOTE: the one clock reading of the run, as in `db:seed`.
    plan: buildDemoSeedPlan(new Date()),
    openDatabase: (connectionString) => {
      const pool = new pg.Pool({ connectionString });
      return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
    },
    logger,
  });
} catch (error) {
  // SECURITY: only the error name is logged; driver messages can echo connection details.
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  logger.error({ errorName }, 'demo seed failed');
  process.exitCode = 1;
}
