/**
 * @file Program data object: the academic program (degree plan) a student is enrolled in.
 * @module @caa/domain/models/program
 * @requirement FR-04
 * @requirement FR-10
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';

/**
 * Branded ID so a program ID can never be passed where another ID is expected.
 *
 * The `ProgramCatalog` data object (planning/09: program, degree, catalog version, coverage
 * status) will live in this file when it is modeled.
 */
export const ProgramIdSchema = z.uuid().brand<'ProgramId'>();

/** Unique identifier of an academic program. */
export type ProgramId = z.infer<typeof ProgramIdSchema>;

/** Schema for a tenant's academic program, as its catalog names it. Program IDs are tenant-specific. */
export const ProgramSchema = z
  .object({
    id: ProgramIdSchema,
    tenantId: InstitutionIdSchema,
    /** Program identifier in the source system. Distinct from the internal {@link ProgramId}. */
    sourceProgramId: z.string().min(1),
    /**
     * Catalog name such as `B.S. Physics`: plain catalog data, never AI-generated and never
     * identity. `null` means the catalog supplies no name.
     */
    name: z.string().min(1).nullable(),
  })
  .readonly();

/** A validated, immutable program. */
export type Program = z.infer<typeof ProgramSchema>;

/** Raw input accepted by {@link createProgram}. */
export type ProgramInput = z.input<typeof ProgramSchema>;

/**
 * Creates a validated, immutable program.
 *
 * @param input - Raw program fields.
 * @returns The parsed program.
 * @throws {z.ZodError} When any field is invalid.
 */
export function createProgram(input: ProgramInput): Program {
  return ProgramSchema.parse(input);
}
