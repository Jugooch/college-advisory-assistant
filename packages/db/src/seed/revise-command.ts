/**
 * @file Runs the dev revise command: refuses production, parses the flag, publishes one newer
 *   synthetic revision, and logs counts only.
 * @module @caa/db/seed/revise-command
 * @requirement FR-11
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { z } from 'zod';

import { type SeedDatabase, type SeedLogger, SeedRefusedError } from './dev-seed-command';
import type { ReviseTarget } from './dev-seed-revision-plan';
import { type ReviseResult, reviseSliceSources } from './revise-slice-sources';

/** Environment variables the command reads. */
const ReviseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
});

/** Thrown when the command line has an argument other than a known flag. */
export class ReviseUsageError extends Error {
  /** Creates the error. */
  constructor() {
    super('Usage: db:seed:revise [--student | --sections]');
    this.name = 'ReviseUsageError';
  }
}

/** Dependencies of {@link runDevRevise}. */
export interface DevReviseDependencies {
  readonly env: NodeJS.ProcessEnv;
  /** Command-line arguments after the script name. */
  readonly argv: readonly string[];
  /** The one clock reading of the run; the revision takes effect at this instant. */
  readonly now: Date;
  readonly openDatabase: (connectionString: string) => SeedDatabase;
  readonly logger: SeedLogger;
}

/**
 * Reads the flag that picks the revision.
 *
 * @param argv - Arguments after the script name.
 * @returns `sections` for `--sections`; `student` for `--student` or no flag.
 * @throws {ReviseUsageError} On any other argument, or both flags.
 */
export function parseReviseTarget(argv: readonly string[]): ReviseTarget {
  const flags = new Set(argv);
  const isKnown = argv.every((arg) => arg === '--student' || arg === '--sections');
  if (!isKnown || flags.size > 1) {
    throw new ReviseUsageError();
  }
  return flags.has('--sections') ? 'sections' : 'student';
}

/**
 * Publishes one newer synthetic revision, then closes the database.
 *
 * @param dependencies - Environment, arguments, run time, database opener, and logger.
 * @returns What the run did.
 * @throws {SeedRefusedError} When `NODE_ENV` is `production`; nothing is opened or written.
 * @throws {ReviseUsageError} On a bad argument; nothing is opened.
 * @throws {z.ZodError} When `DATABASE_URL` is missing or `NODE_ENV` is unknown.
 */
export async function runDevRevise(dependencies: DevReviseDependencies): Promise<ReviseResult> {
  // SECURITY: checked first, so production never reaches the database.
  if (dependencies.env.NODE_ENV === 'production') {
    throw new SeedRefusedError();
  }
  const target = parseReviseTarget(dependencies.argv);
  const env = ReviseEnvSchema.parse(dependencies.env);
  const database = dependencies.openDatabase(env.DATABASE_URL);
  try {
    const result = await reviseSliceSources(database.db, target, dependencies.now);
    dependencies.logger.info({ ...result }, 'dev source revision applied');
    return result;
  } finally {
    await database.close();
  }
}
