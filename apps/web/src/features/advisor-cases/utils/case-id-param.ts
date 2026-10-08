/**
 * @file Reads a case ID from a route parameter before it becomes an API path segment.
 * @module @caa/web/features/advisor-cases/utils/case-id-param
 * @requirement FR-12
 * @requirement NFR-04
 */
import { type CaseId, CaseIdSchema } from '@caa/domain';

/**
 * Parses a route parameter as a case ID.
 *
 * @param value - The raw route parameter.
 * @returns The case ID, or `null` when it isn't one, so input such as `..` can never reach a
 *   different API route.
 */
export function readCaseIdParam(value: string): CaseId | null {
  // SECURITY: parse external input before it is used in a path (standard 09).
  const parsed = CaseIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
