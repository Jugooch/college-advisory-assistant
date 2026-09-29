/**
 * @file Campus data object: a physical site of a tenant where section meetings take place.
 * @module @caa/domain/models/campus
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';

/** Branded ID so a campus ID can never be passed where another ID is expected. */
export const CampusIdSchema = z.uuid().brand<'CampusId'>();

/** Unique identifier of a {@link Campus}. */
export type CampusId = z.infer<typeof CampusIdSchema>;

/** Schema for a campus. Campus IDs are tenant-specific. */
export const CampusSchema = z
  .object({
    id: CampusIdSchema,
    tenantId: InstitutionIdSchema,
    /** Campus identifier in the source system. Distinct from the internal {@link CampusId}. */
    sourceCampusId: z.string().min(1),
    /** Display name such as `North Campus`. Never used as identity. */
    name: z.string().min(1),
  })
  .readonly();

/** A validated, immutable campus. */
export type Campus = z.infer<typeof CampusSchema>;

/** Raw input accepted by {@link createCampus}. */
export type CampusInput = z.input<typeof CampusSchema>;

/**
 * Creates a validated, immutable campus.
 *
 * @param input - Raw campus fields.
 * @returns The parsed campus.
 * @throws {z.ZodError} When any field is invalid.
 */
export function createCampus(input: CampusInput): Campus {
  return CampusSchema.parse(input);
}
