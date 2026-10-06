/**
 * @file Converts program rows into domain objects.
 * @module @caa/db/mappers/program
 * @requirement FR-10
 */
import { createProgram, type Program } from '@caa/domain';

import type { ProgramRow } from '../tables/program.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `program` table.
 * @returns The domain program.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toProgram(row: ProgramRow): Program {
  return createProgram({
    id: row.id,
    tenantId: row.tenantId,
    sourceProgramId: row.sourceProgramId,
    name: row.name,
  });
}
