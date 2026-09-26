/**
 * @file Student data object: the minimal link between a source-system student and an app user.
 * @module @caa/domain/models/student
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/planning/12-security-privacy-and-procurement.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';
import { UserIdSchema } from './user-identity.model';

/** Branded ID so a student ID can never be passed where another ID is expected. */
export const StudentIdSchema = z.uuid().brand<'StudentId'>();

/** Unique identifier of a {@link Student}. */
export type StudentId = z.infer<typeof StudentIdSchema>;

/**
 * Schema for a student.
 *
 * SECURITY: data minimization. No names, emails, birth dates, or other personal fields live here.
 */
export const StudentSchema = z
  .object({
    id: StudentIdSchema,
    tenantId: InstitutionIdSchema,
    /** Student identifier in the source system (SIS). Distinct from the internal {@link StudentId}. */
    sourceStudentId: z.string().min(1),
    /** Login linked to this student, or `null` when the student has not signed in yet. */
    userId: UserIdSchema.nullable(),
  })
  .readonly();

/** A validated, immutable student. */
export type Student = z.infer<typeof StudentSchema>;

/** Raw input accepted by {@link createStudent}. */
export type StudentInput = z.input<typeof StudentSchema>;

/**
 * Creates a validated, immutable student.
 *
 * @param input - Raw student fields.
 * @returns The parsed student.
 * @throws {z.ZodError} When any field is invalid.
 */
export function createStudent(input: StudentInput): Student {
  return StudentSchema.parse(input);
}
