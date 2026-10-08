/**
 * @file Parses the `planId` query parameter before it becomes part of an API path.
 * @module @caa/web/features/advisor-cases/utils/plan-id-query
 * @requirement FR-11
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { type PlanId, PlanIdSchema } from '@caa/domain';

/**
 * Reads a plan ID from a query value.
 *
 * @param value - The raw `planId` query value.
 * @returns The parsed ID, or `null` when it is absent, repeated, or not a plan ID.
 */
export function readPlanIdQuery(value: string | readonly string[] | undefined): PlanId | null {
  // SECURITY: parse before the value becomes a path segment, so input such as `..` can never
  // reach a different API route (standard 09: parse external input with Zod).
  const parsed = PlanIdSchema.safeParse(typeof value === 'string' ? value.trim() : value);
  return parsed.success ? parsed.data : null;
}
