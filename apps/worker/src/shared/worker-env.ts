/**
 * @file Reads and validates worker environment variables once at startup.
 * @module @caa/worker/shared/worker-env
 */
import { z } from 'zod';

/** Schema for the worker's environment variables. */
const WorkerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  /**
   * Largest share of invalid rows, in whole percent, that a roster batch may have and still
   * publish its valid rows. Above it the whole batch is quarantined. Operating proposal, not an
   * approved institutional value. An empty value counts as unset.
   */
  ROSTER_MAX_INVALID_ROW_PERCENT: z.preprocess(
    // SAFETY: `Number('')` is 0, which would quarantine every batch with one invalid row.
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().min(0).max(100).default(5),
  ),
});

/** Validated worker configuration. */
export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

/**
 * Parses environment variables, failing fast on missing or invalid values.
 *
 * @param source - Raw environment, usually `process.env`.
 * @returns Validated configuration.
 * @throws {z.ZodError} When `DATABASE_URL` is missing or a variable is invalid.
 */
export function loadWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  return WorkerEnvSchema.parse(source);
}
