/**
 * @file Validates a solver request and screens each course's bundles before the search.
 * @module @caa/engine/scheduling/prepare-solver-requests
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CheckResult,
  type CourseId,
  createScheduleIssue,
  ReasonCode,
  type Section,
  type SectionId,
} from '@caa/domain';

import { knownSelectionsOf } from './candidate-credits';
import { toScheduleFeasibilityCheck } from './schedule-feasibility-check';
import { ScheduleInputError } from './schedule-input-error';
import {
  DEFAULT_SOLVER_WORK_CAP,
  MAX_SOLVER_COURSES,
  type ScheduleCourseRequest,
  type SolveScheduleInput,
} from './schedule-solution';
import {
  type ConflictEntry,
  hardIndexesOf,
  type PreferenceSlot,
  preferenceSlotsOf,
  screenBundles,
  type ScreenedBundle,
} from './screen-bundles';
import {
  type ConstraintFinding,
  findSectionConstraintFindings,
} from './section-constraint-findings';
import { compareText } from './tie-break-key';

/** One requested course after screening. */
export interface PreparedCourse {
  readonly courseId: CourseId;
  /** Bundles that keep every hard constraint, in tie-break order. */
  readonly kept: readonly ScreenedBundle[];
  /** Whether every bundle it had broke a hard rule, with no data missing. */
  readonly isInfeasible: boolean;
  /** Why it has no bundle because data is missing; empty when it has one or is infeasible. */
  readonly unresolved: readonly CheckResult[];
}

/** The screened request. */
export interface PreparedRequest {
  /** The requested courses, by course ID. */
  readonly courses: readonly PreparedCourse[];
  /** The preferences, in priority order. */
  readonly slots: readonly PreferenceSlot[];
  /** FAILs found before the search. */
  readonly conflicts: readonly ConflictEntry[];
}

/**
 * Validates the request and screens each course's bundles against the hard constraints.
 *
 * @param input - The solver input.
 * @returns The courses by ID, the preference slots, and the FAILs found.
 * @throws {ScheduleInputError} When the cap isn't a whole number from 1 to the default
 *   (`workCap`), the courses aren't 1 to 8 distinct ones (`requests`), a course is in the
 *   bundles of two requested courses (`courseInTwoRequests`), or a plan's credit inclusion is
 *   unknown (`creditInclusionUnknown`).
 */
export function prepareSolverRequest(input: SolveScheduleInput): PreparedRequest {
  assertValidShape(input);
  const requests = [...input.requests].sort((first, second) =>
    compareText(first.courseId, second.courseId),
  );
  assertCoursesInOneRequest(requests);
  assertKnownInclusion(requests, input.selectedCredits);
  const slots = preferenceSlotsOf(input.constraints);
  const findings = new Map<SectionId, readonly ConstraintFinding[]>();
  const context = {
    hardIndexes: hardIndexesOf(input.constraints),
    slots,
    findingsOf: (section: Section): readonly ConstraintFinding[] => {
      const known = findings.get(section.id);
      if (known !== undefined) return known;
      const found = findSectionConstraintFindings(section, input.constraints);
      findings.set(section.id, found);
      return found;
    },
  };
  const screens = requests.map((request) => ({
    request,
    screen: screenBundles(request.bundles, context),
  }));
  return {
    courses: screens.map(({ request, screen }) => classify(request, screen.kept)),
    slots,
    conflicts: screens.flatMap(({ screen }) => screen.conflicts),
  };
}

/**
 * Decides whether a course can enter the search, or why not.
 *
 * @param request - The requested course and its bundles.
 * @param kept - Its bundles that keep every hard constraint.
 * @returns The prepared course.
 */
function classify(request: ScheduleCourseRequest, kept: readonly ScreenedBundle[]): PreparedCourse {
  const { courseId, bundles } = request;
  const base = { courseId, kept, isInfeasible: false, unresolved: [] };
  if (kept.length > 0) return base;
  const hasAnyBundle = bundles.bundles.length + bundles.blocked.length > 0;
  // SAFETY: a course whose every bundle broke a hard rule on known data is infeasible; if data
  // is missing too, it needs verification instead, never a claim that nothing fits (ADR-0010
  // §5: NO_FEASIBLE_PLAN before NEEDS_VERIFICATION, each only on its own grounds).
  if (hasAnyBundle && bundles.unavailable === null) {
    return { ...base, isInfeasible: true };
  }
  // SAFETY: a course is missing section data only when the snapshot has no section to build
  // from; a section dropped for an unavailable linked component is reported as that instead
  // (ADR-0010 §5 and §6).
  const unresolved =
    bundles.unavailable === null
      ? [
          toScheduleFeasibilityCheck([
            createScheduleIssue({ reasonCode: ReasonCode.SectionDataMissing, courseId }),
          ]),
        ]
      : [bundles.unavailable];
  return { ...base, unresolved };
}

/**
 * Checks the cap and the requested courses.
 *
 * @param input - The solver input.
 * @throws {ScheduleInputError} As {@link prepareSolverRequest} documents.
 */
function assertValidShape(input: SolveScheduleInput): void {
  const { workCap, requests } = input;
  if (!Number.isInteger(workCap) || workCap < 1 || workCap > DEFAULT_SOLVER_WORK_CAP) {
    throw new ScheduleInputError('workCap');
  }
  const ids = new Set(requests.map((request) => request.courseId));
  if (
    requests.length === 0 ||
    requests.length > MAX_SOLVER_COURSES ||
    ids.size !== requests.length
  ) {
    throw new ScheduleInputError('requests');
  }
}

/**
 * Checks that no course appears in the bundles of two requested courses.
 *
 * @param requests - The requests.
 * @throws {ScheduleInputError} When one does (`courseInTwoRequests`).
 */
function assertCoursesInOneRequest(requests: readonly ScheduleCourseRequest[]): void {
  const owner = new Map<CourseId, CourseId>();
  const uses = requests.flatMap((request) =>
    [...request.bundles.bundles, ...request.bundles.blocked].flatMap((bundle) =>
      bundle.courses.map((course) => ({ courseId: course.id, requestId: request.courseId })),
    ),
  );
  for (const { courseId, requestId } of uses) {
    // SAFETY: a course taken in two requested courses' bundles would be planned twice and its
    // credits counted twice, so the request is refused rather than guessed at.
    if ((owner.get(courseId) ?? requestId) !== requestId) {
      throw new ScheduleInputError('courseInTwoRequests');
    }
    owner.set(courseId, requestId);
  }
}

/**
 * Checks that every plan's credit inclusion is known. Whether an omitted inclusion matters
 * depends only on whether the plan has another course, so each bundle is checked with one
 * bundle of another requested course, when there is one.
 *
 * @param requests - The requests.
 * @param selectedCredits - The chosen variable credit values.
 * @throws {ScheduleInputError} When it isn't (`creditInclusionUnknown`).
 */
function assertKnownInclusion(
  requests: readonly ScheduleCourseRequest[],
  selectedCredits: ReadonlyMap<CourseId, number>,
): void {
  requests.forEach((request, position) => {
    const other = requests
      .filter((_, index) => index !== position)
      .flatMap((entry) => entry.bundles.bundles)
      .slice(0, 1);
    for (const bundle of request.bundles.bundles) {
      knownSelectionsOf([bundle, ...other], selectedCredits);
    }
  });
}
