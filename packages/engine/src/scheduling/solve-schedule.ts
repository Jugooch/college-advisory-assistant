/**
 * @file The schedule solver: one bundle per requested course, every hard rule kept, best three.
 * @module @caa/engine/scheduling/solve-schedule
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { ScheduleConstraintKind, ScheduleOutcome } from '@caa/domain';

import {
  buildConflictSet,
  buildOptions,
  creditConflictsOf,
  type OptionContext,
  type SolverBundle,
} from './build-schedule-options';
import { buildPairTable } from './bundle-pair-table';
import { boundsOf, creditsByCourse } from './candidate-credits';
import { type PreparedRequest, prepareSolverRequest } from './prepare-solver-requests';
import { compareRankKeys } from './schedule-rank';
import type { ScheduleSolution, SolveScheduleInput } from './schedule-solution';
import { type SearchResult, searchSchedules, type SearchSpace } from './search-schedules';
import { compareText } from './tie-break-key';

/**
 * Finds up to three schedule options for the requested courses (ADR-0010).
 *
 * Before the search, each course's bundles are screened against the hard unavailable times,
 * modalities and campuses. If a course is left with no bundle:
 * - every bundle broke a hard rule on known data: `NO_FEASIBLE_PLAN` with the FAILs;
 * - otherwise data is missing (no sections, or a linked component with none):
 *   `NEEDS_VERIFICATION` with the UNKNOWN results, and no search.
 *
 * A course that keeps some bundles but had sections dropped for missing data still enters the
 * search; if the search then finishes with no candidate, the outcome is `NEEDS_VERIFICATION`
 * with those UNKNOWN results, never `NO_FEASIBLE_PLAN`.
 *
 * The search then tries one bundle per course, never relaxing the pairwise meeting and travel
 * rules or the credit load against the policy and the student's hard range. It counts each
 * attempt against the cap and never reads a clock. Options are ranked by schedule feasibility
 * (PASS first), then preferences in priority order, then the sorted section IDs, and are
 * always distinct. A capped search with candidates says `searchComplete: false`; one with none
 * is `SEARCH_TIMEOUT`, never infeasible. The result doesn't depend on the order of the
 * requests or of their sections.
 *
 * @param input - The requests, credit choices, policy, constraints, transition table and cap.
 * @returns The outcome, options or evidence, and the cap and work used.
 * @throws {ScheduleInputError} When the input is malformed (see `prepareSolverRequest`).
 * @throws {CandidateSetInputError} When a chosen credit value doesn't fit its course.
 */
export function solveSchedule(input: SolveScheduleInput): ScheduleSolution {
  const prepared = prepareSolverRequest(input);
  const base = { workCap: input.workCap, workUsed: 0, options: [], unresolved: [] };
  if (prepared.courses.some((course) => course.isInfeasible)) {
    return {
      ...base,
      outcome: ScheduleOutcome.NoFeasiblePlan,
      searchComplete: true,
      conflictSet: buildConflictSet(prepared.conflicts, { entries: [], count: 0 }),
    };
  }
  const unresolved = prepared.courses.flatMap((course) => course.unresolved);
  if (unresolved.length > 0) {
    return {
      ...base,
      outcome: ScheduleOutcome.NeedsVerification,
      searchComplete: false,
      conflictSet: null,
      unresolved,
    };
  }
  return search(input, prepared);
}

/**
 * Runs the search over the screened courses and builds the answer.
 *
 * @param input - The solver input.
 * @param prepared - Every course with at least one bundle.
 * @returns The solution.
 */
function search(input: SolveScheduleInput, prepared: PreparedRequest): ScheduleSolution {
  const bundles = solverBundlesOf(input, prepared);
  const table = buildPairTable(
    bundles.map((entry) => ({
      requestIndex: entry.requestIndex,
      sections: entry.screened.bundle.sections,
    })),
    input.transitionPolicy,
  );
  const credits = boundsOf(input.policy, input.constraints);
  const creditSlot = prepared.slots.findIndex(
    (slot) => slot.kind === ScheduleConstraintKind.CreditRange,
  );
  const space: SearchSpace = {
    courses: searchOrderOf(bundles, prepared.courses.length),
    courseCount: new Set(
      bundles.flatMap((entry) => entry.search.courses.map((course) => course.index)),
    ).size,
    slotCount: prepared.slots.length,
    table,
    credits,
    creditSlot: creditSlot === -1 ? null : creditSlot,
  };
  const result = searchSchedules(space, input.workCap);
  const context = { input, bundles, table, credits, slots: prepared.slots };
  const base = { workCap: input.workCap, workUsed: result.workUsed, unresolved: [] };
  if (result.top.length > 0) {
    return {
      ...base,
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: !result.capHit,
      options: buildOptions(result.top, context),
      conflictSet: null,
    };
  }
  // SAFETY: running out of work before any candidate proves nothing, so it is SEARCH_TIMEOUT,
  // never "no feasible schedule" (AC12; ADR-0010 §5).
  if (result.capHit) {
    return {
      ...base,
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      options: [],
      conflictSet: null,
    };
  }
  return noCandidateSolution(result, prepared, context);
}

