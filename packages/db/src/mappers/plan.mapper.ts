/**
 * @file Converts plan rows into domain objects.
 * @module @caa/db/mappers/plan
 * @requirement FR-11
 */
import { type Plan, PlanSchema } from '@caa/domain';

import type { PlanRow } from '../tables/plan.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `plan` table.
 * @returns The domain plan, with the timestamp as an ISO string.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toPlan(row: PlanRow): Plan {
  return PlanSchema.parse({
    id: row.id,
    tenantId: row.tenantId,
    studentId: row.studentId,
    termId: row.termId,
    createdAt: row.createdAt.toISOString(),
  });
}
