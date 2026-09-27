/**
 * @file Program identity: the academic program (degree plan) a student is enrolled in.
 * @module @caa/domain/models/program
 * @requirement FR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * Branded ID so a program ID can never be passed where another ID is expected.
 *
 * The `ProgramCatalog` data object (planning/09: program, degree, catalog version, coverage
 * status) will live in this file when it is modeled.
 */
export const ProgramIdSchema = z.uuid().brand<'ProgramId'>();

/** Unique identifier of an academic program. */
export type ProgramId = z.infer<typeof ProgramIdSchema>;
