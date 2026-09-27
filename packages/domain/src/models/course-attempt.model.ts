/**
 * @file Course attempt data object: one student's attempt at one course in one term.
 * @module @caa/domain/models/course-attempt
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { AttemptStatus, AttemptStatusSchema } from '../enums/attempt-status.enum';
import { CourseIdSchema } from './course.model';
import { GradeSchema } from './grade.model';
import { InstitutionIdSchema } from './institution.model';
import { StudentIdSchema } from './student.model';

/** Branded ID so a course attempt ID can never be passed where another ID is expected. */
export const CourseAttemptIdSchema = z.uuid().brand<'CourseAttemptId'>();

/** Unique identifier of a {@link CourseAttempt}. */
export type CourseAttemptId = z.infer<typeof CourseAttemptIdSchema>;

/** Statuses under which no grade has been assigned yet. */
const UNGRADED_STATUSES: readonly AttemptStatus[] = [
  AttemptStatus.InProgress,
  AttemptStatus.TransferPending,
];

/** Statuses under which credits can have been earned. */
const CREDIT_EARNING_STATUSES: readonly AttemptStatus[] = [
  AttemptStatus.Completed,
  AttemptStatus.TransferAwarded,
];

/** Schema for a course attempt. Repeats of a course are separate attempts. */
export const CourseAttemptSchema = z
  .object({
    id: CourseAttemptIdSchema,
    tenantId: InstitutionIdSchema,
    studentId: StudentIdSchema,
    courseId: CourseIdSchema,
    /** Attempt identifier in the source system. Distinct from the internal {@link CourseAttemptId}. */
    sourceAttemptId: z.string().min(1),
    /** Source term code, for example `2026FA`. Term codes are tenant-specific. */
    termCode: z.string().min(1),
    status: AttemptStatusSchema,
    /** Recorded grade, or `null` when none is assigned or the source didn't supply one. */
    grade: GradeSchema.nullable(),
    /**
     * Credits earned in hundredths of a credit (350 = 3.5 credits), or `null` when the attempt
     * earned none or the source didn't supply the amount.
     */
    creditsEarnedHundredths: z.number().int().nonnegative().nullable(),
  })
  // SAFETY: an in-progress or pending-transfer attempt has no final grade; accepting one would
  // let the engine treat an unfinished course as satisfying a prerequisite.
  .refine((attempt) => !UNGRADED_STATUSES.includes(attempt.status) || attempt.grade === null, {
    message: 'IN_PROGRESS and TRANSFER_PENDING attempts must not have a grade',
    path: ['grade'],
  })
  // SAFETY: only completed or awarded attempts earn credit; any other status must not add to
  // a student's credit total.
  .refine(
    (attempt) =>
      CREDIT_EARNING_STATUSES.includes(attempt.status) || attempt.creditsEarnedHundredths === null,
    {
      message: 'Only COMPLETED and TRANSFER_AWARDED attempts may have creditsEarnedHundredths',
      path: ['creditsEarnedHundredths'],
    },
  )
  .readonly();

/** A validated, immutable course attempt. */
export type CourseAttempt = z.infer<typeof CourseAttemptSchema>;

/** Raw input accepted by {@link createCourseAttempt}. */
export type CourseAttemptInput = z.input<typeof CourseAttemptSchema>;

/**
 * Creates a validated, immutable course attempt.
 *
 * @param input - Raw attempt fields.
 * @returns The parsed course attempt.
 * @throws {z.ZodError} When a field is invalid, an ungraded status carries a grade, or a
 *   non-earning status carries earned credits.
 */
export function createCourseAttempt(input: CourseAttemptInput): CourseAttempt {
  return CourseAttemptSchema.parse(input);
}
