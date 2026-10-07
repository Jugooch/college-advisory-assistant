/**
 * @file Converts advising case rows into domain objects.
 * @module @caa/db/mappers/advising-case
 * @requirement FR-12
 */
import { type AdvisingCase, AdvisingCaseSchema } from '@caa/domain';

import type { AdvisingCaseRow } from '../tables/advising-case.table';

/**
 * Maps a database row to a validated domain case.
 *
 * @param row - Row read from the `advising_case` table.
 * @returns The domain case, with the timestamp as an ISO string. The plan ID is a storage
 *   detail and isn't part of the domain object.
 * @throws {z.ZodError} When the stored row violates the domain schema. The error carries field
 *   paths, never the student's note.
 */
export function toAdvisingCase(row: AdvisingCaseRow): AdvisingCase {
  return AdvisingCaseSchema.parse({
    id: row.id,
    tenantId: row.tenantId,
    studentId: row.studentId,
    reason: row.reason,
    planRevisionId: row.planRevisionId,
    discrepancySubject: row.discrepancySubject,
    studentNote: row.studentNote,
    status: row.status,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt.toISOString(),
    lastSequence: row.lastSequence,
  });
}