/**
 * Builds the answer for a search that finished within the cap with no candidate.
 *
 * @param result - The search result.
 * @param prepared - The screened courses.
 * @param context - The option context, for the credit FAILs.
 * @returns `NEEDS_VERIFICATION` when a course had sections dropped for missing data,
 *   otherwise `NO_FEASIBLE_PLAN` with the conflict set.
 */
function noCandidateSolution(
  result: SearchResult,
  prepared: PreparedRequest,
  context: OptionContext,
): ScheduleSolution {
  const base = { workCap: context.input.workCap, workUsed: result.workUsed, options: [] };
  const dropped = prepared.courses.flatMap((course) => course.dropped);
  // SAFETY: when sections were dropped for missing data, finding nothing among the rest proves
  // nothing about them, so the answer needs verification, never NO_FEASIBLE_PLAN (ADR-0010 §5:
  // proven on known data only; §6: a linked component with no permitted section is UNKNOWN).
  if (dropped.length > 0) {
    return {
      ...base,
      outcome: ScheduleOutcome.NeedsVerification,
      searchComplete: false,
      conflictSet: null,
      unresolved: dropped,
    };
  }
  return {
    ...base,
    outcome: ScheduleOutcome.NoFeasiblePlan,
    searchComplete: true,
    unresolved: [],
    conflictSet: buildConflictSet(
      [...prepared.conflicts, ...result.pairFails],
      creditConflictsOf(result, context),
    ),
  };
}

/**
 * Lists every kept bundle with its search data, by course ID then tie-break order.
 *
 * @param input - The solver input.
 * @param prepared - The screened courses.
 * @returns The bundles; each one's position is its pair-table index.
 */
function solverBundlesOf(input: SolveScheduleInput, prepared: PreparedRequest): SolverBundle[] {
  const screened = prepared.courses.flatMap((course, requestIndex) =>
    course.kept.map((entry) => ({ requestIndex, screened: entry })),
  );
  const sectionIds = [
    ...new Set(
      screened.flatMap((entry) => entry.screened.bundle.sections.map((section) => section.id)),
    ),
  ].sort(compareText);
  const courses = [
    ...new Map(
      screened.flatMap((entry) =>
        entry.screened.bundle.courses.map((course) => [course.id, course] as const),
      ),
    ).values(),
  ];
  const courseCredits = creditsByCourse(courses, input.selectedCredits).map((credits, index) => ({
    ...credits,
    index,
  }));
  return screened.map((entry, index) => {
    const { bundle, isUnknown, misses } = entry.screened;
    const ids = new Set<string>(bundle.sections.map((section) => section.id));
    const courseIds = new Set<string>(bundle.courses.map((course) => course.id));
    return {
      ...entry,
      search: {
        index,
        isUnknown,
        misses,
        // NOTE: positions in the sorted ID list, so they come out ascending.
        ordinals: sectionIds.flatMap((id, ordinal) => (ids.has(id) ? [ordinal] : [])),
        courses: courseCredits
          .filter((credits) => courseIds.has(credits.courseId))
          .map(({ index: position, credits, includer }) => ({
            index: position,
            credits,
            includer,
          })),
      },
    };
  });
}

/**
 * Orders the courses for the search: fewest bundles first, then by course ID; and each
 * course's bundles by their own ranking key (ADR-0010 §4, search order).
 *
 * @param bundles - Every bundle, by course ID then tie-break order.
 * @param courseCount - How many requested courses there are.
 * @returns Each course's bundles, in search order.
 */
function searchOrderOf(
  bundles: readonly SolverBundle[],
  courseCount: number,
): SearchSpace['courses'] {
  const byCourse = Array.from({ length: courseCount }, (_, requestIndex) =>
    bundles
      .filter((entry) => entry.requestIndex === requestIndex)
      .map((entry) => entry.search)
      .sort(compareRankKeys),
  );
  // NOTE: courses are already in course-ID order, and the sort is stable, so ties keep it.
  return byCourse.sort((first, second) => first.length - second.length);
}
