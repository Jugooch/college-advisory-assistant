/**
 * @file Runs scheduling golden cases through `@caa/engine`'s public API only (`buildSectionBundles`
 *   and `solveSchedule`), and lists every way the answer departs from the case's expectation,
 *   each prefixed with the case ID and the field. It builds the solver input the way the API
 *   service does, from the case's own inputs, so a case replays alone.
 * @module @caa/tests/support/golden-schedule-runner
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/standards/07-testing.md
 */
import type { CheckResult, Course, SectionId } from '@caa/domain';
import {
  buildSectionBundles,
  type ScheduleSolution,
  type SolvedScheduleOption,
  solveSchedule,
} from '@caa/engine';
import {
  type ExpectedSchedule,
  type GoldenScheduleCase,
  makesClaim,
  type ScheduleProhibitedClaim,
} from '@caa/test-kit';

import { compareCheck, differ } from './golden-runner';

/**
 * Finds a requested course in the case's catalog.
 *
 * @param courseById - The catalog by course ID.
 * @param courseId - The requested course; the case schema guarantees it is listed.
 * @returns The course.
 * @throws {Error} When the case lists no such course.
 */
function requestedCourse(courseById: ReadonlyMap<string, Course>, courseId: string): Course {
  const course = courseById.get(courseId);
  if (course === undefined) {
    throw new Error(`requested course ${courseId} is not in the case's catalog`);
  }
  return course;
}

/**
 * Solves a scheduling case with exactly the case's inputs.
 *
 * @param golden - The case.
 * @returns The solver's answer.
 * @throws {Error} Whatever the engine throws; {@link findScheduleMismatches} reports it.
 */
export function runScheduleCase(golden: GoldenScheduleCase): ScheduleSolution {
  const { inputs } = golden;
  const courseById = new Map(inputs.courses.map((course) => [course.id, course] as const));
  return solveSchedule({
    requests: inputs.requestedCourseIds.map((courseId) => ({
      courseId,
      bundles: buildSectionBundles({
        course: requestedCourse(courseById, courseId),
        snapshot: inputs.sectionSnapshot,
        linkedCourses: inputs.courses,
        transitionPolicy: inputs.transitionPolicy,
      }),
    })),
    selectedCredits: new Map(
      inputs.creditSelections.map((s) => [s.courseId, s.selectedCreditsHundredths] as const),
    ),
    policy: inputs.academicPolicy,
    prerequisiteRules: [],
    constraints: inputs.constraints,
    transitionPolicy: inputs.transitionPolicy,
    workCap: inputs.workCap,
  });
}

/**
 * Lists an option's sections, ascending: the same set whatever the bundle order.
 *
 * @param option - The solver's option.
 * @returns The section IDs.
 */
function sectionIdsOfOption(option: SolvedScheduleOption): SectionId[] {
  return option.bundles.flatMap(({ bundle }) => bundle.sections.map((s) => s.id)).sort();
}

/**
 * Compares one expected option with the solver's option at the same rank.
 *
 * @param expected - The expected option.
 * @param returned - The solver's option, or `undefined` when it returned fewer.
 * @param at - The option's position, for messages.
 * @returns One message per difference.
 */
function compareOption(
  expected: ExpectedSchedule['options'][number],
  returned: SolvedScheduleOption | undefined,
  at: string,
): string[] {
  if (returned === undefined) {
    return [];
  }
  const unmet = [...new Set(returned.unmetPreferences.map((u) => u.constraintIndex))].sort(
    (first, second) => first - second,
  );
  return [
    ...compareCheck(
      expected.scheduleFeasibility.check,
      returned.scheduleFeasibility,
      `${at}.schedule`,
    ),
    ...(expected.creditLoad === undefined
      ? []
      : compareCheck(expected.creditLoad, returned.creditLoad, `${at}.creditLoad`)),
    expected.unmetPreferenceIndexes === undefined
      ? null
      : differ(`${at}.unmetPreferenceIndexes`, expected.unmetPreferenceIndexes, unmet),
  ].filter((message) => message !== null);
}

/**
 * Compares the expected conflict set with the solver's, item by item.
 *
 * @param expected - The expected conflict set, or `null` when none is expected.
 * @param actual - The solver's conflict set, or `null`.
 * @returns One message per difference.
 */
