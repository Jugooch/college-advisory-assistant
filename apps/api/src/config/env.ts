/**
 * @file Reads and validates API environment variables once at startup.
 * @module @caa/api/config/env
 * @requirement FR-01
 * @requirement FR-04
 * @requirement NFR-07
 * @requirement FR-14
 * @requirement NFR-05
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 * @see docs/standards/09-errors-logging-and-security.md
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { z } from 'zod';

import { MAX_SOLVER_WORK_CAP } from '@caa/api-contract';
import { AuthMode } from '@caa/domain';

// NOTE: the domain enum, so `/v1/health` reports exactly the mode this validates (#151).
// `none` denies every protected request until SSO is added.
export { AuthMode };

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
 * Default `ACADEMIC_SOURCE_MAX_AGE_MS` outside production: 24 hours, the proposed maximum age of
 * a transcript, program, or audit before it is historical only (planning/09 §Proposed freshness
 * policies). Production has no default and must set it.
 */
export const DEV_ACADEMIC_SOURCE_MAX_AGE_MS = 86_400_000;

/** Largest accepted `ACADEMIC_SOURCE_MAX_AGE_MS`: seven days. */
export const MAX_ACADEMIC_SOURCE_MAX_AGE_MS = 604_800_000;

/**
 * `ACADEMIC_SOURCE_MAX_AGE_MS`: how old, in milliseconds, the pinned student record and the
 * audit's record time may be for course checks. Digits only, so an empty or fractional value
 * fails instead of coercing to 0 or rounding.
 */
const AcademicSourceMaxAgeSchema = z
  .string()
  .regex(/^\d+$/, 'must be a whole number of milliseconds')
  .transform(Number)
  // SAFETY: a very long maximum age would let weeks-old records validate plans, so startup
  // refuses it (planning/09 §Proposed freshness policies).
  .pipe(z.number().int().min(0).max(MAX_ACADEMIC_SOURCE_MAX_AGE_MS))
  .optional();

/**
 * Default `SCHEDULE_SOLVER_WORK_CAP` in every environment: an engineering calibration, not
 * institutional policy, sized to finish the worst S4 search (ADR-0010 §1).
 */
export const DEFAULT_SCHEDULE_SOLVER_WORK_CAP = 3_000_000;

/**
 * `SCHEDULE_SOLVER_WORK_CAP`: how many attempts to add a bundle the schedule solver may make
 * per request (ADR-0010 §1). Digits only, so an empty or fractional value fails instead of
 * coercing to 0 or rounding.
 */
const ScheduleSolverWorkCapSchema = z
  .string()
  .regex(/^\d+$/, 'must be a whole number of work units')
  .default(String(DEFAULT_SCHEDULE_SOLVER_WORK_CAP))
  .transform(Number)
  // NOTE: the ceiling is the contract's, so a pinned cap always fits the response. Raising it
  // needs an ADR-0010 amendment with a new measurement.
  .pipe(z.number().int().min(1).max(MAX_SOLVER_WORK_CAP));

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

/** `CONVERSATION_MODEL`: which model answers a conversation turn; `off` is the kill switch (ADR-0015 §1). */
export const ConversationModelMode = { Off: 'off', Demo: 'demo', Claude: 'claude' } as const;

/** Union of every {@link ConversationModelMode} value. */
export type ConversationModelMode =
  (typeof ConversationModelMode)[keyof typeof ConversationModelMode];

/** The only model ids the Claude adapter may call; any other value is refused (ADR-0015 §1). */
export const CONVERSATION_MODEL_IDS = ['claude-haiku-5-5', 'claude-sonnet-5-5'] as const;

/** Default `CONVERSATION_MODEL_ID`. */
export const DEFAULT_CONVERSATION_MODEL_ID = 'claude-haiku-5-5';

/** Most turns sent to the model (ADR-0015 §1). */
export const MAX_CONVERSATION_HISTORY_TURNS = 20;

/** Default `CONVERSATION_HISTORY_TURNS`. */
export const DEFAULT_CONVERSATION_HISTORY_TURNS = 8;

/** Default `CONVERSATION_RATE_LIMIT`: student turns per rolling 10 minutes. */
export const DEFAULT_CONVERSATION_RATE_LIMIT = 20;

/** Largest accepted `CONVERSATION_RATE_LIMIT`. */
export const MAX_CONVERSATION_RATE_LIMIT = 1000;

/**
 * Builds a schema for a whole number in a range, defaulted. Digits only, so an empty or
 * fractional value fails instead of coercing to 0 or rounding.
 *
 * @param fallback - Default when unset.
 * @param min - Smallest accepted value.
 * @param max - Largest accepted value.
 * @returns The schema.
 */
function boundedWholeNumber(fallback: number, min: number, max: number) {
  return z
    .string()
    .regex(/^\d+$/, 'must be a whole number')
    .default(String(fallback))
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
}

