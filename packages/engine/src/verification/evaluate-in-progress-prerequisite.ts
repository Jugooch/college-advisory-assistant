/**
 * @file Decides whether in-progress work can conditionally satisfy a required course.
 * @module @caa/engine/verification/evaluate-in-progress-prerequisite
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, type CourseAttempt, GradeScheme, ReasonCode, RepeatPolicy } from '@caa/domain';

import type { LeafOutcome } from './evaluate-course-prerequisite';
import type { AttemptResolutionContext } from './select-counting-attempt';

const PROGRESSION_NOT_PERMITTED: LeafOutcome = {
  state: CheckState.Fail,
  reasonCode: ReasonCode.ProgressionNotPermitted,
};
const REPEAT_POLICY_UNDEFINED: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.RepeatPolicyUndefined,
};
const REPEAT_ORDER_UNDETERMINED: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.RepeatOrderUndetermined,
};
const IN_PROGRESS_MIN_GRADE: LeafOutcome = {
  state: CheckState.Conditional,
  reasonCode: ReasonCode.InProgressMinGrade,
};

/** One or more in-progress attempts of the same group. */
export type InProgressAttempts = readonly [CourseAttempt, ...CourseAttempt[]];

/**
 * Evaluates a group's in-progress attempts as the way to satisfy a course whose current record
 * fails. When the group already has a counting attempt, or several attempts are in progress,
 * completing them creates a repeat, so the repeat policy must make the in-progress attempt the
 * one that counts once it meets the minimum.
 *
 * @param counted - The group's failing counting attempt, or `null` when nothing counts yet.
 * @param inProgress - The group's in-progress attempts.
 * @param context - The academic policy and the tenant's term order.
 * @returns FAIL (`PROGRESSION_NOT_PERMITTED`), UNKNOWN (`REPEAT_POLICY_UNDEFINED` or
 *   `REPEAT_ORDER_UNDETERMINED`), or CONDITIONAL (`IN_PROGRESS_MIN_GRADE`).
 */
export function evaluateInProgressPrerequisite(
  counted: CourseAttempt | null,
  inProgress: InProgressAttempts,
  context: AttemptResolutionContext,
): LeafOutcome {
  const { academicPolicy } = context;
  // SAFETY: planning on unfinished work is conditional on the institution permitting planned
  // progression; without that permission it is a FAIL (planning/08 §Eligibility semantics:
  // in-progress prerequisites; AC02).
  if (!academicPolicy.allowsInProgressPrerequisites) {
    return PROGRESSION_NOT_PERMITTED;
  }
  const [retake, ...otherRetakes] = inProgress;
  if (counted === null && otherRetakes.length === 0) {
    return IN_PROGRESS_MIN_GRADE;
  }
  // SAFETY: without a repeat policy, no attempt of a repeated course counts, so meeting the
  // minimum in the retake wouldn't be enough and a CONDITIONAL would promise too much
  // (planning/08 §Eligibility semantics: repeated attempts use approved source semantics).
  if (academicPolicy.repeatPolicy === null) {
    return REPEAT_POLICY_UNDEFINED;
  }
  // SAFETY: with several attempts in progress at once, the engine can't say which will count,
  // so it states no single condition (planning/08 §Eligibility semantics).
  if (counted === null || otherRetakes.length > 0) {
    return REPEAT_ORDER_UNDETERMINED;
  }
  return willRetakeCount(retake, counted, context)
    ? IN_PROGRESS_MIN_GRADE
    : REPEAT_ORDER_UNDETERMINED;
}

/**
 * Decides whether a retake that meets the minimum will replace the failing counting attempt.
 *
 * @param retake - The in-progress attempt.
 * @param counted - The failing counting attempt.
 * @param context - The academic policy, whose repeat policy is set, and the term order.
 * @returns `true` when the repeat policy will make the retake count once it meets the minimum.
 */
function willRetakeCount(
  retake: CourseAttempt,
  counted: CourseAttempt,
  context: AttemptResolutionContext,
): boolean {
  if (context.academicPolicy.repeatPolicy === RepeatPolicy.MostRecent) {
    const retakeIndex = context.termCodesOldestFirst.indexOf(retake.termCode);
    const countedIndex = context.termCodesOldestFirst.indexOf(counted.termCode);
    // SAFETY: MOST_RECENT counts the retake only if its term is known to be later; a term
    // missing from the order can't be placed (planning/08 §Eligibility semantics).
    return countedIndex !== -1 && retakeIndex > countedIndex;
  }
  // SAFETY: HIGHEST_GRADE ranks only grades of one scheme. A letter retake that meets the
  // minimum outranks a failing letter, but it can't be ranked against a `P` or an unranked
  // grade (planning/08 §Candidate formation: preserve grade schemes).
  return counted.grade?.scheme === GradeScheme.Letter;
}
