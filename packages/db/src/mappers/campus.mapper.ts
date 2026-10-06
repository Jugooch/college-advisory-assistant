/**
 * @file Converts campus rows into domain objects.
 * @module @caa/db/mappers/campus
 * @requirement FR-07
 */
import { type Campus, createCampus } from '@caa/domain';

import type { CampusRow } from '../tables/campus.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `campus` table.
 * @returns The domain campus.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toCampus(row: CampusRow): Campus {
  return createCampus({
    id: row.id,
    tenantId: row.tenantId,
    sourceCampusId: row.sourceCampusId,
    name: row.name,
  });
}
