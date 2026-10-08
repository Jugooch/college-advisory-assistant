/**
 * @file Reads the plan ID from the route before it becomes an API path segment.
 * @module @caa/web/features/plan-drafts/utils/plan-id-param
 * @requirement FR-11
 * @see docs/standards/09-security.md
 */
import { type PlanId, PlanIdSchema } from '@caa/domain';

/**
 * Parses a plan ID from a route param.
 *
 * @param value - The raw route segment.
 * @returns The plan ID, or `null` when it isn't one.
 */
export function readPlanIdParam(value: string): PlanId | null {
  // SECURITY: parse before the value becomes a path segment, so input such as `..` can never
  // reach a different API route (standard 09: parse external input with Zod).
  const parsed = PlanIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
