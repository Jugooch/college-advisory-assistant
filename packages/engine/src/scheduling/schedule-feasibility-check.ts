/**
 * @file Builds one schedule-feasibility check from the schedule issues found for it.
 * @module @caa/engine/scheduling/schedule-feasibility-check
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  CheckKind,
  type CheckResult,
  CheckState,
  createCheckResult,
  SCHEDULE_REASON_STATE,
  type ScheduleIssue,
} from '@caa/domain';

/**
 * Builds a `SCHEDULE_FEASIBILITY` check from every issue found, in the order found.
 *
 * - No issues: PASS, with no evidence.
 * - Any issue that means FAIL: FAIL, whose evidence lists only the FAIL issues. The first one
 *   gives the reason code.
 * - Otherwise UNKNOWN, listing every issue, the first giving the reason code.
 *
 * The state each reason means comes from the domain's `SCHEDULE_REASON_STATE`.
 *
 * @param issues - The issues found, in a stable order.
 * @returns The validated check. Its `rulesetVersion` is `null`, because a timetable conflict
 *   applies no published ruleset.
 */
export function toScheduleFeasibilityCheck(issues: readonly ScheduleIssue[]): CheckResult {
  const failing = issues.filter(
    (issue) => SCHEDULE_REASON_STATE[issue.reasonCode] === CheckState.Fail,
  );
  // SAFETY: a proven conflict decides the check, so FAIL comes before UNKNOWN, and an issue
  // that only means UNKNOWN never explains a FAIL (planning/08 §Authority and result semantics:
  // aggregate precedence; ADR-0010 §3).
  const decisive = failing.length > 0 ? failing : issues;
  const [first] = decisive;
  // SAFETY: only the absence of every issue is a PASS; missing data always leaves an issue, so
  // it can't reach this branch (planning/08 §Authority and result semantics).
  if (first === undefined) {
    return createCheckResult({ kind: CheckKind.ScheduleFeasibility, state: CheckState.Pass });
  }
  return createCheckResult({
    kind: CheckKind.ScheduleFeasibility,
    state: SCHEDULE_REASON_STATE[first.reasonCode],
    reasonCode: first.reasonCode,
    evidence: { rulesetVersion: null, decisiveLeaves: [], scheduleIssues: decisive },
  });
}
