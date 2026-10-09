/**
 * @file Runs the local database reset: refuses anything but a local, non-production database
 *   before it connects, then wipes and migrates. Logs a constant message only.
 * @module @caa/db/seed/reset-command
 * @requirement NFR-05
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { z } from 'zod';

import type { SeedDatabase, SeedLogger } from './dev-seed-command';
import { resetDatabase } from './reset-database';

/** Hosts a reset may target. Anything else is treated as someone else's database. */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);

const ResetEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
});

/** Thrown when a reset is asked of a database it must never touch. The message says why. */
export class ResetRefusedError extends Error {
  /**
   * Creates the error.
   *
   * @param reason - Why the reset was refused; never contains the connection string.
   */
  constructor(reason: string) {
    super(`Refusing to reset the database: ${reason}`);
    this.name = 'ResetRefusedError';
  }
}

/** Dependencies of {@link runDevReset}. */
export interface DevResetDependencies {
  readonly env: NodeJS.ProcessEnv;
  readonly openDatabase: (connectionString: string) => SeedDatabase;
  readonly logger: SeedLogger;
}

/**
 * Checks that the reset may run, before anything connects.
 *
 * @param env - Process environment.
 * @returns The validated connection string.
 * @throws {ResetRefusedError} When `NODE_ENV` is production, or the host is not local.
 * @throws {z.ZodError} When `DATABASE_URL` is missing or `NODE_ENV` is unknown.
 */
export function assertResetAllowed(env: NodeJS.ProcessEnv): string {
  // SECURITY: a destructive command; every refusal happens before a connection is opened.
  if (env.NODE_ENV === 'production') {
    throw new ResetRefusedError('NODE_ENV is production');
  }
  const parsed = ResetEnvSchema.parse(env);
  let host: string;
  try {
    host = new URL(parsed.DATABASE_URL).hostname;
  } catch {
    throw new ResetRefusedError('DATABASE_URL is not a valid URL, so its host cannot be checked');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new ResetRefusedError('DATABASE_URL host is not localhost or 127.0.0.1');
  }
  return parsed.DATABASE_URL;
}

/**
 * Wipes and migrates the local database, then closes it.
 *
 * @param dependencies - Environment, database opener, and logger.
 * @throws {ResetRefusedError} When the guard refuses; nothing is opened or written.
 * @throws {z.ZodError} When `DATABASE_URL` is missing or `NODE_ENV` is unknown.
 */
export async function runDevReset(dependencies: DevResetDependencies): Promise<void> {
  const connectionString = assertResetAllowed(dependencies.env);
  const database = dependencies.openDatabase(connectionString);
  try {
    await resetDatabase(database.db);
    dependencies.logger.info({}, 'local database reset and migrated');
  } finally {
    await database.close();
  }
}
