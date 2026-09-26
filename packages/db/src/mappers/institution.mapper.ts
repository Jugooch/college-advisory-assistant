/**
 * @file Converts institution rows into domain objects.
 * @module @caa/db/mappers/institution
 */
import { createInstitution, type Institution } from '@caa/domain';

import type { InstitutionRow } from '../tables/institution.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `institution` table.
 * @returns The domain institution.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toInstitution(row: InstitutionRow): Institution {
  return createInstitution({
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    createdAt: row.createdAt.toISOString(),
  });
}
