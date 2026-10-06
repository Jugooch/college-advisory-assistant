/**
 * @file Read-only data access for a tenant's academic programs.
 * @module @caa/db/repositories/program
 * @requirement FR-10
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { and, eq } from 'drizzle-orm';

import type { InstitutionId, Program, ProgramId } from '@caa/domain';

import type { Database } from '../client';
import { toProgram } from '../mappers/program.mapper';
import { programTable } from '../tables/program.table';

/** Reads programs. Institutional source data, so there are no update methods. */
export interface ProgramRepository {
  /**
   * Finds one program of a tenant.
   *
   * @param tenantId - Tenant that owns the program.
   * @param programId - Program to read.
   * @returns The program, or null when the tenant has none with that ID.
   * @throws {z.ZodError} When the stored program violates the domain schema.
   */
  findById(tenantId: InstitutionId, programId: ProgramId): Promise<Program | null>;
}

/**
 * Creates the program repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link ProgramRepository}.
 */
export function createProgramRepository(db: Database): ProgramRepository {
  return {
    async findById(tenantId, programId) {
      const [row] = await db
        .select()
        .from(programTable)
        // SECURITY: every read is filtered by tenant.
        .where(and(eq(programTable.tenantId, tenantId), eq(programTable.id, programId)))
        .limit(1);
      return row === undefined ? null : toProgram(row);
    },
  };
}
