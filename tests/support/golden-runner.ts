/**
 * @file Runs golden cases through `@caa/engine`'s public API only, and lists every way a result
 *   departs from the case's expectation, each prefixed with the case ID and the field.
 * @module @caa/tests/support/golden-runner
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/standards/07-testing.md
 */
import { isDeepStrictEqual } from 'node:util';

import { CheckKind, type CheckResult } from '@caa/domain';
import {
  checkAllocation,
  checkCreditLoad,
  evaluateApplicability,
  evaluatePrerequisite,
  findMeetingConflicts,
  missingPrerequisiteRuleCheck,
} from '@caa/engine';
import { type ExpectedCheck, type GoldenCase } from '@caa/test-kit';

import { viewScheduleIssues } from './schedule-issue-view';

/** Evidence fields a case may assert. */
const EVIDENCE_FIELDS = ['rulesetVersion', 'decisiveLeaves', 'courseIds', 'creditLoad'] as const;

/**
 * Invokes the check a golden case names, with exactly the case's inputs.
 *
 * @param golden - The case.
 * @returns The checks the engine returned, in order.
 * @throws {Error} Whatever the engine throws; {@link findGoldenMismatches} reports it.
 */
export function runGoldenCase(golden: GoldenCase): readonly CheckResult[] {
  switch (golden.check) {
    case CheckKind.Prerequisite: {
      const { rule, attempts, courses, academicPolicy, termCalendar } = golden.inputs;
      if (rule === null) {
        return [missingPrerequisiteRuleCheck(academicPolicy.rulesetVersion)];
      }
      return [evaluatePrerequisite(rule, { attempts, courses }, { academicPolicy, termCalendar })];
    }
    case CheckKind.RequirementApplicability: {
      const { courseId, audit, freshness } = golden.inputs;
      return [evaluateApplicability(courseId, audit, freshness)];
    }
    case CheckKind.RequirementAllocation: {
      const { candidates, audit, freshness } = golden.inputs;
      return checkAllocation(candidates, audit, freshness);
    }
    case CheckKind.CreditLoad: {
      const { selections, academicPolicy } = golden.inputs;
      return [checkCreditLoad(selections, academicPolicy)];
    }
    case CheckKind.ScheduleFeasibility: {
      return [findMeetingConflicts(golden.inputs)];
    }
  }
}

/**
 * Formats one field mismatch.
 *
 * @param field - The field path, for example `checks[0].reasonCode`.
 * @param expected - The expected value.
 * @param actual - The value the engine returned.
 * @returns The message, or `null` when the values are deep-equal.
 */
export function differ(field: string, expected: unknown, actual: unknown): string | null {
  return isDeepStrictEqual(expected, actual)
    ? null
    : `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

/**
 * Compares one returned check with one expected check.
 *
 * @param expected - The expected check.
 * @param actual - The returned check.
 * @param at - The check's position, for messages.
 * @returns One message per field that differs.
 */
export function compareCheck(expected: ExpectedCheck, actual: CheckResult, at: string): string[] {
  const fields = [
    differ(`${at}.kind`, expected.kind, actual.kind),
    differ(`${at}.state`, expected.state, actual.state),
    differ(`${at}.reasonCode`, expected.reasonCode, actual.reasonCode ?? null),
    expected.sourceRef === undefined
      ? null
      : differ(`${at}.sourceRef`, expected.sourceRef, actual.sourceRef),
    ...EVIDENCE_FIELDS.map((key) =>
      expected.evidence?.[key] === undefined
        ? null
        : differ(`${at}.evidence.${key}`, expected.evidence[key], actual.evidence?.[key]),
    ),
    expected.evidence?.scheduleIssues === undefined
      ? null
      : differ(
          `${at}.evidence.scheduleIssues`,
          expected.evidence.scheduleIssues,
          viewScheduleIssues(
            expected.evidence.scheduleIssues,
            actual.evidence?.scheduleIssues ?? [],
          ),
        ),
  ];
  return fields.filter((message) => message !== null);
}

/**
 * Compares the returned checks with one complete expected result.
 *
 * @param expected - The expected checks, in order.
 * @param actual - The returned checks.
 * @returns One message per difference.
 */
function compareChecks(
  expected: readonly ExpectedCheck[],
  actual: readonly CheckResult[],
): string[] {
  const count = differ('checks.length', expected.length, actual.length);
  if (count !== null) {
    return [
      count,
      `checks: got ${JSON.stringify(actual.map((check) => [check.state, check.reasonCode]))}`,
    ];
  }
  return expected.flatMap((check, index) => {
    const returned = actual[index];
    return returned === undefined ? [] : compareCheck(check, returned, `checks[${String(index)}]`);
  });
}

/**
 * Lists every prohibited claim a returned check makes.
 *
 * @param golden - The case.
 * @param actual - The returned checks.
 * @returns One message per violation.
 */
function findProhibitedClaims(golden: GoldenCase, actual: readonly CheckResult[]): string[] {
  return actual.flatMap((check, index) =>
    golden.prohibitedClaims
      .filter((claim) => claim.state === check.state)
      .map((claim) => `checks[${String(index)}].state: prohibited ${claim.state}: ${claim.claim}`),
  );
}

/**
 * Runs a golden case and lists how the result departs from it. A result that matches the
 * expectation or any allowed alternative, and makes no prohibited claim, has no mismatches.
 *
 * @param golden - The case.
 * @returns One message per mismatch, each starting with the case ID; empty when the case holds.
 */
export function findGoldenMismatches(golden: GoldenCase): string[] {
  let actual: readonly CheckResult[];
  try {
    actual = runGoldenCase(golden);
  } catch (error) {
    return [`${golden.id} engine threw: ${error instanceof Error ? error.message : String(error)}`];
  }
  const primary = compareChecks(golden.expected, actual);
  const isAlternative = golden.allowedAlternatives.some(
    (alternative) => compareChecks(alternative, actual).length === 0,
  );
  const outcome = primary.length === 0 || isAlternative ? [] : primary;
  return [...outcome, ...findProhibitedClaims(golden, actual)].map(
    (message) => `${golden.id} ${message}`,
  );
}
