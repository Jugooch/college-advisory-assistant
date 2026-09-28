/**
 * @file Reads and validates API environment variables once at startup.
 * @module @caa/api/config/env
 * @requirement FR-01
 * @requirement FR-04
 * @see docs/standards/09-errors-logging-and-security.md
 * @see docs/planning/07-system-architecture-and-design.md
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
 * Default `AUDIT_RECORD_MAX_SKEW_MS`: one hour. The record and the audit it ran against normally
 * carry the same source time, so an hour only absorbs clock and export lag between the two
 * systems. It is far below the 17-day gap of the seeded stale scenario (SYN-000002).
 */
export const DEFAULT_AUDIT_RECORD_MAX_SKEW_MS = 3_600_000;

/** Largest accepted `AUDIT_RECORD_MAX_SKEW_MS`: seven days. */
export const MAX_AUDIT_RECORD_MAX_SKEW_MS = 604_800_000;

/**
 * `AUDIT_RECORD_MAX_SKEW_MS`: the partner-specific maximum skew, in milliseconds, between the
 * pinned student record and the audit's record time (planning/07 §Consistency model). Digits
 * only, so an empty or fractional value fails instead of coercing to 0 or rounding.
 */
const AuditRecordMaxSkewSchema = z
  .string()
  .regex(/^\d+$/, 'must be a whole number of milliseconds')
  .default(String(DEFAULT_AUDIT_RECORD_MAX_SKEW_MS))
  .transform(Number)
  // SAFETY: a very wide skew would let an audit of an old record read as current, which
  // quietly disables the staleness check, so startup refuses it.
  .pipe(z.number().int().min(0).max(MAX_AUDIT_RECORD_MAX_SKEW_MS));

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
    AUDIT_RECORD_MAX_SKEW_MS: AuditRecordMaxSkewSchema,
    /**
     * Published ruleset version the course checks read the policy and prerequisite rules at,
     * for example `demo-2026.1`. No default: a guessed version would check courses against
     * rules nobody approved. Required in production; unset elsewhere, course checks fail closed.
     */
    ACTIVE_RULESET_VERSION: z.string().trim().min(1).optional(),
  })
  // SECURITY: dev tokens are guessable shortcuts, so production refuses to start with them.
  .refine((env) => !(env.NODE_ENV === 'production' && env.AUTH_MODE === AuthMode.Dev), {
    message: 'AUTH_MODE=dev is not allowed when NODE_ENV=production',
    path: ['AUTH_MODE'],
  })
  // SAFETY: course checks can't run without a ruleset, so production refuses to start without
  // one instead of failing every check at request time (planning/08 §Rule lifecycle).
  .refine((env) => env.NODE_ENV !== 'production' || env.ACTIVE_RULESET_VERSION !== undefined, {
    message: 'ACTIVE_RULESET_VERSION is required when NODE_ENV=production',
    path: ['ACTIVE_RULESET_VERSION'],
  });

/** Validated API configuration. */
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Parses environment variables, failing fast on invalid values.
 *
 * @param source - Raw environment, usually `process.env`.
 * @returns Validated configuration.
 * @throws {z.ZodError} When a variable is missing or invalid, when dev auth is enabled or the
 *   active ruleset is missing in production, or when the audit skew isn't a whole number of
 *   milliseconds up to seven days.
 */
export function loadApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return ApiEnvSchema.parse(source);
}
