/**
 * @file Decides whether in-progress work can conditionally satisfy a required course.
 * @module @caa/engine/verification/evaluate-in-progress-prerequisite
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  CheckState,
  type CourseAttempt,
  type Grade,
  GradeScheme,
  ReasonCode,
  RepeatPolicy,
} from '@caa/domain';

import type { LeafOutcome } from './evaluate-course-prerequisite';
import { type AttemptResolutionContext, haveOneGradeScheme } from './select-counting-attempt';

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

/** A group's in-progress attempts, with what they would have to beat and meet. */
export interface RetakeSituation {
  /** The group's counting attempt, or `null` when nothing counts yet. */
  readonly counted: CourseAttempt | null;
  readonly inProgress: InProgressAttempts;
  /** The leaf's minimum grade, or `null` when any passing completion satisfies it. */
  readonly minimumGrade: Grade | null;
}

/**
 * Evaluates a group's in-progress attempts as the way to satisfy a course whose current record
 * fails. When the group already has a counting attempt, or several attempts are in progress,
 * completing them creates a repeat, so the repeat policy must make the in-progress attempt the
 * one that counts once it meets the minimum.
 *
 * @param situation - The failing counting attempt (or `null`), the in-progress attempts, and the
 *   leaf's minimum grade.
 * @param context - The academic policy and the tenant's term order.
 * @returns FAIL (`PROGRESSION_NOT_PERMITTED`), UNKNOWN (`REPEAT_POLICY_UNDEFINED` or
 *   `REPEAT_ORDER_UNDETERMINED`), or CONDITIONAL (`IN_PROGRESS_MIN_GRADE`).
 */
export function evaluateInProgressPrerequisite(
  situation: RetakeSituation,
  context: AttemptResolutionContext,
): LeafOutcome {
  const { counted, inProgress, minimumGrade } = situation;
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
  return willRetakeCount(retake, { counted, minimumGrade }, context)
    ? IN_PROGRESS_MIN_GRADE
    : REPEAT_ORDER_UNDETERMINED;
}

/**
 * Evaluates in-progress retakes of a course whose counting attempt already meets the minimum.
 * The passing grade holds only if no retake will replace it.
 *
 * @param situation - The passing counting attempt, the in-progress attempts, and the leaf's
 *   minimum grade.
 * @param context - The academic policy and the tenant's term order.
 * @returns PASS under HIGHEST_GRADE when the retake can be ranked against the passing grade,
 *   CONDITIONAL (`IN_PROGRESS_MIN_GRADE`) when a MOST_RECENT retake will replace the passing
 *   grade, or UNKNOWN (`REPEAT_POLICY_UNDEFINED` or `REPEAT_ORDER_UNDETERMINED`) when the engine
 *   can't tell which attempt will count.
 */
export function evaluateRetakeOfPassingAttempt(
  situation: RetakeSituation & { readonly counted: CourseAttempt },
  context: AttemptResolutionContext,
): LeafOutcome {
  const { counted, inProgress, minimumGrade } = situation;
  const { repeatPolicy } = context.academicPolicy;
  // SAFETY: once the retake completes, the course is repeated, and without a repeat policy no
  // attempt counts, so the passing grade can't be relied on (planning/08 §Eligibility
  // semantics: repeated attempts use approved source semantics).
  if (repeatPolicy === null) {
    return REPEAT_POLICY_UNDEFINED;
  }
  // SAFETY: under HIGHEST_GRADE a retake can only replace the counting grade with a higher one,
  // so the passing grade stands on current evidence (planning/08 §Authority and result
  // semantics: PASS is "satisfied by current evidence"), but only while the retake stays
  // rankable against it; see {@link canRankLetterRetake}.
  if (repeatPolicy === RepeatPolicy.HighestGrade) {
    return canRankLetterRetake(counted, minimumGrade) ? PASS : REPEAT_ORDER_UNDETERMINED;
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
 * @param replaced - The failing counting attempt and the leaf's minimum grade.
 * @param context - The academic policy, whose repeat policy is set, and the term order.
 * @returns `true` when the repeat policy will make the retake count once it meets the minimum.
 */
function willRetakeCount(
  retake: CourseAttempt,
  replaced: { readonly counted: CourseAttempt; readonly minimumGrade: Grade | null },
  context: AttemptResolutionContext,
): boolean {
  if (context.academicPolicy.repeatPolicy === RepeatPolicy.MostRecent) {
    return isLaterTerm(retake, replaced.counted, context.termCodesOldestFirst);
  }
  return canRankLetterRetake(replaced.counted, replaced.minimumGrade);
}

/**
 * Decides whether HIGHEST_GRADE will be able to rank a retake against the counting attempt.
 * The retake's condition is stated as a letter grade, so the counting grade and the minimum,
 * when there is one, must be letters too.
 *
 * @param counted - The counting attempt.
 * @param minimumGrade - The leaf's minimum grade, or `null`.
 * @returns `true` when the counting grade, the minimum, and the retake share the LETTER scheme.
 */
function canRankLetterRetake(counted: CourseAttempt, minimumGrade: Grade | null): boolean {
  // SAFETY: `selectCountingAttempt` leaves a group with mixed grade schemes UNDETERMINED
  // (`haveOneGradeScheme`), so a `P` next to a letter, in the counting grade or in the minimum
  // the retake must meet, would make the retake's outcome unrankable. A PASS or CONDITIONAL
  // would then promise what the resolution can't deliver (planning/08 §Candidate formation:
  // preserve grade schemes).
  return haveOneGradeScheme([
    GradeScheme.Letter,
    counted.grade?.scheme,
    minimumGrade?.scheme ?? GradeScheme.Letter,
  ]);
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