function compareConflictSet(
  expected: ExpectedSchedule['conflictSet'],
  actual: ScheduleSolution['conflictSet'],
): string[] {
  return [
    ...compareChecks('conflictSet.items', expected?.items ?? [], actual?.items ?? []),
    differ(
      'conflictSet.omittedCount',
      expected?.omittedCount ?? null,
      actual?.omittedCount ?? null,
    ),
  ].filter((message) => message !== null);
}

/**
 * Compares one answer with one complete expected result.
 *
 * @param expected - The expected result.
 * @param actual - The solver's answer.
 * @returns One message per difference.
 */
function compareResult(expected: ExpectedSchedule, actual: ScheduleSolution): string[] {
  const optionIds = actual.options.map(sectionIdsOfOption);
  const optionSets = differ(
    'options.sectionIds',
    expected.options.map((option) => option.sectionIds),
    optionIds,
  );
  const perOption = expected.options.flatMap((option, index) =>
    compareOption(option, actual.options[index], `options[${String(index)}]`),
  );
  return [
    differ('outcome', expected.outcome, actual.outcome),
    differ('searchComplete', expected.searchComplete, actual.searchComplete),
    optionSets,
    ...(optionSets === null ? perOption : []),
    ...compareConflictSet(expected.conflictSet, actual.conflictSet),
    ...compareChecks('unresolved', expected.unresolved, actual.unresolved),
  ].filter((message) => message !== null);
}

/**
 * Compares expected items with returned checks, in order.
 *
 * @param at - The field name, for messages.
 * @param expected - The expected items, each a check with its issues.
 * @param actual - The returned checks.
 * @returns One message per difference.
 */
function compareChecks(
  at: string,
  expected: ExpectedSchedule['unresolved'],
  actual: readonly CheckResult[],
): string[] {
  const count = differ(`${at}.length`, expected.length, actual.length);
  if (count !== null) {
    return [
      count,
      `${at}: got ${JSON.stringify(actual.map((check) => [check.kind, check.state, check.reasonCode]))}`,
    ];
  }
  return expected.flatMap(({ check, issues }, index) => {
    const returned = actual[index];
    return returned === undefined
      ? []
      : compareCheck(
          {
            ...check,
            evidence: {
              ...check.evidence,
              ...(issues.length > 0 ? { scheduleIssues: issues } : {}),
            },
          },
          returned,
          `${at}[${String(index)}]`,
        );
  });
}

/**
 * Lists every prohibited claim the answer makes: an outcome, or a check state for an option.
 *
 * @param prohibited - The case's prohibited claims.
 * @param actual - The solver's answer.
 * @returns One message per violation.
 */
function findProhibitedClaims(
  prohibited: readonly ScheduleProhibitedClaim[],
  actual: ScheduleSolution,
): string[] {
  const observed: ExpectedSchedule = {
    outcome: actual.outcome,
    searchComplete: actual.searchComplete,
    options: actual.options.map((option) => ({
      sectionIds: sectionIdsOfOption(option),
      scheduleFeasibility: {
        check: {
          kind: option.scheduleFeasibility.kind,
          state: option.scheduleFeasibility.state,
          reasonCode: option.scheduleFeasibility.reasonCode ?? null,
        },
        issues: [],
      },
    })),
    conflictSet: null,
    unresolved: [],
  };
  return prohibited
    .filter((claim) => makesClaim(observed, claim))
    .map((claim) => `prohibited ${claim.outcome ?? claim.state ?? ''}: ${claim.claim}`);
}

/**
 * Runs a case and lists every way the answer departs from its expectation.
 *
 * @param golden - The case.
 * @returns One message per difference, each starting with the case ID; empty when it is met.
 */
export function findScheduleMismatches(golden: GoldenScheduleCase): string[] {
  let actual: ScheduleSolution;
  try {
    actual = runScheduleCase(golden);
  } catch (error) {
    return [`${golden.id} threw: ${error instanceof Error ? error.message : String(error)}`];
  }
  const attempts = [golden.expected, ...golden.allowedAlternatives].map((expected) =>
    compareResult(expected, actual),
  );
  const best = attempts.find((messages) => messages.length === 0) ?? attempts[0] ?? [];
  return [...best, ...findProhibitedClaims(golden.prohibitedClaims, actual)].map(
    (message) => `${golden.id} ${message}`,
  );
}
