/**
 * @file Reads and validates API environment variables once at startup.
 * @module @caa/api/config/env
 * @requirement FR-01
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { z } from 'zod';

/** How requests are authenticated. `none` denies every protected request until SSO is added. */
export const AuthMode = {
  None: 'none',
  Dev: 'dev',
} as const;

/** Union of every {@link AuthMode} value. */
export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

/** `DEV_AUTH_TOKENS`: a JSON object from opaque token to the synthetic SSO identity it signs in as. */
const DevTokenMapSchema = z.record(
  z.string().min(1),
  z.object({ issuer: z.string().min(1), subject: z.string().min(1) }),
);

/**
 * Parses a JSON string, reporting malformed JSON as a validation issue without echoing the value.
 *
 * @param raw - Raw environment value.
 * @param context - Zod refinement context.
 * @returns The parsed value, or `z.NEVER` after adding an issue.
 */
function parseJson(raw: string, context: z.RefinementCtx): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    context.addIssue({ code: 'custom', message: 'must be valid JSON' });
    return z.NEVER;
  }
}

/** Schema for the API's environment variables. */
const ApiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    APP_VERSION: z.string().default('0.0.0'),
    DATABASE_URL: z.string().min(1),
    AUTH_MODE: z.enum(AuthMode).default(AuthMode.None),
    DEV_AUTH_TOKENS: z.string().default('{}').transform(parseJson).pipe(DevTokenMapSchema),
  })
  // SECURITY: dev tokens are guessable shortcuts, so production refuses to start with them.
  .refine((env) => !(env.NODE_ENV === 'production' && env.AUTH_MODE === AuthMode.Dev), {
    message: 'AUTH_MODE=dev is not allowed when NODE_ENV=production',
    path: ['AUTH_MODE'],
  });

/** Validated API configuration. */
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Parses environment variables, failing fast on invalid values.
 *
 * @param source - Raw environment, usually `process.env`.
 * @returns Validated configuration.
 * @throws {z.ZodError} When a variable is missing or invalid, or when dev auth is enabled in production.
 */
export function loadApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return ApiEnvSchema.parse(source);
}
