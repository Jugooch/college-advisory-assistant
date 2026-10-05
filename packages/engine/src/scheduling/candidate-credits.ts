/**
 * @file Credit load of schedule candidates: a fast total for the search, and the real checks.
 * @module @caa/engine/scheduling/candidate-credits
 * @requirement FR-06
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type AcademicPolicy,
  type CheckResult,
  CheckState,
  type Course,
  type CourseId,
  createCheckResult,
  type ReasonCode,
  type ScheduleConstraint,
  ScheduleConstraintKind,
} from '@caa/domain';

import type { CourseSelection } from '../verification/candidate-set';
import { selectedCreditsOf } from '../verification/candidate-set';
import { checkCreditLoad, creditLoadOutcomeOf } from '../verification/check-credit-load';
import { ScheduleInputError } from './schedule-input-error';
import { toBundleCourseSelections } from './section-bundle-credits';

/** Inclusive credit bounds in hundredths. */
interface Bounds {
  readonly minCreditsHundredths: number;
  readonly maxCreditsHundredths: number;
}

/** Bounds that admit any load, for filling a range's open sides when nothing narrows them. */
const UNBOUNDED: Bounds = {
  minCreditsHundredths: 0,
  maxCreditsHundredths: Number.MAX_SAFE_INTEGER,
};

/** One course's credits and the course that can include them, by position. */
export interface CourseCredits {
  readonly courseId: CourseId;
  /** Credits in hundredths, or `null` for an unchosen variable value. */
  readonly credits: number | null;
  /** Position of the course that includes its credits, or -1 when none can. */
  readonly includer: number;
}

/** The bounds a candidate's credit load is judged by. */
export interface CreditModel {
  readonly policyBounds: Bounds | null;
  /** The student's hard credit range, filled from the policy (or unbounded) on an open side. */
  readonly studentBounds: { readonly constraintIndex: number; readonly bounds: Bounds } | null;
  /** The preferred credit range, open sides unbounded. */
  readonly preferredBounds: Bounds | null;
}

/** A candidate's credit state and the reason, as the real check would give it. */
export interface CreditVerdict {
  readonly state: CheckState;
  readonly reasonCode: ReasonCode | null;
}

/**
 * Returns a plan's selections, refusing a plan whose credit inclusion is unknown.
 *
 * @param bundles - The plan's bundles.
 * @param selectedCredits - The chosen variable credit values.
 * @returns The selections for `checkCreditLoad`.
 * @throws {ScheduleInputError} When a course's inclusion is omitted and another course of the
 *   plan could include it (`creditInclusionUnknown`).
 */
export function knownSelectionsOf(
  bundles: readonly { readonly courses: readonly Course[] }[],
  selectedCredits: ReadonlyMap<CourseId, number>,
): readonly CourseSelection[] {
  const result = toBundleCourseSelections(bundles, selectedCredits);
  // SAFETY: the domain has no reason code for a load left unknown by an omitted inclusion, so
  // the solver refuses the input instead of guessing either total (planning/08 §Authority and
  // result semantics). It goes away once the field is required (#229).
  if (!result.isKnown) {
    throw new ScheduleInputError('creditInclusionUnknown');
  }
  return result.selections;
}

/**
 * Reads each course's credits and the course that can include them.
 *
 * @param courses - Every distinct course across the requests' bundles.
 * @param selectedCredits - The chosen variable credit values.
 * @returns One entry per course, by position.
 * @throws {CandidateSetInputError} When a chosen value doesn't fit its course.
 */
export function creditsByCourse(
  courses: readonly Course[],
  selectedCredits: ReadonlyMap<CourseId, number>,
): CourseCredits[] {
  const indexOf = new Map<string, number>(courses.map((course, index) => [course.id, index]));
  // NOTE: mirrors `countsCreditsInPlan` for plans whose inclusion is known, which the solver
  // checks first with `knownSelectionsOf`; options and conflicts are rebuilt through it.
  return courses.map((course) => ({
    courseId: course.id,
    credits: selectedCreditsOf({
      course,
      selectedCreditsHundredths: selectedCredits.get(course.id) ?? null,
      countsCredits: true,
    }),
    includer: indexOf.get(course.creditsIncludedInCourseId ?? '') ?? -1,
  }));
}

/**
 * Reads the bounds a load is judged by: the policy's, the student's hard range inside them,
 * and the student's preferred range.
 *
 * @param policy - The academic policy.
 * @param constraints - The request's constraints.
 * @returns The bounds parts of the model.
 * @throws {ScheduleInputError} When the hard range admits no load inside the policy's bounds
 *   (`creditRange`).
 */
