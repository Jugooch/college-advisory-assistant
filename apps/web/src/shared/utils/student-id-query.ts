/**
 * @file Parses the `studentId` query parameter before it becomes part of an API path.
 * @module @caa/web/shared/utils/student-id-query
 * @requirement FR-02
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { type StudentId, StudentIdSchema } from '@caa/domain';

/** The outcome of reading `studentId` from a query. */
export type StudentIdQuery =
  | { readonly kind: 'missing' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'valid'; readonly studentId: StudentId };

/**
 * Reads a student ID from a query value.
 *
 * @param value - The raw `studentId` query value.
 * @returns `missing` when absent or blank, `invalid` when repeated or not a student ID, otherwise
 *   the parsed ID.
 */
export function readStudentIdQuery(value: string | readonly string[] | undefined): StudentIdQuery {
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return { kind: 'missing' };
  }
  // SECURITY: parse before the value becomes a path segment, so input such as `..` can never
  // reach a different API route (standard 09: parse external input with Zod).
  const parsed = StudentIdSchema.safeParse(typeof value === 'string' ? value.trim() : value);
  return parsed.success ? { kind: 'valid', studentId: parsed.data } : { kind: 'invalid' };
}
