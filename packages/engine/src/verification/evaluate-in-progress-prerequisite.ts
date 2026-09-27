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
const PASS: LeafOutcome = { state: CheckState.Pass, reasonCode: null };
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
 * Evaluates in-progress retakes of a course whose counting attempt already meets the minimum.
 * The passing grade holds only if no retake will replace it.
 *
 * @param counted - The group's passing counting attempt.
 * @param inProgress - The group's in-progress attempts.
 * @param context - The academic policy and the tenant's term order.
 * @returns PASS under HIGHEST_GRADE, CONDITIONAL (`IN_PROGRESS_MIN_GRADE`) when a MOST_RECENT
 *   retake will replace the passing grade, or UNKNOWN (`REPEAT_POLICY_UNDEFINED` or
 *   `REPEAT_ORDER_UNDETERMINED`) when the engine can't tell which attempt will count.
 */
export function evaluateRetakeOfPassingAttempt(
  counted: CourseAttempt,
  inProgress: InProgressAttempts,
  context: AttemptResolutionContext,
): LeafOutcome {
  const { repeatPolicy } = context.academicPolicy;
  // SAFETY: once the retake completes, the course is repeated, and without a repeat policy no
  // attempt counts, so the passing grade can't be relied on (planning/08 §Eligibility
  // semantics: repeated attempts use approved source semantics).
  if (repeatPolicy === null) {
    return REPEAT_POLICY_UNDEFINED;
  }
  // SAFETY: under HIGHEST_GRADE a retake can only replace the counting grade with a higher one,
  // so the passing grade stands on current evidence (planning/08 §Authority and result
  // semantics: PASS is "satisfied by current evidence").
  if (repeatPolicy === RepeatPolicy.HighestGrade) {
    return PASS;
  }
  const [retake, ...otherRetakes] = inProgress;
  // SAFETY: under MOST_RECENT a later retake replaces the passing grade whatever it earns, so
  // the result depends on a future grade: CONDITIONAL on the retake meeting the minimum, never
  // PASS. This holds whatever `allowsInProgressPrerequisites` says, because the student already
  // passed and the condition only warns that the retake can undo it. Several concurrent
  // retakes, or terms missing from the order, leave the counting attempt undetermined
  // (planning/08 §Authority and result semantics: CONDITIONAL depends on an explicit future
  // condition).
  if (otherRetakes.length > 0 || !isLaterTerm(retake, counted, context.termCodesOldestFirst)) {
    return REPEAT_ORDER_UNDETERMINED;
  }
  return IN_PROGRESS_MIN_GRADE;
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
    return isLaterTerm(retake, counted, context.termCodesOldestFirst);
  }
  // SAFETY: HIGHEST_GRADE ranks only grades of one scheme. A letter retake that meets the
  // minimum outranks a failing letter, but it can't be ranked against a `P` or an unranked
  // grade (planning/08 §Candidate formation: preserve grade schemes).
  return counted.grade?.scheme === GradeScheme.Letter;
}

/**
 * Decides whether a retake's term is known to be later than the counting attempt's.
 *
 * @param retake - The in-progress attempt.
 * @param counted - The counting attempt.
 * @param termCodesOldestFirst - The tenant's term order.
 * @returns `true` only when both terms are in the order and the retake's is later.
 */
function isLaterTerm(
  retake: CourseAttempt,
  counted: CourseAttempt,
  termCodesOldestFirst: readonly string[],
): boolean {
  const retakeIndex = termCodesOldestFirst.indexOf(retake.termCode);
  const countedIndex = termCodesOldestFirst.indexOf(counted.termCode);
  // SAFETY: MOST_RECENT counts the retake only if its term is known to be later; a term missing
  // from the order can't be placed (planning/08 §Eligibility semantics).
  return countedIndex !== -1 && retakeIndex > countedIndex;
}
