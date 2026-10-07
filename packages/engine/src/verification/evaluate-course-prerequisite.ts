/**
 * @file Evaluates one required course of a prerequisite against the student's resolved attempts.
 * @module @caa/engine/verification/evaluate-course-prerequisite
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  AttemptStatus,
  CheckState,
  CountingState,
  type CourseAttempt,
  type CoursePrerequisite,
  ReasonCode,
} from '@caa/domain';

import {
  evaluateInProgressPrerequisite,
  evaluateRetakeOfPassingAttempt,
  type InProgressAttempts,
} from './evaluate-in-progress-prerequisite';
import {
  compareAttemptToMinimum,
  evaluateRepeatablePrerequisite,
} from './evaluate-repeatable-prerequisite';
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

/** What the prospects of one leaf are weighed against. */
interface LeafInputs {
  readonly leaf: CoursePrerequisite;
  readonly group: AttemptGroup;
  readonly context: AttemptResolutionContext;
}

const PASS: LeafOutcome = { state: CheckState.Pass, reasonCode: null };
const NO_QUALIFYING_ATTEMPT: LeafOutcome = {
  state: CheckState.Fail,
  reasonCode: ReasonCode.NoQualifyingAttempt,
};
const INCOMPLETE_ATTEMPT: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.IncompleteAttempt,
};
const REPEAT_POLICY_UNDEFINED: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.RepeatPolicyUndefined,
};
const PENDING_TRANSFER: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.PendingTransfer,
};
/**
 * Evaluates a required course against the attempt group that holds it and its equivalents.
 *
 * Decisions, in order:
 * 1. Any attempt in the group is INCOMPLETE: UNKNOWN (`INCOMPLETE_ATTEMPT`).
 * 2. The group's counting attempt is UNDETERMINED: UNKNOWN with the group's reason code.
 *    A group repeatable for credit is then decided by `evaluateRepeatablePrerequisite`, which
 *    doesn't consult the repeat policy; the steps below apply to every other group.
 * 3. The group holds both in-progress work and a pending transfer: UNKNOWN
 *    (`REPEAT_POLICY_UNDEFINED` when there is no repeat policy, otherwise `PENDING_TRANSFER`),
 *    whatever the counting attempt shows.
 * 4. The counting attempt meets the minimum (see `compareToMinimumGrade`): PASS, whatever
 *    pending transfers the group also holds. With an in-progress retake, the repeat policy
 *    decides (see `evaluateRetakeOfPassingAttempt`): PASS under HIGHEST_GRADE when the grades
 *    are rankable; under MOST_RECENT, CONDITIONAL (`IN_PROGRESS_MIN_GRADE`) when planned
 *    progression is permitted, otherwise UNKNOWN (`PROGRESSION_NOT_PERMITTED`); UNKNOWN when
 *    the repeat policy is missing or can't order the attempts.
 * 5. The comparison is UNKNOWN, or the counting attempt has no grade (`GRADE_NOT_RECORDED`):
 *    UNKNOWN.
 * 6. Otherwise the current record fails (`MIN_GRADE_NOT_MET`, or `NO_QUALIFYING_ATTEMPT` when
 *    nothing counts). In-progress work then decides, as CONDITIONAL, UNKNOWN, or FAIL (see
 *    `evaluateInProgressPrerequisite`), or a pending transfer makes it UNKNOWN
 *    (`PENDING_TRANSFER`).
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
  if (group === null) {
    return NO_QUALIFYING_ATTEMPT;
  }
  // SAFETY: an INCOMPLETE attempt has a deferred grade that will be recorded later
  // (attempt-status.enum.ts). Once recorded, it can become the counting attempt, replace a
  // passing one, or satisfy a failing one, so no settled PASS or FAIL is possible until then
  // (planning/08 §Authority and result semantics: missing data is UNKNOWN; §Eligibility
  // semantics: repeated attempts use approved source semantics).
  if (group.attempts.some((attempt) => attempt.status === AttemptStatus.Incomplete)) {
    return INCOMPLETE_ATTEMPT;
  }
  // SAFETY: when the engine can't tell which attempt counts, it can't tell whether the course is
  // satisfied, and an in-progress retake or pending transfer can't settle that either
  // (planning/08 §Eligibility semantics: repeated attempts use approved source semantics).
  if (group.counting.state === CountingState.Undetermined) {
    return { state: CheckState.Unknown, reasonCode: group.counting.reasonCode };
  }
  // SAFETY: attempts of a course repeatable for credit don't replace one another, so the
  // repeat policy isn't consulted (ADR-0012 §2: prerequisite leaves).
  if (group.repeatableForCredit !== null) {
    return evaluateRepeatablePrerequisite(leaf, group, context.academicPolicy);
  }
  return evaluateCountingAttempt({ leaf, group, context }, group.counting);
}

/**
 * Evaluates a group whose repeat policy picks at most one counting attempt (steps 3 to 6 of
 * `evaluateCoursePrerequisite`).
 *
 * @param inputs - The leaf, its group, and the academic policy and term order.
 * @param counting - The group's counting attempt, which is COUNTED or NONE.
 * @returns The leaf's state and reason code.
 */
