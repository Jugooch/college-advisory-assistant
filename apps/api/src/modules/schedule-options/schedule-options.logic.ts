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
  CampusDisplay,
  PlannableTerm,
  ScheduleOption,
  ScheduleOptionsRequest,
  ScheduleOptionsResponse,
} from '@caa/api-contract';
import {
  type AcademicPolicy,
  type Campus,
  type CampusTransitionPolicy,
  type CheckResult,
  type Course,
  type CourseId,
  type PrerequisiteRule,
  ScheduleLimitation,
  type SectionSnapshot,
  type Term,
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
  /** The pinned ruleset's rules for every course of the term's sections, linked ones included. */
  readonly prerequisiteRules: readonly PrerequisiteRule[];
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
    prerequisiteRules: inputs.prerequisiteRules,
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
 */
function toOption(solved: SolvedScheduleOption, checks: CourseChecks): ScheduleOption {
  const selections = toBundleCourseSelections(
    solved.bundles.map((entry) => entry.bundle),
    new Map(),
  );
  const countsById = new Map(
    selections.map((selection) => [selection.course.id, selection.countsCredits]),
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
    ...solved.linkedCourseResults.flatMap(({ prerequisite, applicability }) => [
      prerequisite,
      applicability,
    ]),
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
    // NOTE: the engine selects these; none is restated here (ADR-0010 Amendment 4).
    linkedCourseResults: solved.linkedCourseResults,
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
 */
export function toScheduleOptionsResponse(parts: ScheduleResponseParts): ScheduleOptionsBody {
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

/** The response before its display data: everything the engine and the checks decide. */
export type ScheduleOptionsBody = Omit<ScheduleOptionsResponse, 'term' | 'campuses'>;

/**
 * Reduces a term to the display fields the response carries.
 *
 * @param term - The requested term from the calendar.
 * @returns The term without its tenant and sequence.
 */
export function toTermDisplay(term: Term): PlannableTerm {
  return { id: term.id, termCode: term.termCode, startsOn: term.startsOn, endsOn: term.endsOn };
}

/** The campuses to show, and the named IDs that have no row. */
export interface CampusDisplaySelection {
  readonly campuses: readonly CampusDisplay[];
  readonly missingIds: readonly string[];
}

/**
 * Pairs each named campus ID with its loaded campus, keeping the ID order. Display only.
 *
 * @param namedIds - The IDs the response names, in the order to return.
 * @param loaded - The campuses the repository returned.
 * @returns One `{ id, name }` per found campus, and the IDs that were not found.
 */
export function selectCampusDisplays(
  namedIds: readonly string[],
  loaded: readonly Campus[],
): CampusDisplaySelection {
  const byId = new Map(loaded.map((campus) => [campus.id, campus]));
  const campuses: CampusDisplay[] = [];
  const missingIds: string[] = [];
  for (const id of namedIds) {
    const campus = byId.get(id as Campus['id']);
    if (campus === undefined) {
      missingIds.push(id);
    } else {
      campuses.push({ id: campus.id, name: campus.name });
    }
  }
  return { campuses, missingIds };
}