/** The conversation model variables, shared by the API schema and the manual eval helper. */
const ConversationModelFields = {
  CONVERSATION_MODEL: z.enum(ConversationModelMode).default(ConversationModelMode.Off),
  CONVERSATION_MODEL_ID: z.enum(CONVERSATION_MODEL_IDS).default(DEFAULT_CONVERSATION_MODEL_ID),
  /** A secret: read here and nowhere else, and never logged. */
  ANTHROPIC_API_KEY: z.string().trim().min(1).optional(),
  CONVERSATION_PROVIDER_APPROVAL_REF: z.string().trim().min(1).optional(),
  CONVERSATION_HISTORY_TURNS: boundedWholeNumber(
    DEFAULT_CONVERSATION_HISTORY_TURNS,
    0,
    MAX_CONVERSATION_HISTORY_TURNS,
  ),
  CONVERSATION_RATE_LIMIT: boundedWholeNumber(
    DEFAULT_CONVERSATION_RATE_LIMIT,
    1,
    MAX_CONVERSATION_RATE_LIMIT,
  ),
};

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
    ACADEMIC_SOURCE_MAX_AGE_MS: AcademicSourceMaxAgeSchema,
    SCHEDULE_SOLVER_WORK_CAP: ScheduleSolverWorkCapSchema,
    ...ConversationModelFields,
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
  })
  // SAFETY: the maximum source age is a partner decision, so production states it explicitly;
  // only development and tests fall back to the documented 24 hours.
  .refine((env) => env.NODE_ENV !== 'production' || env.ACADEMIC_SOURCE_MAX_AGE_MS !== undefined, {
    message: 'ACADEMIC_SOURCE_MAX_AGE_MS is required when NODE_ENV=production',
    path: ['ACADEMIC_SOURCE_MAX_AGE_MS'],
  })
  // SAFETY: the demo model is a scripted stand-in, so production never serves it as an advisor.
  .refine(
    (env) =>
      !(env.NODE_ENV === 'production' && env.CONVERSATION_MODEL === ConversationModelMode.Demo),
    {
      message: 'CONVERSATION_MODEL=demo is not allowed when NODE_ENV=production',
      path: ['CONVERSATION_MODEL'],
    },
  )
  // SAFETY: the claude model needs its key to run at all.
  .refine(
    (env) =>
      env.CONVERSATION_MODEL !== ConversationModelMode.Claude ||
      env.ANTHROPIC_API_KEY !== undefined,
    {
      message: 'ANTHROPIC_API_KEY is required when CONVERSATION_MODEL=claude',
      path: ['ANTHROPIC_API_KEY'],
    },
  )
  // SAFETY: sending records to a provider needs a recorded approval (planning/10), so production
  // refuses `claude` until the approval record is named.
  .refine(
    (env) =>
      !(
        env.NODE_ENV === 'production' &&
        env.CONVERSATION_MODEL === ConversationModelMode.Claude &&
        env.CONVERSATION_PROVIDER_APPROVAL_REF === undefined
      ),
    {
      message:
        'CONVERSATION_PROVIDER_APPROVAL_REF is required when CONVERSATION_MODEL=claude in production',
      path: ['CONVERSATION_PROVIDER_APPROVAL_REF'],
    },
  )
  .transform((env) => ({
    ...env,
    ACADEMIC_SOURCE_MAX_AGE_MS: env.ACADEMIC_SOURCE_MAX_AGE_MS ?? DEV_ACADEMIC_SOURCE_MAX_AGE_MS,
  }));

/** Validated API configuration. */
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Parses environment variables, failing fast on invalid values.
 *
 * @param source - Raw environment, usually `process.env`.
 * @returns Validated configuration.
 * @throws {z.ZodError} When a variable is missing or invalid, when dev auth is enabled or the
 *   active ruleset or the maximum source age is missing in production, or when the audit skew isn't a whole number of
 *   milliseconds up to seven days.
 */
export function loadApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return ApiEnvSchema.parse(source);
}

/** The settings the Claude adapter needs. */
export interface ClaudeModelEnv {
  readonly apiKey: string;
  readonly modelId: (typeof CONVERSATION_MODEL_IDS)[number];
}

/**
 * Reads only the Claude settings, for the manual live eval, which has no database.
 *
 * @param source - Raw environment, usually `process.env`.
 * @returns The API key and model id.
 * @throws {z.ZodError} When the key is missing or the model id isn't allowed.
 */
export function loadClaudeModelEnv(source: NodeJS.ProcessEnv): ClaudeModelEnv {
  const parsed = z
    .object({
      ...ConversationModelFields,
      ANTHROPIC_API_KEY: ConversationModelFields.ANTHROPIC_API_KEY.unwrap(),
    })
    .parse(source);
  return { apiKey: parsed.ANTHROPIC_API_KEY, modelId: parsed.CONVERSATION_MODEL_ID };
}
