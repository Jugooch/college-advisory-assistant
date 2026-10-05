/**
 * @file Pure steps of the schedule-options read: build each requested course's section bundles
 * and run the solver, and assemble the response from
 * the solver's answer and the course-set checks (ADR-0008 logic role).
 * @module @caa/api/modules/schedule-options/schedule-options.logic
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-09
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type {
  ScheduleOption,
  ScheduleOptionsRequest,
  ScheduleOptionsResponse,
} from '@caa/api-contract';
import {
  type AcademicPolicy,
  type CampusTransitionPolicy,
  type CheckResult,
  type Course,
  type CourseId,
  ScheduleLimitation,
  type SectionSnapshot,
} from '@caa/domain';
import {
  aggregateCheckStates,
  buildSectionBundles,
  type ScheduleSolution,
  type SolvedBundle,
  type SolvedScheduleOption,
  solveSchedule,
  toBundleCourseSelections,
} from '@caa/engine';

import { selectCourseDisplays } from '../course-display/course-display.logic';
import type { CourseChecks } from '../course-verification/course-verification.logic';

/** Everything the solver step reads; all pinned for the session's tenant. */
export interface ScheduleSolveInputs {
  /** The requested courses from the catalog, in request order. */
  readonly courses: readonly Course[];
  /** The tenant's whole catalog, for the courses of linked sections. */
  readonly catalog: readonly Course[];
  readonly snapshot: SectionSnapshot;
  readonly transitionPolicy: CampusTransitionPolicy | null;
  readonly academicPolicy: AcademicPolicy;
  readonly request: ScheduleOptionsRequest;
  /** Validated `SCHEDULE_SOLVER_WORK_CAP`. */
  readonly workCap: number;
}

/**
 * Builds each requested course's bundles from the pinned snapshot and runs the solver.
 *
 * @param inputs - The pinned courses, sections, transition table, policy, request, and cap.
 * @returns The solver's answer.
 * @throws {ScheduleInputError} When the section data or the request can't be scheduled.
 * @throws {CandidateSetInputError} When a chosen credit value doesn't fit its course.
 */
export function solveScheduleOptions(inputs: ScheduleSolveInputs): ScheduleSolution {
  const { snapshot, transitionPolicy, request } = inputs;
  return solveSchedule({
    requests: inputs.courses.map((course) => ({
      courseId: course.id,
      bundles: buildSectionBundles({
        course,
        snapshot,
        linkedCourses: inputs.catalog,
        transitionPolicy,
      }),
    })),
    selectedCredits: new Map(
      request.creditSelections.map((selection) => [
        selection.courseId,
        selection.selectedCreditsHundredths,
      ]),
    ),
    policy: inputs.academicPolicy,
    constraints: request.constraints,
    transitionPolicy,
    workCap: inputs.workCap,
  });
}

/** One section as the option card shows it. */
type ScheduledSection = ScheduleOption['bundles'][number]['sections'][number];

/**
 * Lists one bundle's sections for the response, each saying whether its course adds credits.
 *
 * @param solved - The chosen bundle.
 * @param countsById - Whether each course of the option counts its own credits.
 * @returns The sections, in the bundle's order.
 */
function sectionsOf(
  solved: SolvedBundle,
  countsById: ReadonlyMap<CourseId, boolean>,
): ScheduledSection[] {
  return solved.bundle.sections.map((section) => ({
    sectionId: section.id,
    courseId: section.courseId,
    sectionCode: section.sectionCode,
    modality: section.modality,
    campusId: section.campusId,
    startsOn: section.startsOn,
    endsOn: section.endsOn,
    meetings: section.meetings,
    // NOTE: the map holds every course of the option's bundles, and a bundle's courses are its
    // sections' courses, so every section finds its course's decision here.
    countsCredits: countsById.get(section.courseId) === true,
  }));
}

/**
 * Builds one response option from a solver option and the request's academic checks.
 *
 * @param solved - The solver option.
 * @param checks - The course-set checks, the same for every option (ADR-0010 §2).
 * @returns The option.
 * @throws {Error} When the option's credit inclusion is undecided, which the solver never offers.
 */
function toOption(solved: SolvedScheduleOption, checks: CourseChecks): ScheduleOption {
  const inclusion = toBundleCourseSelections(
    solved.bundles.map((entry) => entry.bundle),
    new Map(),
  );
  if (!inclusion.isKnown) {
    throw new Error('The solver offered an option whose credit inclusion is unknown');
  }
  const countsById = new Map(
    inclusion.selections.map((selection) => [selection.course.id, selection.countsCredits]),
  );
  const setResults = {
    allocation: checks.setResults.allocation,
    creditLoad: solved.creditLoad,
  };
  const states: CheckResult[] = [
    solved.scheduleFeasibility,
    ...checks.courseResults.flatMap(({ prerequisite, applicability }) =>
      prerequisite === null ? [applicability] : [prerequisite, applicability],
    ),
    ...setResults.allocation,
    setResults.creditLoad,
  ];
  return {
    rank: solved.rank,
    bundles: solved.bundles.map((entry) => ({
      courseId: entry.bundle.courseId,
      sections: sectionsOf(entry, countsById),
      creditsCountedHundredths: entry.creditsCountedHundredths,
    })),
    scheduleFeasibility: solved.scheduleFeasibility,
    courseResults: checks.courseResults,
    setResults,
    unmetPreferences: solved.unmetPreferences,
    // SAFETY: the option's aggregate follows every check it shows, schedule feasibility among
    // them, by the fixed precedence, so an UNKNOWN is never shown as validated.
    aggregate: aggregateCheckStates(states.map((check) => check.state)),
  };
}

/** Everything a response is assembled from. */
export interface ScheduleResponseParts {
  readonly request: ScheduleOptionsRequest;
  readonly solution: ScheduleSolution;
  readonly checks: CourseChecks;
  readonly catalog: readonly Course[];
  readonly snapshot: Pick<SectionSnapshot, 'id'>;
  readonly transitionPolicy: Pick<CampusTransitionPolicy, 'version'> | null;
  /** `sha256:` and the hex digest of the engine's normalized request text. */
  readonly constraintHash: string;
}

/**
 * Assembles the response from the solver's answer and the request's academic checks.
 *
 * @param parts - The request, the answer, the checks, the catalog, and the pinned sources.
 * @returns The response body, before contract validation.
 * @throws {Error} When an option's credit inclusion is undecided.
 */
export function toScheduleOptionsResponse(parts: ScheduleResponseParts): ScheduleOptionsResponse {
  const { request, solution, checks } = parts;
  const options = solution.options.map((option) => toOption(option, checks));
  const namedCourseIds = [
    ...request.courseIds,
    ...options.flatMap((option) =>
      option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.courseId)),
    ),
  ];
  return {
    outcome: solution.outcome,
    searchComplete: solution.searchComplete,
    courseIds: request.courseIds,
    options,
    conflictSet: solution.conflictSet,
    unresolved: solution.unresolved,
    // SAFETY: seats and registration are never checked, so every response says so (ADR-0010 §5).
    limitations: Object.values(ScheduleLimitation),
    pinnedInputs: {
      ...checks.pinnedInputs,
      sectionSnapshotId: parts.snapshot.id,
      campusTransitionVersion: parts.transitionPolicy?.version ?? null,
      solverWorkCap: solution.workCap,
      constraintHash: parts.constraintHash,
    },
    courses: selectCourseDisplays(namedCourseIds, parts.catalog),
  };
}
