/**
 * @file Evaluates one required course of a prerequisite against the student's resolved attempts.
 * @module @caa/engine/verification/evaluate-course-prerequisite
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AcademicPolicy,
  CheckState,
  CountingState,
  type CoursePrerequisite,
  ReasonCode,
} from '@caa/domain';

import { combineAnyStates } from './combine-prerequisite-states';
import { compareToMinimumGrade } from './compare-to-minimum-grade';
import { evaluateInProgressPrerequisite } from './evaluate-in-progress-prerequisite';
import type { AttemptGroup } from './resolve-attempts';
import type { AttemptResolutionContext, CountingResolution } from './select-counting-attempt';

/** State of one prerequisite leaf. Anything short of PASS says why. */
export type LeafOutcome =
  | { readonly state: typeof CheckState.Pass; readonly reasonCode: null }
  | {
      readonly state:
        typeof CheckState.Fail | typeof CheckState.Unknown | typeof CheckState.Conditional;
      readonly reasonCode: ReasonCode;
    };

const PASS: LeafOutcome = { state: CheckState.Pass, reasonCode: null };
const NO_QUALIFYING_ATTEMPT: LeafOutcome = {
  state: CheckState.Fail,
  reasonCode: ReasonCode.NoQualifyingAttempt,
};
const GRADE_UNRECORDED: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.GradeSchemeMismatch,
};
const PENDING_TRANSFER: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.PendingTransfer,
};
const NO_COUNTING_ATTEMPT: CountingResolution = {
  state: CountingState.None,
  earnedCreditsHundredths: 0,
};

/**
 * Evaluates a required course against the attempt group that holds it and its equivalents.
 *
 * Decisions, in order:
 * 1. The group's counting attempt is UNDETERMINED: UNKNOWN with the group's reason code.
 * 2. The counting attempt meets the minimum (see `compareToMinimumGrade`): PASS, whatever
 *    in-progress or pending attempts the group also holds.
 * 3. The comparison is UNKNOWN, or the counting attempt has no grade: UNKNOWN.
 * 4. Otherwise the current record fails (`MIN_GRADE_NOT_MET`, or `NO_QUALIFYING_ATTEMPT` when
 *    nothing counts), and in-progress and pending-transfer attempts are weighed as alternatives
 *    by `ANY` precedence: in-progress work gives CONDITIONAL or FAIL (see
 *    `evaluateInProgressPrerequisite`), and a pending transfer gives UNKNOWN.
 *
 * @param leaf - The required course and its minimum grade.
 * @param group - The group holding the course and its equivalents, or `null` when the student
 *   has no attempt of any of them. The caller must have checked that the catalog is complete.
 * @param context - The academic policy for the rule's ruleset version and the term order.
 * @returns The leaf's state and reason code.
 */
export function evaluateCoursePrerequisite(
  leaf: CoursePrerequisite,
  group: AttemptGroup | null,
  context: AttemptResolutionContext,
): LeafOutcome {
  const counting = group?.counting ?? NO_COUNTING_ATTEMPT;
  // SAFETY: when the engine can't tell which attempt counts, it can't tell whether the course is
  // satisfied, and an in-progress retake or pending transfer can't settle that either
  // (planning/08 §Eligibility semantics: repeated attempts use approved source semantics).
  if (counting.state === CountingState.Undetermined) {
    return { state: CheckState.Unknown, reasonCode: counting.reasonCode };
  }
  const current = evaluateCounting(counting, leaf, context.academicPolicy);
  // SAFETY: PASS rests on the counting attempt alone, as current evidence. In-progress and
  // pending attempts earn nothing yet, so they neither add to nor take away from it, even a
  // MOST_RECENT retake; its grade is new evidence that needs revalidation (planning/08
  // §Authority and result semantics: PASS is "satisfied by current evidence"). An UNKNOWN
  // comparison stays UNKNOWN: whether a retake would replace a grade the engine can't compare
  // is itself undetermined, so no CONDITIONAL is offered.
  if (current.state !== CheckState.Fail) {
    return current;
  }
  return group === null ? current : evaluateProspects(current, group, context);
}

/**
 * Evaluates the counting attempt alone.
 *
 * @param counting - The group's counting resolution, COUNTED or NONE.
 * @param leaf - Supplies the minimum grade.
 * @param policy - Supplies the grade policy.
 * @returns PASS, FAIL, or UNKNOWN for the current record.
 */
function evaluateCounting(
  counting: CountingResolution,
  leaf: CoursePrerequisite,
  policy: AcademicPolicy,
): LeafOutcome {
  if (counting.state !== CountingState.Counted) {
    return NO_QUALIFYING_ATTEMPT;
  }
  const { grade } = counting.attempt;
  // SAFETY: a counting attempt with no recorded grade, such as transfer credit awarded without
  // one, can't show that it meets a minimum or is a passing completion, so it gets the same
  // UNKNOWN as a grade of the UNKNOWN scheme (planning/08 §Candidate formation: preserve grade
  // schemes).
  if (grade === null) {
    return GRADE_UNRECORDED;
  }
  const comparison = compareToMinimumGrade(grade, leaf.minimumGrade, policy);
  return comparison.state === CheckState.Pass ? PASS : comparison;
}

/**
 * Weighs in-progress and pending-transfer attempts when the current record fails. They are
 * alternatives, so the strongest wins by `ANY` precedence: CONDITIONAL, then UNKNOWN, then FAIL.
 * On a tie the in-progress outcome's reason is reported, then the pending transfer's, then the
 * current record's.
 *
 * @param current - The failing outcome of the current record.
 * @param group - The group, for its counting, in-progress, and pending-transfer attempts.
 * @param context - The academic policy and the term order.
 * @returns The leaf's outcome.
 */
function evaluateProspects(
  current: LeafOutcome,
  group: AttemptGroup,
  context: AttemptResolutionContext,
): LeafOutcome {
  const outcomes: LeafOutcome[] = [];
  const [retake, ...otherRetakes] = group.inProgress;
  if (retake !== undefined) {
    const counted = group.counting.state === CountingState.Counted ? group.counting.attempt : null;
    outcomes.push(evaluateInProgressPrerequisite(counted, [retake, ...otherRetakes], context));
  }
  // SAFETY: a pending transfer could satisfy the course once evaluated, but it never counts
  // before an award, so it is UNKNOWN, never PASS (planning/08 §Eligibility semantics; AC03).
  if (group.pendingTransfer.length > 0) {
    outcomes.push(PENDING_TRANSFER);
  }
  outcomes.push(current);
  // NOTE: a later outcome replaces the strongest so far only when it is strictly stronger, so
  // ties keep the earlier reason.
  return outcomes.reduce((strongest, outcome) =>
    combineAnyStates([strongest.state, outcome.state]) === strongest.state ? strongest : outcome,
  );
}
