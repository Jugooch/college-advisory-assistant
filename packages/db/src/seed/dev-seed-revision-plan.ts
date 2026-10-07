/**
 * @file The synthetic newer source revisions the dev revise command publishes for the first
 *   vertical slice student: a student record with a grade change, and a section snapshot with a
 *   withdrawn section. Pure given the run time.
 * @module @caa/db/seed/dev-seed-revision-plan
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import {
  AttemptStatus,
  type CourseAttempt,
  createCourseAttempt,
  createStudentSnapshot,
  GradeScheme,
  LetterGrade,
  type StudentSnapshot,
} from '@caa/domain';

import { SEED_CATALOG, SEED_TENANT_ID } from './dev-seed-academic-catalog';
import { SEED_ATTEMPT_IDS, SEED_CATALOG_YEAR, SEED_PROGRAM_ID } from './dev-seed-academic-plan';
import { seedInstantMs, seedRevisionId } from './dev-seed-record-times';

/** Which source the revise command supersedes. */
export type ReviseTarget = 'student' | 'sections';

/** A newer student record: the graded attempt and the snapshot that lists it. */
export interface StudentRevisionPlan {
  readonly attempt: CourseAttempt;
  readonly snapshot: StudentSnapshot;
}

/**
 * Builds a newer record for the slice student in which the in-progress PHYS 201 attempt is
 * replaced by a completed one with a posted grade (the S4 grade-change scenario).
 *
 * @param now - The time the run started; the record takes effect and is ingested at this instant.
 * @param studentId - Stored ID of the slice student.
 * @returns A fresh attempt and snapshot, with IDs derived from `now`.
 * @throws {RangeError} When `now` is invalid.
 * @throws {z.ZodError} When a built record violates its domain schema.
 */
export function buildStudentRevision(now: Date, studentId: string): StudentRevisionPlan {
  const run = String(seedInstantMs(now));
  const attempt = createCourseAttempt({
    id: seedRevisionId('60000000', 1, now),
    tenantId: SEED_TENANT_ID,
    studentId,
    courseId: SEED_CATALOG.phys201.id,
    sourceAttemptId: `SYN-ATT-REV-${run}`,
    termCode: '2026FA',
    status: AttemptStatus.Completed,
    grade: { scheme: GradeScheme.Letter, value: LetterGrade.C },
    creditsEarnedHundredths: 400,
  });
  const snapshot = createStudentSnapshot({
    id: seedRevisionId('a0000000', 4, now),
    tenantId: SEED_TENANT_ID,
    studentId,
    programId: SEED_PROGRAM_ID,
    catalogYear: SEED_CATALOG_YEAR,
    sourceEffectiveAt: now.toISOString(),
    ingestedAt: now.toISOString(),
    attemptIds: [SEED_ATTEMPT_IDS.math101First, SEED_ATTEMPT_IDS.math101Repeat, attempt.id],
  });
  return { attempt, snapshot };
}