export function boundsOf(
  policy: AcademicPolicy,
  constraints: readonly ScheduleConstraint[],
): CreditModel {
  const policyBounds = policy.termCreditBounds;
  const ranges = constraints.flatMap((constraint, constraintIndex) =>
    constraint.kind === ScheduleConstraintKind.CreditRange ? [{ constraint, constraintIndex }] : [],
  );
  const hard = ranges.find(({ constraint }) => constraint.priorityRank === null);
  const preferred = ranges.find(({ constraint }) => constraint.priorityRank !== null);
  // SAFETY: the student's hard range is kept even when the policy has no bounds, so a known
  // total outside it still fails; hard rules are never relaxed (ADR-0010 §3).
  return {
    policyBounds,
    studentBounds:
      hard === undefined
        ? null
        : {
            constraintIndex: hard.constraintIndex,
            bounds: within(hard.constraint, policyBounds ?? UNBOUNDED),
          },
    preferredBounds: preferred === undefined ? null : within(preferred.constraint, UNBOUNDED),
  };
}

/**
 * Fills a student range's open sides from outer bounds and narrows it to them.
 *
 * @param range - The student's range; either side may be `null`.
 * @param outer - The bounds it must stay within.
 * @returns The narrowed bounds.
 * @throws {ScheduleInputError} When nothing is left (`creditRange`).
 */
function within(
  range: {
    readonly minCreditsHundredths: number | null;
    readonly maxCreditsHundredths: number | null;
  },
  outer: Bounds,
): Bounds {
  // SAFETY: the student's range applies inside the policy's bounds and never widens them
  // (planning/08 §Constraint formulation).
  const min = Math.max(range.minCreditsHundredths ?? 0, outer.minCreditsHundredths);
  const max = Math.min(
    range.maxCreditsHundredths ?? outer.maxCreditsHundredths,
    outer.maxCreditsHundredths,
  );
  if (min > max) {
    throw new ScheduleInputError('creditRange');
  }
  return { minCreditsHundredths: min, maxCreditsHundredths: max };
}

/**
 * Judges a candidate's total the way the real checks would.
 *
 * @param model - The credit model.
 * @param total - The candidate's total, or `null` when a variable value isn't chosen.
 * @returns FAIL when the policy or the student's hard range is broken on a known total,
 *   otherwise UNKNOWN when the total or the policy bounds are unknown, otherwise PASS.
 */
export function creditVerdictOf(model: CreditModel, total: number | null): CreditVerdict {
  const unknown = { state: CheckState.Unknown, reasonCode: null };
  // SAFETY: an unknown total can't be decided, so the load is UNKNOWN, never PASS
  // (planning/08 §Constraint formulation; AC18).
  if (total === null) return unknown;
  const student =
    model.studentBounds === null
      ? null
      : creditLoadOutcomeOf({ totalCreditsHundredths: total, ...model.studentBounds.bounds });
  // SAFETY: missing policy bounds leave the load UNKNOWN, but a known total outside the
  // student's hard range is still a FAIL; FAIL takes precedence over UNKNOWN (ADR-0010 §3;
  // planning/08 §Authority and result semantics).
  if (model.policyBounds === null) {
    return student?.state === CheckState.Fail ? student : unknown;
  }
  const policy = creditLoadOutcomeOf({ totalCreditsHundredths: total, ...model.policyBounds });
  return policy.state === CheckState.Fail || student === null ? policy : student;
}

/**
 * Returns whether a total misses the preferred credit range.
 *
 * @param model - The credit model.
 * @param total - The total, or `null` when unknown.
 * @returns `true` when it is outside the range or unknown.
 */
export function missesPreferredRange(model: CreditModel, total: number | null): boolean {
  if (model.preferredBounds === null) return false;
  return (
    total === null ||
    creditLoadOutcomeOf({ totalCreditsHundredths: total, ...model.preferredBounds }).state ===
      CheckState.Fail
  );
}

/**
 * Builds a plan's real credit-load check: the policy's, unless it doesn't fail and the
 * student's hard range fails, which is reported with a reference naming that constraint.
 *
 * @param selections - The plan's selections.
 * @param policy - The academic policy.
 * @param model - The credit model, for the student's range.
 * @returns The validated CREDIT_LOAD check.
 */
export function creditLoadCheckOf(
  selections: readonly CourseSelection[],
  policy: AcademicPolicy,
  model: CreditModel,
): CheckResult {
  const policyCheck = checkCreditLoad(selections, policy);
  const { studentBounds } = model;
  if (policyCheck.state === CheckState.Fail || studentBounds === null) {
    return policyCheck;
  }
  const studentCheck = checkCreditLoad(selections, {
    ...policy,
    termCreditBounds: studentBounds.bounds,
  });
  // SAFETY: a policy check that is UNKNOWN for missing bounds doesn't hide a known total
  // outside the student's hard range; that is a FAIL (ADR-0010 §3). An unknown total leaves
  // both UNKNOWN, and the policy's check is returned.
  if (studentCheck.state !== CheckState.Fail) {
    return policyCheck;
  }
  return createCheckResult({
    ...studentCheck,
    sourceRef: `${policy.rulesetVersion}:constraints[${String(studentBounds.constraintIndex)}]`,
  });
}