function evaluateCountingAttempt(inputs: LeafInputs, counting: CountingResolution): LeafOutcome {
  const { leaf, group, context } = inputs;
  // SAFETY: a pending transfer's eventual grade, scheme, and term are unknown. Once awarded, it
  // can become the counting attempt under MOST_RECENT or HIGHEST_GRADE, or leave the repeat
  // undecidable with no repeat policy, so no condition on the in-progress work alone is
  // sufficient (planning/08 §Authority and result semantics: CONDITIONAL states a sufficient
  // condition; §Eligibility semantics: pending transfers never become earned credit
  // automatically; AC03; issue #89).
  if (group.inProgress.length > 0 && group.pendingTransfer.length > 0) {
    return context.academicPolicy.repeatPolicy === null
      ? REPEAT_POLICY_UNDEFINED
      : PENDING_TRANSFER;
  }
  if (counting.state !== CountingState.Counted) {
    return evaluateProspects(NO_QUALIFYING_ATTEMPT, inputs, null);
  }
  const current = compareAttemptToMinimum(counting.attempt, leaf, context.academicPolicy);
  // SAFETY: a pending transfer never replaces an institutional grade, so it can't take a PASS
  // away; only an in-progress retake can, depending on the repeat policy (planning/08
  // §Eligibility semantics: pending transfers never become earned credit automatically).
  if (current.state === CheckState.Pass) {
    return evaluatePassingRecord(counting.attempt, inputs);
  }
  // SAFETY: an UNKNOWN comparison stays UNKNOWN: whether a retake would replace a grade the
  // engine can't compare is itself undetermined, so no CONDITIONAL is offered (planning/08
  // §Authority and result semantics: UNKNOWN is not resolved by guessing).
  if (current.state !== CheckState.Fail) {
    return current;
  }
  return evaluateProspects(current, inputs, counting.attempt);
}

/**
 * Keeps a passing counting attempt's PASS unless an in-progress retake could replace it.
 *
 * @param counted - The passing counting attempt.
 * @param inputs - The leaf, its group, and the academic policy and term order.
 * @returns PASS when nothing is in progress, otherwise the outcome of
 *   `evaluateRetakeOfPassingAttempt`.
 */
function evaluatePassingRecord(counted: CourseAttempt, inputs: LeafInputs): LeafOutcome {
  const [retake, ...otherRetakes] = inputs.group.inProgress;
  if (retake === undefined) {
    return PASS;
  }
  return evaluateRetakeOfPassingAttempt(
    { counted, inProgress: [retake, ...otherRetakes], minimumGrade: inputs.leaf.minimumGrade },
    inputs.context,
  );
}

/**
 * Weighs the group's in-progress work or its pending transfer when the current record fails.
 * The caller has already settled a group holding both, so at most one applies. Either one is at
 * least as strong as the failing record by `ANY` precedence (CONDITIONAL, then UNKNOWN, then
 * FAIL), and on a tie its reason names the remediation, so it replaces the current outcome.
 *
 * @param current - The failing outcome of the current record.
 * @param inputs - The leaf, its group (for the in-progress and pending-transfer attempts),
 *   and the academic policy and term order.
 * @param counted - The failing counting attempt, or `null` when nothing counts.
 * @returns The in-progress outcome, `PENDING_TRANSFER`, or the current outcome when neither
 *   applies.
 */
function evaluateProspects(
  current: LeafOutcome,
  inputs: LeafInputs,
  counted: CourseAttempt | null,
): LeafOutcome {
  const { leaf, group, context } = inputs;
  const [retake, ...otherRetakes] = group.inProgress;
  if (retake !== undefined) {
    const inProgress: InProgressAttempts = [retake, ...otherRetakes];
    return evaluateInProgressPrerequisite(
      { counted, inProgress, minimumGrade: leaf.minimumGrade },
      context,
    );
  }
  // SAFETY: a pending transfer could satisfy the course once evaluated, but it never counts
  // before an award, so it is UNKNOWN, never PASS (planning/08 §Eligibility semantics; AC03).
  return group.pendingTransfer.length > 0 ? PENDING_TRANSFER : current;
}
