/**
 * @file Runs the dev revise command: refuses production, parses the flag, publishes one newer
 *   synthetic revision, and logs counts only.
 * @module @caa/db/seed/revise-command
 * @requirement FR-11
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { z } from 'zod';

import { type SeedDatabase, type SeedLogger, SeedRefusedError } from './dev-seed-command';
import type { ReviseRequest } from './dev-seed-revision-plan';
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
    super('Usage: db:seed:revise [--student [<sourceStudentId>] | --sections]');
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
 * Reads the flags that pick the revision.
 *
 * @param argv - Arguments after the script name; a leading `--` is ignored.
 * @returns `sections` for `--sections`; `student` for `--student` or no flag, with the source
 *   student ID when `--student` is followed by one.
 * @throws {ReviseUsageError} On any other argument, both flags, or a value on `--sections`.
 */
export function parseReviseRequest(argv: readonly string[]): ReviseRequest {
  // NOTE: pnpm forwards the literal `--` of `pnpm run script -- --flag` to the script.
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  if (args.length === 0) {
    return { target: 'student' };
  }
  const [flag, value, ...rest] = args;
  if (rest.length > 0) {
    throw new ReviseUsageError();
  }
  if (flag === '--sections' && value === undefined) {
    return { target: 'sections' };
  }
  if (flag === '--student') {
    if (value === undefined) {
      return { target: 'student' };
    }
    if (!value.startsWith('--') && value.length > 0) {
      return { target: 'student', sourceStudentId: value };
    }
  }
  throw new ReviseUsageError();
}

/**
 * Publishes one newer synthetic revision, then closes the database.
 *
 * @param dependencies - Environment, arguments, run time, database opener, and logger.
 * @returns What the run did.
 * @throws {SeedRefusedError} When `NODE_ENV` is `production`; nothing is opened or written.
 * @throws {ReviseUsageError} On a bad argument; nothing is opened.
 * @throws {ReviseUnknownStudentError} When the student is not in the seed; nothing is written.
 * @throws {z.ZodError} When `DATABASE_URL` is missing or `NODE_ENV` is unknown.
 */
export async function runDevRevise(dependencies: DevReviseDependencies): Promise<ReviseResult> {
  // SECURITY: checked first, so production never reaches the database.
  if (dependencies.env.NODE_ENV === 'production') {
    throw new SeedRefusedError();
  }
  const request = parseReviseRequest(dependencies.argv);
  const env = ReviseEnvSchema.parse(dependencies.env);
  const database = dependencies.openDatabase(env.DATABASE_URL);
  try {
    const result = await reviseSliceSources(database.db, request, dependencies.now);
    dependencies.logger.info({ ...result }, 'dev source revision applied');
    return result;
  } finally {
    await database.close();
  }
}
