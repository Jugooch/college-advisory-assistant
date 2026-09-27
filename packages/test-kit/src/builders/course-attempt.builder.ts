/**
 * @file Builds synthetic course attempts for tests, with one helper per attempt status.
 * @module @caa/test-kit/builders/course-attempt
 */
import {
  AttemptStatus,
  type CourseAttempt,
  type CourseAttemptInput,
  createCourseAttempt,
} from '@caa/domain';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { letter } from './grade.builder';

/** Overrides accepted by the attempt builders. */
export type CourseAttemptOverrides = Partial<CourseAttemptInput>;

/**
 * Builds a valid course attempt, defaulting to student seed 1 completing DEMO-MATH 101 in term
 * `2026SP` with a letter `B` and 3.00 earned credits.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes attempts; drives the default `id` and `sourceAttemptId`.
 * @returns A validated course attempt.
 */
export function buildCourseAttempt(
  overrides: CourseAttemptOverrides = {},
  seed = 1,
): CourseAttempt {
  return createCourseAttempt({
    id: syntheticId('attempt', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    studentId: syntheticId('student', 1),
    courseId: SYNTHETIC_COURSES.math101.id,
    sourceAttemptId: `SYN-ATT-${String(seed).padStart(6, '0')}`,
    termCode: '2026SP',
    status: AttemptStatus.Completed,
    grade: letter('B'),
    creditsEarnedHundredths: 300,
    ...overrides,
  });
}

/**
 * Builds a `COMPLETED` attempt: letter `B`, 3.00 earned credits, term `2026SP`.
 *
 * @param overrides - Fields to replace in the default, for example `{ grade: letter('D') }`.
 * @param seed - Distinguishes attempts; drives the default `id` and `sourceAttemptId`.
 * @returns A validated course attempt.
 */
export function completedAttempt(overrides: CourseAttemptOverrides = {}, seed = 1): CourseAttempt {
  return buildCourseAttempt({ status: AttemptStatus.Completed, ...overrides }, seed);
}

/**
 * Builds an `IN_PROGRESS` attempt in term `2026FA`, with no grade and no earned credits.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes attempts; drives the default `id` and `sourceAttemptId`.
 * @returns A validated course attempt.
 */
export function inProgressAttempt(overrides: CourseAttemptOverrides = {}, seed = 1): CourseAttempt {
  return ungradedAttempt(AttemptStatus.InProgress, { termCode: '2026FA', ...overrides }, seed);
}

/**
 * Builds a `WITHDRAWN` attempt, with no grade and no earned credits.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes attempts; drives the default `id` and `sourceAttemptId`.
 * @returns A validated course attempt.
 */
export function withdrawnAttempt(overrides: CourseAttemptOverrides = {}, seed = 1): CourseAttempt {
  return ungradedAttempt(AttemptStatus.Withdrawn, overrides, seed);
}

/**
 * Builds an `INCOMPLETE` attempt, with no grade and no earned credits.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes attempts; drives the default `id` and `sourceAttemptId`.
 * @returns A validated course attempt.
 */
export function incompleteAttempt(overrides: CourseAttemptOverrides = {}, seed = 1): CourseAttempt {
  return ungradedAttempt(AttemptStatus.Incomplete, overrides, seed);
}

/**
 * Builds a `TRANSFER_PENDING` attempt, with no grade and no earned credits.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes attempts; drives the default `id` and `sourceAttemptId`.
 * @returns A validated course attempt.
 */
export function pendingTransferAttempt(
  overrides: CourseAttemptOverrides = {},
  seed = 1,
): CourseAttempt {
  return ungradedAttempt(AttemptStatus.TransferPending, overrides, seed);
}

/**
 * Builds a `TRANSFER_AWARDED` attempt with 3.00 earned credits and no grade, as when the
 * source records transfer credit without a grade. Override `grade` when a case needs one.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes attempts; drives the default `id` and `sourceAttemptId`.
 * @returns A validated course attempt.
 */
export function transferAwardedAttempt(
  overrides: CourseAttemptOverrides = {},
  seed = 1,
): CourseAttempt {
  return buildCourseAttempt(
    {
      status: AttemptStatus.TransferAwarded,
      grade: null,
      creditsEarnedHundredths: 300,
      ...overrides,
    },
    seed,
  );
}

/**
 * Builds an attempt with the given status and neither a grade nor earned credits.
 *
 * @param status - Attempt status.
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes attempts.
 * @returns A validated course attempt.
 */
function ungradedAttempt(
  status: AttemptStatus,
  overrides: CourseAttemptOverrides,
  seed: number,
): CourseAttempt {
  return buildCourseAttempt(
    { status, grade: null, creditsEarnedHundredths: null, ...overrides },
    seed,
  );
}
