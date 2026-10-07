/**
 * @file Evaluates a required course that the institution states is repeatable for credit.
 * @module @caa/engine/verification/evaluate-repeatable-prerequisite
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import {
  type AcademicPolicy,
  CheckState,
  CountingState,
  type CourseAttempt,
  type CoursePrerequisite,
  ReasonCode,
  type RepeatableForCredit,
} from '@caa/domain';

import { compareToMinimumGrade } from './compare-to-minimum-grade';
import type { LeafOutcome } from './evaluate-course-prerequisite';
import type { AttemptGroup } from './resolve-attempts';

const PASS: LeafOutcome = { state: CheckState.Pass, reasonCode: null };
const NO_QUALIFYING_ATTEMPT: LeafOutcome = {
  state: CheckState.Fail,
  reasonCode: ReasonCode.NoQualifyingAttempt,
};
const GRADE_NOT_RECORDED: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.GradeNotRecorded,
};
const PENDING_TRANSFER: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.PendingTransfer,
};
const PROGRESSION_NOT_PERMITTED: LeafOutcome = {
  state: CheckState.Fail,
  reasonCode: ReasonCode.ProgressionNotPermitted,
};
const REPEAT_ORDER_UNDETERMINED: LeafOutcome = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.RepeatOrderUndetermined,
};
const IN_PROGRESS_MIN_GRADE: LeafOutcome = {
  state: CheckState.Conditional,
  reasonCode: ReasonCode.InProgressMinGrade,
};

/** An attempt group whose catalog courses state that it is repeatable for credit. */
type RepeatableGroup = AttemptGroup & { readonly repeatableForCredit: RepeatableForCredit };

/** `ANY` precedence of the states a failing leaf's prospects can take; higher wins. */
const PROSPECT_RANK: Readonly<Record<LeafOutcome['state'], number>> = {
  [CheckState.Fail]: 0,
  [CheckState.Unknown]: 1,
  [CheckState.Conditional]: 2,
  [CheckState.Pass]: 3,
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

/**
 * Evaluates a required course whose group is repeatable for credit. The repeat policy isn't
 * consulted, because these attempts don't replace one another (ADR-0012 §2: prerequisite
 * leaves). The caller has already handled INCOMPLETE attempts and an UNDETERMINED count.
 *
 * Decisions, in order:
 * 1. Any counted attempt meets the minimum: PASS, whatever is in progress or pending.
 * 2. Any counted attempt's comparison is UNKNOWN: that UNKNOWN, earliest attempt first.
 * 3. Otherwise the record fails (the earliest attempt's reason, or `NO_QUALIFYING_ATTEMPT`),
 *    and the strongest prospect by `ANY` precedence replaces it: an in-progress attempt
 *    (see `evaluateRepeatableInProgress`) or a pending transfer (`PENDING_TRANSFER`).
 *
 * @param leaf - The required course and its minimum grade.
 * @param group - The repeatable group holding the course and its equivalents.
 * @param policy - The academic policy.
 * @returns The leaf's state and reason code.
 */
export function evaluateRepeatablePrerequisite(
  leaf: CoursePrerequisite,
  group: RepeatableGroup,
  policy: AcademicPolicy,
): LeafOutcome {
  const { counting } = group;
  const counted = counting.state === CountingState.Counted ? counting.attempts : [];
  const outcomes = counted.map((attempt) => compareAttemptToMinimum(attempt, leaf, policy));
  // SAFETY: counted attempts of a repeatable course all stand, so one that meets the minimum is
  // enough, as in an `ANY` group (ADR-0012 §2: prerequisite leaves).
  if (outcomes.some((outcome) => outcome.state === CheckState.Pass)) {
    return PASS;
  }
  // SAFETY: an UNKNOWN comparison stays UNKNOWN; no CONDITIONAL is offered on top of a grade
  // the engine can't compare (planning/08 §Authority and result semantics).
  const unknown = outcomes.find((outcome) => outcome.state === CheckState.Unknown);
  if (unknown !== undefined) {
    return unknown;
  }
  const prospects: LeafOutcome[] = [outcomes[0] ?? NO_QUALIFYING_ATTEMPT];
  // SAFETY: a pending transfer never counts before an award, so it is UNKNOWN, never PASS
  // (planning/08 §Eligibility semantics; AC03).
  if (group.pendingTransfer.length > 0) {
    prospects.push(PENDING_TRANSFER);
  }
  if (group.inProgress.length > 0) {
    prospects.push(evaluateRepeatableInProgress(group, counted.length, policy));
  }
  // NOTE: on a tie the later prospect wins, so its reason names the remediation.
  return prospects.reduce((best, prospect) =>
    PROSPECT_RANK[prospect.state] >= PROSPECT_RANK[best.state] ? prospect : best,
  );
}

/**
 * Evaluates a repeatable group's in-progress work when no counted attempt meets the minimum.
 *
 * @param group - The repeatable group, with at least one in-progress attempt.
 * @param countedCount - How many attempts already count.
 * @param policy - The academic policy.
 * @returns FAIL (`PROGRESSION_NOT_PERMITTED`), UNKNOWN (`REPEAT_ORDER_UNDETERMINED`), or
 *   CONDITIONAL (`IN_PROGRESS_MIN_GRADE`).
 */
function evaluateRepeatableInProgress(
  group: RepeatableGroup,
  countedCount: number,
  policy: AcademicPolicy,
): LeafOutcome {
  // SAFETY: planning on unfinished work needs the institution's permission (planning/08
  // §Eligibility semantics: in-progress prerequisites; AC02).
  if (!policy.allowsInProgressPrerequisites) {
    return PROGRESSION_NOT_PERMITTED;
  }
  const { maxAttempts } = group.repeatableForCredit;
  const competing = countedCount + group.pendingTransfer.length + group.inProgress.length;
  // SAFETY: with several attempts in progress the engine states no single condition, and when
  // the attempt cap may leave the in-progress attempt out, meeting the minimum wouldn't make it
  // count, so a CONDITIONAL would promise too much (ADR-0012 §2: caps; planning/08
  // §Authority and result semantics: CONDITIONAL states a sufficient condition).
  if (group.inProgress.length > 1 || (maxAttempts !== null && competing > maxAttempts)) {
    return REPEAT_ORDER_UNDETERMINED;
  }
  return IN_PROGRESS_MIN_GRADE;
}
