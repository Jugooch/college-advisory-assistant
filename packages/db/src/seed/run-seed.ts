/**
 * @file Entry point for `pnpm --filter @caa/db db:seed`. Seeds synthetic local dev data.
 * @module @caa/db/seed/run-seed
 * @requirement FR-01
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import pino from 'pino';

import * as schema from '../schema';
import { runDevSeed } from './dev-seed-command';
import { DEV_SEED_PLAN } from './dev-seed-plan';

const logger = pino({ name: 'db-seed' });

try {
  await runDevSeed({
    env: process.env,
    plan: DEV_SEED_PLAN,
    openDatabase: (connectionString) => {
      const pool = new pg.Pool({ connectionString });
      return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
    },
    logger,
  });
} catch (error) {
  // SECURITY: only the error name is logged; driver messages can echo connection details.
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  logger.error({ errorName }, 'dev seed failed');
  process.exitCode = 1;
}
