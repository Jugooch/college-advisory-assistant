/**
 * @file Advisor assignment data object: grants one advisor access to one student for a period.
 * @module @caa/domain/models/advisor-assignment
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';
import { StudentIdSchema } from './student.model';
import { UserIdSchema } from './user-identity.model';

/** Branded ID so an advisor assignment ID can never be passed where another ID is expected. */
export const AdvisorAssignmentIdSchema = z.uuid().brand<'AdvisorAssignmentId'>();

/** Unique identifier of an {@link AdvisorAssignment}. */
export type AdvisorAssignmentId = z.infer<typeof AdvisorAssignmentIdSchema>;

/** Schema for an advisor assignment. Access ends when the assignment ends. */
export const AdvisorAssignmentSchema = z
  .object({
    id: AdvisorAssignmentIdSchema,
    tenantId: InstitutionIdSchema,
    advisorUserId: UserIdSchema,
    studentId: StudentIdSchema,
    /** Start of access. ISO 8601 with offset. */
    effectiveFrom: z.iso.datetime({ offset: true }),
    /** End of access. ISO 8601 with offset, or `null` when the assignment is open-ended. */
    effectiveTo: z.iso.datetime({ offset: true }).nullable(),
    /** User who approved the assignment. */
    approvedBy: UserIdSchema,
  })
  // SECURITY: an assignment that ends before it starts is a data error, not a valid grant.
  // NOTE: compared as instants, because strings with different offsets don't sort lexically.
  .refine(
    (assignment) =>
      assignment.effectiveTo === null ||
      Date.parse(assignment.effectiveTo) >= Date.parse(assignment.effectiveFrom),
    { message: 'effectiveTo must not be earlier than effectiveFrom', path: ['effectiveTo'] },
  )
  .readonly();

/** A validated, immutable advisor assignment. */
export type AdvisorAssignment = z.infer<typeof AdvisorAssignmentSchema>;

/** Raw input accepted by {@link createAdvisorAssignment}. */
export type AdvisorAssignmentInput = z.input<typeof AdvisorAssignmentSchema>;

/**
 * Creates a validated, immutable advisor assignment.
 *
 * @param input - Raw assignment fields.
 * @returns The parsed advisor assignment.
 * @throws {z.ZodError} When a field is invalid or `effectiveTo` is earlier than `effectiveFrom`.
 */
export function createAdvisorAssignment(input: AdvisorAssignmentInput): AdvisorAssignment {
  return AdvisorAssignmentSchema.parse(input);
}
