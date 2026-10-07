/**
 * @file Compares one counted attempt's grade with a prerequisite leaf's minimum.
 * @module @caa/engine/verification/compare-attempt-to-minimum
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AcademicPolicy,
  CheckState,
  type CourseAttempt,
  type CoursePrerequisite,
  ReasonCode,
} from '@caa/domain';

import { compareToMinimumGrade } from './compare-to-minimum-grade';
import type { LeafOutcome } from './evaluate-course-prerequisite';

const PASS: LeafOutcome = { state: CheckState.Pass, reasonCode: null };
const GRADE_NOT_RECORDED: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.GradeNotRecorded,
};

/**
 * Compares one attempt's grade with the leaf's minimum.
 *
 * @param attempt - A counted attempt.
 * @param leaf - Supplies the minimum grade.
 * @param policy - Supplies the grade policy.
 * @returns PASS, FAIL, or UNKNOWN for that attempt.
 */
export function compareAttemptToMinimum(
  attempt: CourseAttempt,
  leaf: CoursePrerequisite,
  policy: AcademicPolicy,
): LeafOutcome {
  const { grade } = attempt;
  // SAFETY: a counting attempt with no recorded grade, such as transfer credit awarded without
  // one, can't show that it meets a minimum or is a passing completion, so it is UNKNOWN,
  // never PASS (planning/08 §Authority and result semantics: missing data is UNKNOWN).
  if (grade === null) {
    return GRADE_NOT_RECORDED;
  }
  const comparison = compareToMinimumGrade(grade, leaf.minimumGrade, policy);
  return comparison.state === CheckState.Pass ? PASS : comparison;
}
