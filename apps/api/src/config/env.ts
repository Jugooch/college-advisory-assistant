/**
 * @file Reads and validates API environment variables once at startup.
 * @module @caa/api/config/env
 */
import { z } from 'zod';

/** Schema for the API's environment variables. */
const ApiEnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  APP_VERSION: z.string().default('0.0.0'),
});

/** Validated API configuration. */
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Parses environment variables, failing fast on invalid values.
 *
 * @param source - Raw environment, usually `process.env`.
 * @returns Validated configuration.
 * @throws {z.ZodError} When a variable is present but invalid.
 */
export function loadApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return ApiEnvSchema.parse(source);
}
