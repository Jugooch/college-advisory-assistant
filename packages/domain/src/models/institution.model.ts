/**
 * @file Institution data object. An institution is the tenant boundary.
 * @module @caa/domain/models/institution
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/** Branded ID so an institution ID can never be passed where another ID is expected. */
export const InstitutionIdSchema = z.uuid().brand<'InstitutionId'>();

/** Unique identifier of an {@link Institution}. */
export type InstitutionId = z.infer<typeof InstitutionIdSchema>;

/** Schema for an institution (tenant). */
export const InstitutionSchema = z
  .object({
    id: InstitutionIdSchema,
    name: z.string().min(1).max(200),
    timezone: z.string().min(1),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .readonly();

/** A validated, immutable institution. */
export type Institution = z.infer<typeof InstitutionSchema>;

/** Raw input accepted by {@link createInstitution}. */
export type InstitutionInput = z.input<typeof InstitutionSchema>;

/**
 * Creates a validated, immutable institution.
 *
 * @param input - Raw institution fields.
 * @returns The parsed institution.
 * @throws {z.ZodError} When any field is invalid.
 */
export function createInstitution(input: InstitutionInput): Institution {
  return InstitutionSchema.parse(input);
}
