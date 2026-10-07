/**
 * @file Selects an option's linked courses that its course checks don't cover, as UNKNOWN results.
 * @module @caa/engine/scheduling/linked-course-results
 * @requirement FR-06
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import {
  CheckKind,
  type CheckResult,
  CheckState,
  type Course,
  type CourseId,
  createCheckResult,
  PrerequisiteExpressionType,
  type PrerequisiteRootExpression,
  ReasonCode,
  type Section,
} from '@caa/domain';

import { countsOwnCredits, coursesOfBundle } from './section-bundle-credits';
import { compareText } from './tie-break-key';

/** The part of a prerequisite rule that selecting linked courses reads. */
export interface LinkedCourseRule {
  readonly courseId: CourseId;
  /** `NONE` states the course has no prerequisite of its own (ADR-0012 §1). */
  readonly expression: PrerequisiteRootExpression;
}

/** What selecting an option's linked courses reads. */
export interface LinkedCourseInput {
  /** The option's bundles; only their sections are read. */
  readonly bundles: readonly { readonly sections: readonly Section[] }[];
  /** The requested courses: one per bundle. */
  readonly requestedCourseIds: readonly CourseId[];
  /** Catalog courses of every section of the bundles. */
  readonly courses: readonly Course[];
  /** Every prerequisite rule of the pinned ruleset for a course of the bundles. */
  readonly prerequisiteRules: readonly LinkedCourseRule[];
}

/** One linked course's results, in the per-course shape of the course-set checks. */
export interface LinkedCourseResult {
  readonly courseId: CourseId;
  /** UNKNOWN `LINKED_COURSE_NOT_CHECKED`: the course's prerequisite wasn't verified. */
  readonly prerequisite: CheckResult;
  /** UNKNOWN `LINKED_COURSE_NOT_CHECKED`: the course's applicability wasn't verified. */
  readonly applicability: CheckResult;
}

/**
 * Lists the linked courses of an option that its requested courses' checks don't cover, each
 * with UNKNOWN prerequisite and applicability results.
 *
 * A course is listed when a bundle has a section of it and it isn't requested, unless its
 * credits are included in a planned course and its only rule is `NONE`. A course with no rule
 * row is listed: missing semantics are UNKNOWN, never "no prerequisite" (ADR-0012 §1).
 *
 * @param input - The option's bundles, the requested courses, the catalog and the rules.
 * @returns One result per listed course, ascending by course ID (UTF-16 code units), no repeats.
 * @throws {ScheduleInputError} When a section's course isn't supplied (`courseMissing`).
 */
export function linkedCourseResultsOf(input: LinkedCourseInput): LinkedCourseResult[] {
  const courseById = new Map(input.courses.map((course) => [course.id, course]));
  const planCourses = input.bundles.flatMap((bundle) =>
    coursesOfBundle(bundle.sections, courseById),
  );
  const planCourseIds = new Set(planCourses.map((course) => course.id));
  const requested = new Set(input.requestedCourseIds);
  // SAFETY: only a `NONE` rule states a course has no prerequisite of its own. A course with no
  // rule row has unknown semantics, not none, so it is never treated as covered; a course with
  // any other rule carries a prerequisite of its own (ADR-0012 §1, amending ADR-0010
  // Amendment 4).
  const statedNone = new Set(
    input.prerequisiteRules
      .filter((rule) => rule.expression.type === PrerequisiteExpressionType.None)
      .map((rule) => rule.courseId),
  );
  const withOwnRule = new Set(
    input.prerequisiteRules
      .filter((rule) => rule.expression.type !== PrerequisiteExpressionType.None)
      .map((rule) => rule.courseId),
  );
  // SAFETY: a linked course outside the requested set was never checked, so it is shown as
  // UNKNOWN and never left out, unless its credits are included in a planned course and its rule
  // states no prerequisite: then it is a component of that course, which its checks cover
  // (ADR-0012 §1; ADR-0010 Amendment 4; planning/08 §Candidate formation).
  const selected = planCourses.filter(
    (course) =>
      !requested.has(course.id) &&
      (countsOwnCredits(course, planCourseIds) ||
        !statedNone.has(course.id) ||
        withOwnRule.has(course.id)),
  );
  return [...new Set(selected.map((course) => course.id))].sort(compareText).map((courseId) => ({
    courseId,
    prerequisite: notChecked(CheckKind.Prerequisite),
    applicability: notChecked(CheckKind.RequirementApplicability),
  }));
}

/**
 * Builds an UNKNOWN check that a linked course wasn't verified.
 *
 * @param kind - The check's kind.
 * @returns The check, with no source reference or evidence, because nothing was evaluated.
 */
function notChecked(kind: CheckKind): CheckResult {
  return createCheckResult({
    kind,
    state: CheckState.Unknown,
    reasonCode: ReasonCode.LinkedCourseNotChecked,
  });
}
