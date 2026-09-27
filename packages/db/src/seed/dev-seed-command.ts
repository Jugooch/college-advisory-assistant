/**
 * @file Runs the dev seed: refuses production, writes the plan, and logs counts only.
 * @module @caa/db/seed/dev-seed-command
 * @requirement FR-01
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { z } from 'zod';

import type { Database } from '../client';
import type { DevSeedPlan } from './dev-seed-plan';
import { type SeedCounts, seedDevData } from './seed-dev-data';

/** Environment variables the seed reads. */
const SeedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
});

/** Thrown when the seed is started with `NODE_ENV=production`. */
export class SeedRefusedError extends Error {
  /** Creates the error. */
  constructor() {
    super('Refusing to seed synthetic dev data when NODE_ENV is production');
    this.name = 'SeedRefusedError';
  }
}

/** Minimal structured logger the seed reports through. */
export interface SeedLogger {
  /**
   * Logs a routine event.
   *
   * @param fields - Counts only; never identifiers.
   * @param message - Short, lower-case, constant message.
   */
  info(fields: Readonly<Record<string, unknown>>, message: string): void;
}

/** A database handle plus the function that closes its pool. */
export interface SeedDatabase {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

/** Dependencies of {@link runDevSeed}. */
export interface DevSeedDependencies {
  readonly env: NodeJS.ProcessEnv;
  readonly plan: DevSeedPlan;
  readonly openDatabase: (connectionString: string) => SeedDatabase;
  readonly logger: SeedLogger;
}

/**
 * Seeds the synthetic dev data, then closes the database.
 *
 * @param dependencies - Environment, plan, database opener, and logger.
 * @returns How many records of each kind were written.
 * @throws {SeedRefusedError} When `NODE_ENV` is `production`; nothing is opened or written.
 * @throws {z.ZodError} When `DATABASE_URL` is missing or `NODE_ENV` is not a known value.
 */
export async function runDevSeed(dependencies: DevSeedDependencies): Promise<SeedCounts> {
  // SECURITY: checked before parsing anything else, so production never reaches the database.
  if (dependencies.env.NODE_ENV === 'production') {
    throw new SeedRefusedError();
  }
  const env = SeedEnvSchema.parse(dependencies.env);
  const database = dependencies.openDatabase(env.DATABASE_URL);
  try {
    const counts = await seedDevData(database.db, dependencies.plan);
    // SECURITY: counts only, so no synthetic identifier ever lands in a log.
    dependencies.logger.info({ ...counts }, 'dev seed applied');
    return counts;
  } finally {
    await database.close();
  }
}
